import { NextResponse } from "next/server"
import { requireApiAuth } from "@/lib/api"
import { listRecentRuns } from "@/lib/db"

export async function GET(request: Request) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const url = new URL(request.url)
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 100, 1), 500)
  return NextResponse.json({ runs: listRecentRuns(limit) })
}
