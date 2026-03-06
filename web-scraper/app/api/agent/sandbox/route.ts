import { AgentClient } from "@21st-sdk/node"
import { NextResponse } from "next/server"

const client = new AgentClient({ apiKey: process.env.API_KEY_21ST! })
const AGENT_SLUG = "web-scraper"

export async function POST() {
  try {
    const sandbox = await client.sandboxes.create({ agent: AGENT_SLUG })
    return NextResponse.json({ sandboxId: sandbox.id })
  } catch (error) {
    console.error("[sandbox] Failed to create sandbox:", error)
    return NextResponse.json({ error: "Failed to create sandbox" }, { status: 500 })
  }
}
