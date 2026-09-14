import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { isAuthenticated } from "@/lib/auth"

export async function requireApiAuth() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }
  return null
}

export async function requireSameOrigin() {
  const incoming = await headers()
  const origin = incoming.get("origin")
  if (!origin) return null
  const host = incoming.get("x-forwarded-host") || incoming.get("host")
  if (!host || new URL(origin).host !== host) {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 403 })
  }
  return null
}

export function apiError(error: unknown, fallback = "حدث خطأ غير متوقع") {
  const message = error instanceof Error ? error.message : fallback
  const status = message === "Account not found" ? 404 : 400
  return NextResponse.json({ error: message }, { status })
}
