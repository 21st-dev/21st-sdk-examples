import { AgentClient } from "@21st-sdk/node"
import { NextRequest, NextResponse } from "next/server"

const client = new AgentClient({ apiKey: process.env.API_KEY_21ST! })

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params
  const sandboxId = req.nextUrl.searchParams.get("sandboxId")
  if (!sandboxId) {
    return NextResponse.json({ error: "sandboxId required" }, { status: 400 })
  }

  try {
    const thread = await client.threads.get({ sandboxId, threadId })
    return NextResponse.json(thread)
  } catch (error) {
    console.error("[threads/get] Failed:", error)
    const message = error instanceof Error ? error.message : "Failed to fetch thread"
    const status = message.includes("not_found") ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
