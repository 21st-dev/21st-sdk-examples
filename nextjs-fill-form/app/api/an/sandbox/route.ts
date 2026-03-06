import { AnClient } from "@21st-sdk/node"
import { NextResponse } from "next/server"

const an = new AnClient({ apiKey: process.env.AN_API_KEY! })

export async function POST() {
  try {
    const sandbox = await an.sandboxes.create({ agent: "form-agent" })
    return NextResponse.json({ sandboxId: sandbox.id })
  } catch (error) {
    console.error("[sandbox] Failed to create sandbox:", error)
    return NextResponse.json(
      { error: "Failed to create sandbox" },
      { status: 500 },
    )
  }
}
