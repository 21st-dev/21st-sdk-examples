import { AgentClient } from "@21st-sdk/node"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

let client: AgentClient | null = null
function getClient() {
  if (!client) {
    const apiKey = process.env.API_KEY_21ST
    if (!apiKey) throw new Error("API_KEY_21ST is not set")
    client = new AgentClient({ apiKey })
  }
  return client
}

export async function GET(req: NextRequest) {
  const sandboxId = req.nextUrl.searchParams.get("sandboxId")
  if (!sandboxId) {
    return NextResponse.json({ error: "sandboxId required" }, { status: 400 })
  }
  try {
    const threads = await getClient().threads.list({ sandboxId })
    return NextResponse.json(threads)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
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
    const thread = await getClient().threads.create({ sandboxId, name })
    return NextResponse.json(thread)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
