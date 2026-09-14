import { NextResponse } from "next/server"
import { deleteAccount } from "@/lib/accounts"
import { requireApiAuth, requireSameOrigin } from "@/lib/api"

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = await requireSameOrigin()
  if (originError) return originError
  const { id } = await context.params
  if (!deleteAccount(id)) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
