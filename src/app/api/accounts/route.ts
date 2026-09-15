import { z } from "zod"
import { NextResponse } from "next/server"
import { addAccount } from "@/lib/accounts"
import { apiError, requireApiAuth, requireSameOrigin } from "@/lib/api"
import { listAccounts, recordAudit } from "@/lib/db"

const accountSchema = z.object({
  label: z.string().trim().min(2, "اسم الحساب مطلوب").max(80),
  token: z.string().trim().min(20, "أدخل Access Token صالح"),
})

export async function GET() {
  const authError = await requireApiAuth()
  if (authError) return authError
  return NextResponse.json({ accounts: listAccounts() })
}

export async function POST(request: Request) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = requireSameOrigin(request)
  if (originError) return originError
  try {
    const input = accountSchema.parse(await request.json())
    const result = await addAccount(input.label, input.token)
    recordAudit("account.added", "account", result.accountId, `تم ربط الحساب: ${input.label}`)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return apiError(error, "تعذر إضافة الحساب")
  }
}
