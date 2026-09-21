import path from "node:path"
import Database from "better-sqlite3"

const DEFAULT_STALE_MS = 10 * 60 * 1000
const configuredStaleMs = Number(process.env.WORKER_HEARTBEAT_TIMEOUT_MS)
const staleMs = Number.isFinite(configuredStaleMs) && configuredStaleMs > 0 ? configuredStaleMs : DEFAULT_STALE_MS

const databaseFile = path.resolve(process.env.DATABASE_PATH?.trim() || ".data/supaaction.db")

function run() {
  const database = new Database(databaseFile, { readonly: true, fileMustExist: true })
  try {
    const row = database.prepare("SELECT last_heartbeat_at FROM service_status WHERE name = 'scheduler'").get()
    if (!row) throw new Error("no scheduler heartbeat recorded")
    const heartbeatMs = Date.parse(row.last_heartbeat_at)
    if (!Number.isFinite(heartbeatMs)) throw new Error(`scheduler heartbeat is not a valid timestamp: ${row.last_heartbeat_at}`)
    const ageMs = Date.now() - heartbeatMs
    if (ageMs > staleMs) {
      throw new Error(`scheduler heartbeat is stale by ${Math.round(ageMs / 1000)}s (limit ${Math.round(staleMs / 1000)}s)`)
    }
    console.log(`worker healthy: scheduler heartbeat ${Math.round(ageMs / 1000)}s old`)
  } finally {
    database.close()
  }
}

try {
  run()
} catch (error) {
  console.error(`worker unhealthy: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
