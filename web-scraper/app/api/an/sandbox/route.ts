import { AnClient } from "@21st-sdk/node"
import { NextResponse } from "next/server"

const an = new AnClient({ apiKey: process.env.AN_API_KEY! })
const AGENT_SLUG =
  process.env.AN_AGENT_SLUG || process.env.NEXT_PUBLIC_AN_AGENT_SLUG || "web-scraper"

export async function POST() {
  try {
    const sandbox = await an.sandboxes.create({ agent: AGENT_SLUG })
    return NextResponse.json({ sandboxId: sandbox.id })
  } catch (error) {
    console.error("[sandbox] Failed to create sandbox:", error)
    return NextResponse.json({ error: "Failed to create sandbox" }, { status: 500 })
  }
}
