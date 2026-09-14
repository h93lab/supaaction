import { NextResponse } from "next/server"
import { syncAccount } from "@/lib/accounts"
import { apiError, requireApiAuth, requireSameOrigin } from "@/lib/api"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = await requireSameOrigin()
  if (originError) return originError
  try {
    const { id } = await context.params
    const projectCount = await syncAccount(id)
    return NextResponse.json({ ok: true, projectCount })
  } catch (error) {
    return apiError(error, "تعذرت المزامنة")
  }
}
