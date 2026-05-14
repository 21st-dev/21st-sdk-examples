import { AgentClient } from "@21st-sdk/node"
import { NextRequest, NextResponse } from "next/server"
import { NOTION_AGENT_NAME } from "@/app/constants"

const client = new AgentClient({ apiKey: process.env.API_KEY_21ST! })

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { notionApiKey?: string }

    console.log("[sandbox] Creating new sandbox...")
    const sandbox = await client.sandboxes.create({
      agent: NOTION_AGENT_NAME,
      envs: body.notionApiKey
        ? { NOTION_API_KEY: body.notionApiKey }
        : undefined,
    })

    const thread = await client.threads.create({
      sandboxId: sandbox.id,
      name: "Notion Chat",
    })

    console.log(`[sandbox] Created sandbox ${sandbox.id} with thread ${thread.id}`)
    return NextResponse.json({
      sandboxId: sandbox.id,
      threadId: thread.id,
      createdAt: thread.createdAt,
    })
  } catch (error) {
    console.error("[sandbox] Failed to create sandbox:", error)
    return NextResponse.json(
      { error: "Failed to create sandbox" },
      { status: 500 },
    )
  }
}
