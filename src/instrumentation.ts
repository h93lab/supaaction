export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { schedulerEnabled } = await import("@/lib/env")
    if (!schedulerEnabled()) return
    const { startScheduler } = await import("@/lib/scheduler")
    startScheduler()
  }
}
