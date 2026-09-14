import cron from "node-cron"
import { syncAllAccounts } from "@/lib/accounts"
import { acquireJobLock, getDb, getSettings, releaseJobLock } from "@/lib/db"
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

export function startScheduler() {
  if (globalThis.__supaactionSchedulerStarted) return
  globalThis.__supaactionSchedulerStarted = true
  getDb()

  cron.schedule("* * * * *", async () => {
    try {
      await maybeSyncAccounts()
      await runDuePings()
      const retentionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
      getDb().prepare("DELETE FROM ping_runs WHERE started_at < ?").run(retentionCutoff)
    } catch (error) {
      console.error("[scheduler] tick failed", error)
    }
  })

  setTimeout(() => void runDuePings().catch((error) => console.error("[scheduler] initial ping failed", error)), 5_000)
  console.info("[scheduler] SupaAction scheduler started")
}
