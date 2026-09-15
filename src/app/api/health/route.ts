import { NextResponse } from "next/server"
import { getDb, getServiceHeartbeat } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  try {
    getDb().prepare("SELECT 1").get()
    const heartbeat = getServiceHeartbeat("scheduler")
    const schedulerHealthy = Boolean(heartbeat) && Date.now() - Date.parse(heartbeat as string) < 3 * 60 * 1000
    return NextResponse.json({
      status: schedulerHealthy ? "ok" : "degraded",
      service: "supaaction",
      database: "ok",
      scheduler: schedulerHealthy ? "ok" : "stale",
      schedulerHeartbeat: heartbeat,
    }, { status: schedulerHealthy ? 200 : 503 })
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 })
  }
}
