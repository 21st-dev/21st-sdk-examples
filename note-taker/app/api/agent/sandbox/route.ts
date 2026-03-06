import { AgentClient } from "@21st-sdk/node"
import { NextResponse } from "next/server"

const client = new AgentClient({ apiKey: process.env.API_KEY_21ST! })

export async function POST() {
  try {
    const sandbox = await client.sandboxes.create({ agent: "note-taker" })
    return NextResponse.json({ sandboxId: sandbox.id })
  } catch (error) {
    console.error("[sandbox] Failed to create:", error)
    return NextResponse.json(
      { error: "Failed to create sandbox" },
      { status: 500 },
    )
  }
}
