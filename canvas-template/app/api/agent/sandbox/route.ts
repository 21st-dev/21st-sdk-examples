import { AgentClient } from "@21st-sdk/node"
import { NextResponse } from "next/server"
import { loadStarterFiles, SANDBOX_REPO_DIR } from "@/lib/starter-files"

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

/**
 * POST /api/agent/sandbox
 *
 * Creates a fresh sandbox for the canvas agent, seeds it with the Next.js
 * starter under /home/user/repo, installs dependencies, and returns the
 * sandboxId. This takes ~60-120s on first call because `npm install` runs.
 */
export async function POST() {
  try {
    const c = getClient()

    console.log("[sandbox] Creating sandbox for", AGENT_SLUG)
    const sandbox = await c.sandboxes.create({
      agent: AGENT_SLUG,
      // E2B sandbox default env has a non-standard NODE_ENV that confuses
      // `next dev`. Override it explicitly so the dev server behaves normally.
      envs: { NODE_ENV: "development" },
    })
    console.log(`[sandbox] Created: ${sandbox.id}`)

    const files = await loadStarterFiles()
    console.log(`[sandbox] Writing ${Object.keys(files).length} starter files...`)
    await c.sandboxes.files.write({ sandboxId: sandbox.id, files })

    console.log("[sandbox] Installing dependencies (npm install)...")
    const installResult = await c.sandboxes.exec({
      sandboxId: sandbox.id,
      command: "npm install --no-audit --no-fund --loglevel=error",
      cwd: SANDBOX_REPO_DIR,
      // devDependencies must be installed (typescript types, etc) — so we set
      // NODE_ENV=development here too, otherwise npm skips them.
      envs: { NODE_ENV: "development" },
      timeoutMs: 240_000,
    })
    if (installResult.exitCode !== 0) {
      console.error("[sandbox] npm install failed:", installResult.stderr.slice(0, 2000))
      return NextResponse.json(
        {
          error: "npm install failed",
          stderr: installResult.stderr.slice(0, 4000),
        },
        { status: 500 },
      )
    }

    console.log(`[sandbox] Ready: ${sandbox.id}`)
    return NextResponse.json({
      sandboxId: sandbox.id,
      e2bId: sandbox.sandboxId,
    })
  } catch (error) {
    console.error("[sandbox] Failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
