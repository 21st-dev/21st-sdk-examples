import { AnClient } from "@21st-sdk/node"
import { NextRequest, NextResponse } from "next/server"

const an = new AnClient({ apiKey: process.env.AN_API_KEY! })

export async function GET(req: NextRequest) {
  const sandboxId = req.nextUrl.searchParams.get("sandboxId")
  if (!sandboxId) {
    return NextResponse.json({ error: "sandboxId required" }, { status: 400 })
  }

  try {
    const threads = await an.threads.list({ sandboxId })
    return NextResponse.json(threads)
  } catch (error) {
    console.error("[threads] Failed to list:", error)
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
    const thread = await an.threads.create({ sandboxId, name })
    return NextResponse.json(thread)
  } catch (error) {
    console.error("[threads] Failed to create:", error)
    return NextResponse.json(
      { error: "Failed to create thread" },
      { status: 500 },
    )
  }
}
