import { z } from "zod"
import { NextResponse } from "next/server"
import { apiError, requireApiAuth, requireSameOrigin } from "@/lib/api"
import { pingProjects } from "@/lib/pinger"
import { recordAudit } from "@/lib/db"

const schema = z.object({ refs: z.array(z.string().min(1)).max(100).optional() })

export async function POST(request: Request) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const originError = requireSameOrigin(request)
  if (originError) return originError
  try {
    const input = schema.parse(await request.json().catch(() => ({})))
    const results = await pingProjects(input.refs, "manual")
    const failed = results.filter((result) => result.status === "failed")
    recordAudit("projects.pinged", "project", null, `تنشيط يدوي: ${results.length - failed.length} ناجح، ${failed.length} فاشل`)
    return NextResponse.json({ results, summary: { total: results.length, failed: failed.length, succeeded: results.length - failed.length } })
  } catch (error) {
    return apiError(error, "تعذر تشغيل الفحص")
  }
}
