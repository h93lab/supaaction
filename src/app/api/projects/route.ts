import { NextResponse } from "next/server"
import { requireApiAuth } from "@/lib/api"
import { listProjectsPage } from "@/lib/db"

export async function GET(request: Request) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const params = new URL(request.url).searchParams
  const result = listProjectsPage(Number(params.get("page")) || 1, Number(params.get("pageSize")) || 25, params.get("q") || "")
  return NextResponse.json({
    projects: result.items,
    pagination: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
  })
}
