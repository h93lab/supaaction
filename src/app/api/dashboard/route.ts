import { NextResponse } from "next/server"
import { requireApiAuth } from "@/lib/api"
import { getDashboardData } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET() {
  const authError = await requireApiAuth()
  if (authError) return authError
  return NextResponse.json(getDashboardData())
}
