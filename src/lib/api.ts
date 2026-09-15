import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"
import { appUrl } from "@/lib/env"

export async function requireApiAuth() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }
  return null
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  let valid = false
  try {
    valid = Boolean(origin) && new URL(origin as string).origin === new URL(appUrl()).origin
  } catch {
    valid = false
  }
  if (!valid) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 403 })
  }
  return null
}

export function apiError(error: unknown, fallback = "حدث خطأ غير متوقع") {
  const message = error instanceof Error ? error.message : fallback
  const status = message === "Account not found" ? 404 : 400
  return NextResponse.json({ error: message }, { status })
}
