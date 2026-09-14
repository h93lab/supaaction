import { randomUUID } from "node:crypto"
import { getAccountToken } from "@/lib/accounts"
import { acquireJobLock, getDb, getSettings, releaseJobLock } from "@/lib/db"
import { queryProject, SupabaseApiError } from "@/lib/supabase-management"
import type { PingRunRecord } from "@/lib/types"

type PingTarget = { ref: string; account_id: string; name: string }

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function pingOneProject(target: PingTarget, trigger: PingRunRecord["trigger"] = "scheduled") {
  const settings = getSettings()
  const startedAt = new Date().toISOString()
  const runId = randomUUID()
  const token = getAccountToken(target.account_id)
  let finalError: Error | null = null
  let httpStatus: number | null = null
  let attempts = 0
  const started = performance.now()

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
      await wait(settings.retryDelaySeconds * 1000 * (attempt + 1))
    }
  }

  const completedAt = new Date().toISOString()
  const latencyMs = Math.round(performance.now() - started)
  const status = finalError ? "failed" : "success"
  const nextPingAt = new Date(Date.now() + settings.pingIntervalHours * 60 * 60 * 1000).toISOString()
  const database = getDb()
  database.transaction(() => {
    database.prepare(`INSERT INTO ping_runs
      (id, project_ref, started_at, completed_at, status, latency_ms, http_status, attempt_count, error, trigger)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(runId, target.ref, startedAt, completedAt, status, latencyMs, httpStatus, attempts, finalError?.message ?? null, trigger)
    database.prepare(`UPDATE projects SET last_ping_at = ?, last_ping_status = ?, last_latency_ms = ?,
      last_http_status = ?, last_error = ?, next_ping_at = ?, updated_at = ? WHERE ref = ?`)
      .run(completedAt, status, latencyMs, httpStatus, finalError?.message ?? null, nextPingAt, completedAt, target.ref)
  })()

  return { ref: target.ref, name: target.name, status, latencyMs, httpStatus, attempts, error: finalError?.message ?? null }
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
  if (refs?.length) {
    const placeholders = refs.map(() => "?").join(",")
    targets = database.prepare(`SELECT ref, account_id, name FROM projects WHERE enabled = 1 AND ref IN (${placeholders})`).all(...refs) as PingTarget[]
  } else {
    targets = database.prepare("SELECT ref, account_id, name FROM projects WHERE enabled = 1").all() as PingTarget[]
  }
  return withConcurrency(targets, getSettings().concurrency, (target) => pingOneProject(target, trigger))
}

export async function runDuePings() {
  if (!acquireJobLock("ping-due", 15 * 60)) return []
  try {
    const now = new Date().toISOString()
    const targets = getDb().prepare(`SELECT ref, account_id, name FROM projects
      WHERE enabled = 1 AND (next_ping_at IS NULL OR next_ping_at <= ?)`)
      .all(now) as PingTarget[]
    return withConcurrency(targets, getSettings().concurrency, (target) => pingOneProject(target, "scheduled"))
  } finally {
    releaseJobLock("ping-due")
  }
}
