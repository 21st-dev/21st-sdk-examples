import { AgentClient } from "@21st-sdk/node"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

let client: AgentClient | null = null
function getClient() {
  if (!client) {
    const apiKey = process.env.API_KEY_21ST
    if (!apiKey) throw new Error("API_KEY_21ST is not set")
    client = new AgentClient({ apiKey })
  }
  return client
}

/**
 * GET /api/preview?sandboxId=<uuid>&port=3000
 *
 * Resolves the public E2B URL for a port exposed from the sandbox.
 * Also pings the URL to return whether the dev server is actually live.
 *
 * Returns: { url: string, live: boolean }
 */
export async function GET(req: NextRequest) {
  const sandboxId = req.nextUrl.searchParams.get("sandboxId")
  const port = Number(req.nextUrl.searchParams.get("port") ?? "3000")
  if (!sandboxId) {
    return NextResponse.json({ error: "sandboxId required" }, { status: 400 })
  }

  try {
    // client.id is the 21st UUID; we need the E2B-native sandboxId to build the host.
    const detail = await getClient().sandboxes.get(sandboxId)
    const e2bId = detail.sandboxId
    const url = `https://${port}-${e2bId}.e2b.app`

    // The E2B proxy responds 502/500 with its own error page when no service
    // is listening on the requested port. A real Next.js dev server always
    // answers something in 2xx/3xx/4xx — so treat only those as "live".
    let live = false
    try {
      const probe = await fetch(url, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      })
      live = probe.status < 500
    } catch {
      live = false
    }

    return NextResponse.json({ url, live })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
