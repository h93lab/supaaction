import { NextResponse } from "next/server"
import { deleteAccount } from "@/lib/accounts"
import { requireApiAuth, requireSameOrigin } from "@/lib/api"
import { recordAudit } from "@/lib/db"

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = requireSameOrigin(_request)
  if (originError) return originError
  const { id } = await context.params
  if (!deleteAccount(id)) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 })
  recordAudit("account.deleted", "account", id, "تم حذف حساب Supabase وبيانات مشاريعه المحلية")
  return NextResponse.json({ ok: true })
}
