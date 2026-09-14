import { NextResponse } from "next/server"
import { requireApiAuth } from "@/lib/api"
import { listProjects } from "@/lib/db"

export async function GET() {
  const authError = await requireApiAuth()
  if (authError) return authError
  return NextResponse.json({ projects: listProjects() })
}
