import { getServiceHeartbeat } from "./lib/db"
import { startScheduler } from "./lib/scheduler"

const DEFAULT_HEARTBEAT_TIMEOUT_MS = 10 * 60 * 1000

function heartbeatTimeoutMs() {
  const configured = Number(process.env.WORKER_HEARTBEAT_TIMEOUT_MS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_HEARTBEAT_TIMEOUT_MS
}

startScheduler()

const timeoutMs = heartbeatTimeoutMs()
const checkIntervalMs = Math.max(1_000, Math.min(60_000, Math.floor(timeoutMs / 2)))

setInterval(() => {
  const heartbeat = getServiceHeartbeat("scheduler")
  const heartbeatMs = heartbeat ? Date.parse(heartbeat) : Number.NaN
  if (Number.isFinite(heartbeatMs) && Date.now() - heartbeatMs <= timeoutMs) return
  console.error(`[worker] scheduler heartbeat is stale (last seen: ${heartbeat ?? "never"}); exiting so Docker can restart it`)
  process.exit(1)
}, checkIntervalMs)

const shutdown = (signal: string) => {
  console.info(`[worker] received ${signal}; shutting down`)
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
