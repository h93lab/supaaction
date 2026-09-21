import { NextResponse } from "next/server"
import { requireApiAuth } from "@/lib/api"
import { listProjectRuns } from "@/lib/db"

export async function GET(_request: Request, context: { params: Promise<{ ref: string }> }) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const { ref } = await context.params
  return NextResponse.json({ runs: listProjectRuns(ref, 20) })
}
