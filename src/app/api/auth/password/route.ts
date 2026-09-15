import { NextResponse } from "next/server"
import { z } from "zod"
import {
  clearFailedLogins,
  clearSessionCookie,
  loginRateLimit,
  recordFailedLogin,
  setAdminPassword,
  verifyPassword,
} from "@/lib/auth"
import { requireApiAuth, requireSameOrigin } from "@/lib/api"
import { recordAudit } from "@/lib/db"

const schema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(128),
})

export async function PUT(request: Request) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = requireSameOrigin(request)
  if (originError) return originError

  const rateLimitKey = "admin-password-change"
  const rateLimit = loginRateLimit(rateLimitKey)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة. حاول مرة أخرى لاحقًا" }, {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    })
  }

  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "كلمة المرور الجديدة يجب أن تكون بين 12 و128 حرفًا" }, { status: 400 })
  }
  if (!verifyPassword(parsed.data.currentPassword)) {
    recordFailedLogin(rateLimitKey)
    return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 401 })
  }
  if (verifyPassword(parsed.data.newPassword)) {
    return NextResponse.json({ error: "اختر كلمة مرور مختلفة عن الحالية" }, { status: 400 })
  }

  clearFailedLogins(rateLimitKey)
  setAdminPassword(parsed.data.newPassword)
  recordAudit("password.changed", "admin", null, "تم تغيير كلمة مرور الإدارة وإلغاء الجلسات السابقة")
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
