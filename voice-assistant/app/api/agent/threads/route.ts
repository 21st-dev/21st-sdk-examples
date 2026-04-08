import { AgentClient } from "@21st-sdk/node"
import { NextRequest, NextResponse } from "next/server"

const client = new AgentClient({ apiKey: process.env.API_KEY_21ST! })

export async function GET(req: NextRequest) {
  const sandboxId = req.nextUrl.searchParams.get("sandboxId")
  if (!sandboxId) {
    return NextResponse.json({ error: "sandboxId required" }, { status: 400 })
  }

  try {
    console.log(`[threads] Listing threads for sandboxId: ${sandboxId}`)
    const threads = await client.threads.list({ sandboxId })
    console.log(`[threads] Found ${threads.length} threads:`, threads.map((t: any) => ({ id: t.id, name: t.name })))
    return NextResponse.json(threads)
  } catch (error) {
    console.error("[threads] Failed to list threads:", error)
    return NextResponse.json(
      { error: "Failed to list threads" },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const { sandboxId, name } = await req.json()
  if (!sandboxId) {
    return NextResponse.json({ error: "sandboxId required" }, { status: 400 })
  }

  try {
    console.log(`[threads] Creating thread "${name}" in sandboxId: ${sandboxId}`)
    const thread = await client.threads.create({ sandboxId, name })
    console.log(`[threads] Created thread: ${thread.id}`)
    return NextResponse.json(thread)
  } catch (error) {
    console.error("[threads] Failed to create thread:", error)
    return NextResponse.json(
      { error: "Failed to create thread" },
      { status: 500 },
    )
  }
}
