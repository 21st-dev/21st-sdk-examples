import { AnClient } from "@21st-sdk/node"
import { NextResponse } from "next/server"

const an = new AnClient({ apiKey: process.env.AN_API_KEY! })

let cachedSandboxId: string | null = null

export async function POST() {
  try {
    if (cachedSandboxId) {
      return NextResponse.json({ sandboxId: cachedSandboxId })
    }

    const sandbox = await an.sandboxes.create({ agent: "note-taker" })
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
