import { NextResponse } from "next/server"
import { syncAccount } from "@/lib/accounts"
import { apiError, requireApiAuth, requireSameOrigin } from "@/lib/api"
import { recordAudit } from "@/lib/db"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = requireSameOrigin(_request)
  if (originError) return originError
  try {
    const { id } = await context.params
    const projectCount = await syncAccount(id)
    recordAudit("account.synced", "account", id, `تمت مزامنة الحساب واكتشاف ${projectCount} مشروع`)
    return NextResponse.json({ ok: true, projectCount })
  } catch (error) {
    return apiError(error, "تعذرت المزامنة")
  }
}
