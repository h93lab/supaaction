import cron from "node-cron"
import { syncAllAccounts } from "@/lib/accounts"
import { acquireJobLock, getDb, getServiceHeartbeat, getSettings, releaseJobLock, updateServiceHeartbeat } from "@/lib/db"
import { runDuePings } from "@/lib/pinger"

declare global {
  var __supaactionSchedulerStarted: boolean | undefined
}

async function maybeSyncAccounts() {
  const settings = getSettings()
  if (!settings.autoSync || !acquireJobLock("account-sync", 30 * 60)) return
  try {
    const cutoff = new Date(Date.now() - settings.syncIntervalHours * 60 * 60 * 1000).toISOString()
    const due = getDb().prepare("SELECT COUNT(*) AS count FROM accounts WHERE last_synced_at IS NULL OR last_synced_at <= ?")
      .get(cutoff) as { count: number }
    if (due.count > 0) await syncAllAccounts()
  } finally {
    releaseJobLock("account-sync")
  }
}

const CLEANUP_MARKER = "retention-cleanup"
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000

function maybeRunRetentionCleanup() {
  const lastCleanup = getServiceHeartbeat(CLEANUP_MARKER)
  const lastCleanupMs = lastCleanup ? Date.parse(lastCleanup) : Number.NaN
  if (Number.isFinite(lastCleanupMs) && Date.now() - lastCleanupMs < CLEANUP_INTERVAL_MS) return
  const database = getDb()
  const retentionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  database.prepare("DELETE FROM ping_runs WHERE started_at < ?").run(retentionCutoff)
  const auditRetentionCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  database.prepare("DELETE FROM audit_logs WHERE created_at < ?").run(auditRetentionCutoff)
  updateServiceHeartbeat(CLEANUP_MARKER)
}

export function startScheduler() {
  if (globalThis.__supaactionSchedulerStarted) return
  globalThis.__supaactionSchedulerStarted = true
  getDb()
  updateServiceHeartbeat("scheduler")

  cron.schedule("* * * * *", async () => {
    try {
      await maybeSyncAccounts()
      await runDuePings()
      maybeRunRetentionCleanup()
    } catch (error) {
      console.error("[scheduler] tick failed", error)
    } finally {
      updateServiceHeartbeat("scheduler")
    }
  })

  setTimeout(() => void runDuePings().catch((error) => console.error("[scheduler] initial ping failed", error)), 5_000)
  console.info("[scheduler] SupaAction scheduler started")
}
