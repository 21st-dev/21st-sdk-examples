import { AgentClient } from "@21st-sdk/node"
import { NextResponse } from "next/server"

const client = new AgentClient({ apiKey: process.env.API_KEY_21ST! })

let cachedSandboxId: string | null = null

export async function POST() {
  try {
    if (cachedSandboxId) {
      return NextResponse.json({ sandboxId: cachedSandboxId })
    }

    const sandbox = await client.sandboxes.create({ agent: "note-taker" })
    cachedSandboxId = sandbox.id
    return NextResponse.json({ sandboxId: sandbox.id })
  } catch (error) {
    console.error("[sandbox] Failed to create:", error)
    return NextResponse.json(
      { error: "Failed to create sandbox" },
      { status: 500 },
    )
  }
}
