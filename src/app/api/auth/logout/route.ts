import { NextResponse } from "next/server"
import { clearSessionCookie } from "@/lib/auth"
import { requireApiAuth, requireSameOrigin } from "@/lib/api"

export async function POST() {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = await requireSameOrigin()
  if (originError) return originError
  await clearSessionCookie()
  return NextResponse.json({ ok: true })
}
