import { AgentClient } from "@21st-sdk/node"
import { NextRequest, NextResponse } from "next/server"
import { SANDBOX_REPO_DIR } from "@/lib/starter-files"

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
 * GET /api/agent/files?sandboxId=...&path=app
 *
 * Lists files under /home/user/repo[/path] in the sandbox. Skips noise:
 * node_modules, .next, dotfiles.
 *
 * Returns: { entries: Array<{ name, path, type: "file"|"dir" }> }
 */
export async function GET(req: NextRequest) {
  const sandboxId = req.nextUrl.searchParams.get("sandboxId")
  const rel = req.nextUrl.searchParams.get("path") ?? ""
  if (!sandboxId) {
    return NextResponse.json({ error: "sandboxId required" }, { status: 400 })
  }

  const absPath = rel ? `${SANDBOX_REPO_DIR}/${rel}` : SANDBOX_REPO_DIR

  try {
    const entries = await getClient().sandboxes.files.list({
      sandboxId,
      path: absPath,
      depth: 1,
    })
    const clean = entries
      .filter((e) => {
        if (!e.name) return false
        if (e.name.startsWith(".")) return false
        if (e.name === "node_modules") return false
        return true
      })
      .map((e) => ({
        name: e.name,
        path: rel ? `${rel}/${e.name}` : e.name,
        type: e.type === "dir" ? "dir" : "file",
      }))
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    return NextResponse.json({ entries: clean })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    )
  }
}
