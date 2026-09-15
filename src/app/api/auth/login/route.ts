import { NextResponse } from "next/server"
import { clearFailedLogins, loginRateLimit, recordFailedLogin, setSessionCookie, verifyPassword } from "@/lib/auth"
import { requireSameOrigin } from "@/lib/api"
import { recordAudit } from "@/lib/db"

export async function POST(request: Request) {
  const originError = requireSameOrigin(request)
  if (originError) return originError
  const clientKey = "admin-login"
  const rateLimit = loginRateLimit(clientKey)
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "محاولات كثيرة. حاول مرة أخرى لاحقًا" }, {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    })
  }
  const body = await request.json().catch(() => null) as { password?: string } | null
  if (!body?.password || !verifyPassword(body.password)) {
    recordFailedLogin(clientKey)
    return NextResponse.json({ error: "كلمة المرور غير صحيحة" }, { status: 401 })
  }
  clearFailedLogins(clientKey)
  await setSessionCookie()
  recordAudit("auth.login", "admin", null, "تم تسجيل دخول الإدارة بنجاح")
  return NextResponse.json({ ok: true })
}
