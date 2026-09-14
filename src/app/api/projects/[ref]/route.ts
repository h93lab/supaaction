import { z } from "zod"
import { NextResponse } from "next/server"
import { apiError, requireApiAuth, requireSameOrigin } from "@/lib/api"
import { getDb } from "@/lib/db"

const schema = z.object({ enabled: z.boolean() })

export async function PATCH(request: Request, context: { params: Promise<{ ref: string }> }) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = await requireSameOrigin()
  if (originError) return originError
  try {
    const input = schema.parse(await request.json())
    const { ref } = await context.params
    const nextPingAt = input.enabled ? new Date().toISOString() : null
    const result = getDb().prepare("UPDATE projects SET enabled = ?, next_ping_at = ?, updated_at = ? WHERE ref = ?")
      .run(input.enabled ? 1 : 0, nextPingAt, new Date().toISOString(), ref)
    if (!result.changes) return NextResponse.json({ error: "المشروع غير موجود" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error)
  }
}
