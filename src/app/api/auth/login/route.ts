import { NextResponse } from "next/server"
import {
  acquireVerificationSlot,
  chargeLoginAttempt,
  clearFailedLogins,
  isDirectRateLimitKey,
  loginRateLimitKey,
  loginSlowdown,
  releaseVerificationSlot,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth"
import { requireSameOrigin } from "@/lib/api"
import { recordAudit } from "@/lib/db"
import { AppPasswordConfigError } from "@/lib/env"

const TOO_MANY_ATTEMPTS = "محاولات كثيرة. حاول مرة أخرى لاحقًا"
const INVALID_PASSWORD = "كلمة المرور غير صحيحة"
const PASSWORD_NOT_CONFIGURED = "إعداد كلمة مرور الإدارة غير صالح. اضبط APP_PASSWORD في متغيرات البيئة ثم أعد تشغيل المنصة."

export async function POST(request: Request) {
  const originError = requireSameOrigin(request)
  if (originError) return originError

  const clientKey = loginRateLimitKey(request)

  if (!acquireVerificationSlot()) {
    return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, {
      status: 429,
      headers: { "Retry-After": "1" },
    })
  }

  try {
    const rateLimit = chargeLoginAttempt(clientKey)
    if (!rateLimit.allowed) {
      if (isDirectRateLimitKey(clientKey)) {
        await loginSlowdown()
      } else {
        return NextResponse.json({ error: TOO_MANY_ATTEMPTS }, {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        })
      }
    }

    const body = await request.json().catch(() => null) as { password?: string } | null
    let verified = false
    try {
      verified = Boolean(body?.password && verifyPassword(body.password))
    } catch (error) {
      if (error instanceof AppPasswordConfigError) {
        return NextResponse.json({ error: PASSWORD_NOT_CONFIGURED }, { status: 503 })
      }
      throw error
    }
    if (!verified) {
      return NextResponse.json({ error: INVALID_PASSWORD }, { status: 401 })
    }

    clearFailedLogins(clientKey)
    await setSessionCookie()
    recordAudit("auth.login", "admin", null, "تم تسجيل دخول الإدارة بنجاح")
    return NextResponse.json({ ok: true })
  } finally {
    releaseVerificationSlot()
  }
}
