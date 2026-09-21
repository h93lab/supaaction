import { NextResponse } from "next/server"
import { getDb, getServiceHeartbeat } from "@/lib/db"

export const runtime = "nodejs"

const SCHEDULER_STALE_MS = 3 * 60 * 1000
const SWEEP_STALE_MS = 10 * 60 * 1000

type Freshness = "ok" | "stale" | "unknown"

function freshness(heartbeat: string | null, staleMs: number): Freshness {
  if (!heartbeat) return "unknown"
  const heartbeatMs = Date.parse(heartbeat)
  if (!Number.isFinite(heartbeatMs)) return "unknown"
  return Date.now() - heartbeatMs < staleMs ? "ok" : "stale"
}

export async function GET() {
  try {
    getDb().prepare("SELECT 1").get()
    const schedulerHeartbeat = getServiceHeartbeat("scheduler")
    const sweepHeartbeat = getServiceHeartbeat("ping-sweep")
    return NextResponse.json({
      status: "ok",
      service: "supaaction",
      database: "ok",
      scheduler: freshness(schedulerHeartbeat, SCHEDULER_STALE_MS),
      schedulerHeartbeat,
      sweep: freshness(sweepHeartbeat, SWEEP_STALE_MS),
      sweepHeartbeat,
    }, { status: 200 })
  } catch {
    return NextResponse.json({ status: "error", service: "supaaction", database: "unavailable" }, { status: 503 })
  }
}
