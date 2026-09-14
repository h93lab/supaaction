import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { clearFailedLogins, loginRateLimit, recordFailedLogin, setSessionCookie, verifyPassword } from "@/lib/auth"
import { requireSameOrigin } from "@/lib/api"

export async function POST(request: Request) {
  const originError = await requireSameOrigin()
  if (originError) return originError
  const incoming = await headers()
  const clientKey = incoming.get("x-forwarded-for")?.split(",")[0]?.trim() || incoming.get("x-real-ip") || "local"
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
  return NextResponse.json({ ok: true })
}
