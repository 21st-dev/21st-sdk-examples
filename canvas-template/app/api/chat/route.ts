import { AgentClient } from "@21st-sdk/node"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 300

const AGENT_SLUG = "canvas-agent"

let client: AgentClient | null = null
function getClient() {
  if (!client) {
    const apiKey = process.env.API_KEY_21ST
    if (!apiKey) throw new Error("API_KEY_21ST is not set")
    client = new AgentClient({ apiKey })
  }
  return client
}

type ShapeBrief = {
  id: string
  type: string
  x: number
  y: number
  w?: number
  h?: number
  text?: string
  imageAlt?: string
  routePath?: string
}

function serializeShapes(shapes: ShapeBrief[] | undefined): string | null {
  if (!shapes || shapes.length === 0) return null
  const lines = shapes.map((s) => {
    const size = s.w && s.h ? ` ${Math.round(s.w)}x${Math.round(s.h)}` : ""
    const base = `- ${s.type}#${s.id.slice(0, 8)} at (${Math.round(s.x)},${Math.round(s.y)})${size}`
    if (s.type === "variant" && s.routePath) {
      return `${base} — iframe of route "${s.routePath}" (${s.text ?? ""})`.trim()
    }
    if (s.type === "reference-image") {
      return `${base} — reference image: "${s.imageAlt ?? "unnamed"}"`
    }
    if (s.text) return `${base} — "${s.text.slice(0, 80)}"`
    return base
  })
  return lines.join("\n")
}

/**
 * POST /api/chat
 *
 * Proxy to the 21st relay. The request body is the standard ai-sdk
 * useChat payload (`{ messages, ... }`) plus our own fields:
 *   - sandboxId:   required
 *   - threadId:    required
 *   - shapes:      optional tldraw shape summary, injected as systemPrompt.append
 *
 * We forward to client.threads.run() so we can inject a dynamic system prompt
 * per-message — this is how tldraw canvas state reaches the agent.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, sandboxId, threadId, shapes, planMode, theme } = body as {
      messages: Array<{ id?: string; role: string; parts: unknown[] }>
      sandboxId?: string
      threadId?: string
      shapes?: ShapeBrief[]
      planMode?: boolean
      theme?: string
    }

    if (!sandboxId || !threadId) {
      return Response.json(
        { error: "sandboxId and threadId are required" },
        { status: 400 },
      )
    }

    const shapesText = serializeShapes(shapes)
    const shapesBlock = shapesText
      ? `\n\n<canvas-state>\nThe user's tldraw canvas currently contains these selected shapes:\n${shapesText}\n</canvas-state>`
      : ""
    const planBlock = planMode
      ? `\n\n<plan-mode>\nThe user has toggled plan mode. Before writing or editing any files, produce a short numbered plan of what you intend to do (3-6 steps), wait for implicit acknowledgement (none needed — proceed after outlining), then execute. Do NOT call start_dev_server until the plan is written out.\n</plan-mode>`
      : ""
    const themeBlock = theme ? `\n\n${theme}` : ""
    const append =
      shapesBlock || planBlock || themeBlock
        ? shapesBlock + planBlock + themeBlock
        : undefined

    const result = await getClient().threads.run({
      agent: AGENT_SLUG,
      sandboxId,
      threadId,
      messages: messages as any,
      options: append
        ? {
            systemPrompt: {
              type: "preset",
              preset: "claude_code",
              append,
            },
          }
        : undefined,
    })

    // threads.run returns a raw streaming Response from the relay. Forward it
    // unchanged — reconstructing the Response (e.g. `new Response(body, {...})`)
    // truncates the stream mid-flight in Next.js and yields
    // ERR_INCOMPLETE_CHUNKED_ENCODING. Returning the upstream Response
    // directly lets Next.js pipe it through with correct framing.
    return result.response
  } catch (error) {
    console.error("[chat] proxy failed:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
