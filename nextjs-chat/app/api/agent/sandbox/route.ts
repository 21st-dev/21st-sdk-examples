import { AgentClient } from "@21st-sdk/node"
import { NextResponse } from "next/server"

const client = new AgentClient({ apiKey: process.env.API_KEY_21ST! })

// In-memory sandbox storage — resets on server restart
let cachedSandboxId: string | null = null

export async function POST() {
  try {
    if (cachedSandboxId) {
      console.log(`[sandbox] Reusing cached sandboxId: ${cachedSandboxId}`)
      return NextResponse.json({ sandboxId: cachedSandboxId })
    }

    console.log("[sandbox] No cached sandbox, creating new one...")
    const sandbox = await client.sandboxes.create({ agent: "my-agent" })
    cachedSandboxId = sandbox.id
    console.log(`[sandbox] Created new sandbox: ${sandbox.id}`)
    return NextResponse.json({ sandboxId: sandbox.id })
  } catch (error) {
    console.error("[sandbox] Failed to create sandbox:", error)
    return NextResponse.json(
      { error: "Failed to create sandbox" },
      { status: 500 },
    )
  }
}
