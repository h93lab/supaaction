import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  try {
    getDb().prepare("SELECT 1").get()
    return NextResponse.json({ status: "ok", service: "supaaction" })
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 })
  }
}
