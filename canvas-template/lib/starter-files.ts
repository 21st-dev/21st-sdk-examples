import { promises as fs } from "node:fs"
import path from "node:path"

/**
 * Sandbox working directory where the Next.js app lives.
 * Matches the agent's REPO_DIR constant in agents/canvas-agent.ts.
 */
export const SANDBOX_REPO_DIR = "/home/user/repo"

/**
 * Load all files from sandbox-starter/ as a { "<absolute-path>": "<content>" } map
 * suitable for passing to AgentClient.sandboxes.files.write({ files }).
 *
 * Keys are absolute paths inside the sandbox (e.g. /home/user/repo/package.json).
 */
export async function loadStarterFiles(): Promise<Record<string, string>> {
  const starterRoot = path.join(process.cwd(), "sandbox-starter")
  const out: Record<string, string> = {}

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next") continue
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(abs)
      } else if (entry.isFile()) {
        const rel = path.relative(starterRoot, abs)
        const content = await fs.readFile(abs, "utf-8")
        out[`${SANDBOX_REPO_DIR}/${rel}`] = content
      }
    }
  }

  await walk(starterRoot)
  return out
}
