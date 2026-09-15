import { NextResponse } from "next/server"
import { requireApiAuth } from "@/lib/api"
import { listAuditLogs, listRecentRunsPage } from "@/lib/db"

export async function GET(request: Request) {
  const authError = await requireApiAuth()
  if (authError) return authError
  const url = new URL(request.url)
  const page = Number(url.searchParams.get("page")) || 1
  const pageSize = Number(url.searchParams.get("pageSize")) || 50
  const result = listRecentRunsPage(page, pageSize)
  return NextResponse.json({
    runs: result.items,
    pagination: { total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
    auditLogs: listAuditLogs(100),
  })
}
