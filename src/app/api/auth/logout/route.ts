import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth"
import { requireApiAuth, requireSameOrigin } from "@/lib/api"
import { recordAudit } from "@/lib/db"

export async function POST(request: Request) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = requireSameOrigin(request)
  if (originError) return originError
  await clearSessionCookie()
  recordAudit("auth.logout", "admin", null, "تم تسجيل خروج الإدارة")
  return NextResponse.json({ ok: true })
}
