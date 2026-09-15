import { startScheduler } from "./lib/scheduler"

startScheduler()

const shutdown = (signal: string) => {
  console.info(`[worker] received ${signal}; shutting down`)
  process.exit(0)
}

process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
