import { randomUUID } from "node:crypto"
import { getAccountToken } from "@/lib/accounts"
import { acquireJobLock, getDb, getSettings, recordAudit, releaseJobLock } from "@/lib/db"
import { fetchProject, queryProject, restoreProject, SupabaseApiError } from "@/lib/supabase-management"
import type { PingRunRecord } from "@/lib/types"

type PingTarget = {
  ref: string
  account_id: string
  name: string
  remote_status?: string | null
  fail_streak?: number | null
  last_restore_at?: string | null
  restore_count?: number | null
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const PAUSED_STATUSES = new Set(["INACTIVE", "PAUSED", "PAUSING", "INACTIVE_HEALTHY"])
const RESTORE_COOLDOWN_HOURS = 6
const PAUSED_RECHECK_MINUTES = 30

export function failureBackoffMinutes(failStreak: number): number {
  if (failStreak <= 0) return 0
  if (failStreak === 1) return 15
  if (failStreak === 2) return 60
  if (failStreak === 3) return 360
  return 720
}

export function isPausedStatus(status: string | null | undefined): boolean {
  return status ? PAUSED_STATUSES.has(status.toUpperCase()) : false
}

export async function pingOneProject(target: PingTarget, trigger: PingRunRecord["trigger"] = "scheduled") {
  const settings = getSettings()
  const startedAt = new Date().toISOString()
  const runId = randomUUID()
  const token = getAccountToken(target.account_id)
  let finalError: Error | null = null
  let httpStatus: number | null = null
  let attempts = 0
  const started = performance.now()

  const storedFailStreak = target.fail_streak ?? 0
  let failStreak = storedFailStreak
  let lastRestoreAt = target.last_restore_at ?? null
  let restoreCount = target.restore_count ?? 0
  let remoteStatus = target.remote_status ?? "UNKNOWN"
  let pausedFromStatus = isPausedStatus(remoteStatus)

  if (pausedFromStatus) {
    try {
      const refreshed = await fetchProject(token, target.ref, settings.requestTimeoutSeconds)
      if (refreshed.data?.status) {
        remoteStatus = refreshed.data.status
        pausedFromStatus = isPausedStatus(remoteStatus)
      }
    } catch {
      // Fall back to the stored status: a failed verification must not break the ping loop.
    }
  }

  if (!pausedFromStatus) {
    for (let attempt = 0; attempt <= settings.retryCount; attempt += 1) {
      attempts = attempt + 1
      try {
        const response = await queryProject(token, target.ref, settings.requestTimeoutSeconds)
        httpStatus = response.status
        finalError = null
        break
      } catch (error) {
        finalError = error instanceof Error ? error : new Error("Ping failed")
        httpStatus = error instanceof SupabaseApiError ? error.status : null
        const retryable = !(error instanceof SupabaseApiError) || error.retryable
        if (!retryable || attempt >= settings.retryCount) break
        const ownDelaySeconds = settings.retryDelaySeconds * (attempt + 1)
        const serverDelaySeconds = error instanceof SupabaseApiError && error.retryAfterSeconds !== undefined
          ? Math.min(error.retryAfterSeconds, 120)
          : 0
        await wait(Math.max(ownDelaySeconds, serverDelaySeconds) * 1000)
      }
    }
  }

  const completedAt = new Date().toISOString()
  const latencyMs = Math.round(performance.now() - started)
  const paused = pausedFromStatus || httpStatus === 540
  const status: PingRunRecord["status"] = finalError || paused ? "failed" : "success"
  let errorMessage = finalError?.message ?? null
  let nextPingAt: string

  if (status === "success") {
    failStreak = 0
    nextPingAt = new Date(Date.now() + settings.pingIntervalHours * 60 * 60 * 1000).toISOString()
  } else if (paused) {
    failStreak = storedFailStreak + 1
    nextPingAt = new Date(Date.now() + PAUSED_RECHECK_MINUTES * 60 * 1000).toISOString()
    if (!errorMessage) errorMessage = "Project is paused"
  } else {
    failStreak = storedFailStreak + 1
    const backoffMinutes = Math.min(failureBackoffMinutes(failStreak), settings.pingIntervalHours * 60)
    nextPingAt = new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString()
  }

  if (paused) {
    const cooldownMs = RESTORE_COOLDOWN_HOURS * 60 * 60 * 1000
    const lastRestoreTime = lastRestoreAt ? Date.parse(lastRestoreAt) : Number.NaN
    const cooldownElapsed = Number.isNaN(lastRestoreTime) || Date.now() - lastRestoreTime >= cooldownMs
    if (cooldownElapsed) {
      const attemptedAt = new Date().toISOString()
      lastRestoreAt = attemptedAt
      restoreCount += 1
      try {
        await restoreProject(token, target.ref, settings.requestTimeoutSeconds)
        recordAudit("project.restore", "project", target.ref, `Restore requested for ${target.name} (${target.ref})`)
        try {
          const refreshed = await fetchProject(token, target.ref, settings.requestTimeoutSeconds)
          if (refreshed.data?.status) remoteStatus = refreshed.data.status
        } catch {
          // Best effort: a failed status refresh must not break the ping loop.
        }
        errorMessage = null
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Restore failed"
        recordAudit("project.restore_failed", "project", target.ref, `Restore failed for ${target.name} (${target.ref}): ${errorMessage}`)
      }
    }
  }

  const database = getDb()
  database.transaction(() => {
    database.prepare(`INSERT INTO ping_runs
      (id, project_ref, started_at, completed_at, status, latency_ms, http_status, attempt_count, error, trigger)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(runId, target.ref, startedAt, completedAt, status, latencyMs, httpStatus, attempts, errorMessage, trigger)
    database.prepare(`UPDATE projects SET last_ping_at = ?, last_ping_status = ?, last_latency_ms = ?,
      last_http_status = ?, last_error = ?, next_ping_at = ?, fail_streak = ?, last_restore_at = ?,
      restore_count = ?, remote_status = ?, updated_at = ? WHERE ref = ?`)
      .run(completedAt, status, latencyMs, httpStatus, errorMessage, nextPingAt, failStreak, lastRestoreAt,
        restoreCount, remoteStatus, completedAt, target.ref)
  })()

  return { ref: target.ref, name: target.name, status, latencyMs, httpStatus, attempts, error: errorMessage }
}

async function withConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>) {
  const results: R[] = []
  let cursor = 0
  async function runner() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }, runner))
  return results
}

export async function pingProjects(refs?: string[], trigger: PingRunRecord["trigger"] = "manual") {
  const database = getDb()
  let targets: PingTarget[]
  const targetColumns = "ref, account_id, name, remote_status, fail_streak, last_restore_at, restore_count"
  if (refs?.length) {
    const placeholders = refs.map(() => "?").join(",")
    targets = database.prepare(`SELECT ${targetColumns} FROM projects WHERE enabled = 1 AND ref IN (${placeholders})`).all(...refs) as PingTarget[]
  } else {
    targets = database.prepare(`SELECT ${targetColumns} FROM projects WHERE enabled = 1`).all() as PingTarget[]
  }
  return withConcurrency(targets, getSettings().concurrency, (target) => pingOneProject(target, trigger))
}

export async function runDuePings() {
  if (!acquireJobLock("ping-due", 15 * 60)) return []
  try {
    const now = new Date().toISOString()
    const targets = getDb().prepare(`SELECT ref, account_id, name, remote_status, fail_streak, last_restore_at, restore_count FROM projects
      WHERE enabled = 1 AND (next_ping_at IS NULL OR next_ping_at <= ?)`)
      .all(now) as PingTarget[]
    return withConcurrency(targets, getSettings().concurrency, (target) => pingOneProject(target, "scheduled"))
  } finally {
    releaseJobLock("ping-due")
  }
}
