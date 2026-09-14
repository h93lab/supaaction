import { z } from "zod"
import { NextResponse } from "next/server"
import { apiError, requireApiAuth, requireSameOrigin } from "@/lib/api"
import { getDb, getSettings } from "@/lib/db"

const schema = z.object({
  pingIntervalHours: z.number().int().min(1).max(168),
  retryCount: z.number().int().min(0).max(5),
  retryDelaySeconds: z.number().int().min(1).max(60),
  requestTimeoutSeconds: z.number().int().min(5).max(120),
  concurrency: z.number().int().min(1).max(10),
  autoSync: z.boolean(),
  syncIntervalHours: z.number().int().min(1).max(168),
  timezone: z.string().trim().min(1).max(80),
})

export async function GET() {
  const authError = await requireApiAuth()
  if (authError) return authError
  return NextResponse.json(getSettings())
}

export async function PUT(request: Request) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = await requireSameOrigin()
  if (originError) return originError
  try {
    const input = schema.parse(await request.json())
    getDb().prepare(`UPDATE settings SET ping_interval_hours = ?, retry_count = ?, retry_delay_seconds = ?,
      request_timeout_seconds = ?, concurrency = ?, auto_sync = ?, sync_interval_hours = ?, timezone = ? WHERE id = 1`)
      .run(input.pingIntervalHours, input.retryCount, input.retryDelaySeconds, input.requestTimeoutSeconds,
        input.concurrency, input.autoSync ? 1 : 0, input.syncIntervalHours, input.timezone)
    return NextResponse.json(getSettings())
  } catch (error) {
    return apiError(error, "تعذر حفظ الإعدادات")
  }
}
