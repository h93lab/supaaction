import { z } from "zod"
import { NextResponse } from "next/server"
import { deleteAccount, rotateAccountToken } from "@/lib/accounts"
import { apiError, requireApiAuth, requireSameOrigin } from "@/lib/api"
import { getAccountDeletionImpact, recordAudit } from "@/lib/db"

const tokenSchema = z.object({
  token: z.string().trim().min(20, "أدخل Access Token صالح"),
})

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const { id } = await context.params
  const impact = getAccountDeletionImpact(id)
  return NextResponse.json({ impact })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = requireSameOrigin(request)
  if (originError) return originError
  try {
    const { id } = await context.params
    const input = tokenSchema.parse(await request.json())
    await rotateAccountToken(id, input.token)
    recordAudit("account.token_rotated", "account", id, "تم تحديث توكن الحساب")
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error, "تعذر تحديث التوكن")
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = requireSameOrigin(_request)
  if (originError) return originError
  const { id } = await context.params
  const result = deleteAccount(id)
  if (!result.deleted) return NextResponse.json({ error: "الحساب غير موجود" }, { status: 404 })
  recordAudit("account.deleted", "account", id, `تم حذف الحساب: ${result.rehomed} مشروع أعيد ربطه، ${result.orphaned} مشروع تُرك بلا حساب، ${result.runs} عملية تنشيط محفوظة`)
  return NextResponse.json({ ok: true, ...result })
}
