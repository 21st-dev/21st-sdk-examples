import { NextRequest, NextResponse } from "next/server"
import { runSql } from "@/lib/sql-engine"

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const sql = body?.sql
  if (typeof sql !== "string") {
    return NextResponse.json({ ok: false, error: "sql (string) is required" }, { status: 400 })
  }
  const result = runSql(sql)
  return NextResponse.json(result)
}
