import { AgentClient } from "@21st-sdk/node"
import { NextRequest, NextResponse } from "next/server"

const client = new AgentClient({ apiKey: process.env.API_KEY_21ST! })

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { repository?: string }

    console.log("[sandbox] Creating new sandbox...")
    const sandbox = await client.sandboxes.create({
      agent: "nia-agent",
      files: body.repository
        ? {
            "/home/user/selected-repository.txt": `${body.repository}\n`,
          }
        : undefined,
    })

    if (body.repository) {
      const thread = await client.threads.create({
        sandboxId: sandbox.id,
        name: body.repository,
      })

      console.log(`[sandbox] Created thread ${thread.id} in sandbox ${sandbox.id}`)
      return NextResponse.json({
        sandboxId: sandbox.id,
        threadId: thread.id,
        createdAt: thread.createdAt,
      })
    }

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

export async function DELETE(req: NextRequest) {
  try {
    const body = (await req.json()) as { sandboxId?: string }
    if (!body.sandboxId) {
      return NextResponse.json({ error: "sandboxId required" }, { status: 400 })
    }

    console.log(`[sandbox] Deleting sandbox: ${body.sandboxId}`)
    await client.sandboxes.delete(body.sandboxId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("[sandbox] Failed to delete sandbox:", error)
    return NextResponse.json(
      { error: "Failed to delete sandbox" },
      { status: 500 },
    )
  }
}
