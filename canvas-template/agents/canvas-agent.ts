import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"
import { promises as fs } from "node:fs"
import path from "node:path"
import { spawn, execSync } from "node:child_process"

/**
 * Canvas Agent — a coding agent that edits a Next.js app in its sandbox.
 *
 * Runs inside a 21st-provisioned E2B sandbox. The sandbox is pre-populated
 * with a Next.js starter at /home/user/repo on creation (see /api/agent/sandbox).
 *
 * All tools operate under /home/user/repo. Paths are validated to prevent
 * escapes.
 */

const REPO_DIR = "/home/user/repo"
const DEFAULT_CMD_TIMEOUT_MS = 60_000
const MAX_OUTPUT_CHARS = 8_000

function resolveRepoPath(relPath: string): string {
  if (!relPath) throw new Error(`Invalid path: ${relPath}`)
  const normalized = relPath.replace(/^\/+/, "")
  for (const part of normalized.split("/")) {
    if (part === "" || part === "." || part === "..") {
      throw new Error(`Invalid path: ${relPath}`)
    }
  }
  const abs = path.resolve(REPO_DIR, normalized)
  if (!abs.startsWith(REPO_DIR + path.sep) && abs !== REPO_DIR) {
    throw new Error(`Path escapes repo: ${relPath}`)
  }
  return abs
}

function truncate(s: string, max = MAX_OUTPUT_CHARS): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n\n[... truncated ${s.length - max} chars]`
}

function runShell(
  command: string,
  opts: { cwd?: string; timeoutMs?: number; background?: boolean } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number; pid?: number }> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["-lc", command], {
      cwd: opts.cwd ?? REPO_DIR,
      env: process.env,
      detached: opts.background,
      stdio: opts.background ? ["ignore", "ignore", "ignore"] : ["ignore", "pipe", "pipe"],
    })
    if (opts.background) {
      child.unref()
      resolve({ stdout: "", stderr: "", exitCode: 0, pid: child.pid })
      return
    }
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      resolve({
        stdout,
        stderr: stderr + `\n[timed out after ${opts.timeoutMs ?? DEFAULT_CMD_TIMEOUT_MS}ms]`,
        exitCode: 124,
      })
    }, opts.timeoutMs ?? DEFAULT_CMD_TIMEOUT_MS)
    child.stdout?.on("data", (d) => (stdout += d.toString()))
    child.stderr?.on("data", (d) => (stderr += d.toString()))
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })
  })
}

export default agent({
  model: "claude-sonnet-4-6",
  maxTurns: 100,
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: `You are the Canvas Agent — a coding agent that edits a Next.js app.

The app lives at /home/user/repo. It's already scaffolded with Next.js 15 + React 19 + Tailwind CSS and dependencies are installed.

Your workflow:
1. Use list_files / read_file to explore the repo.
2. Use write_file / edit_file to make changes.
3. Use start_dev_server once, early, so the user can see your work in the preview panel.
4. After editing, verify the app still compiles (run bash with \`npx tsc --noEmit\` or check dev server logs).
5. Keep answers short. Let the code speak.

When the user's message contains a <canvas-state> block, it's metadata about shapes they drew on the canvas — use it as context for what UI they want.

Style rules:
- Always use Tailwind classes (already configured).
- Components go under app/ as server components unless interactivity is needed.
- No inline styles unless absolutely necessary.
`,
  },

  tools: {
    list_files: tool({
      description:
        "List files and directories inside the repo. Use this to explore structure before reading/editing.",
      inputSchema: z.object({
        path: z
          .string()
          .default(".")
          .describe("Relative path from repo root. Use '.' for root."),
      }),
      execute: async ({ path: relPath }) => {
        try {
          const abs = relPath === "." ? REPO_DIR : resolveRepoPath(relPath)
          const entries = await fs.readdir(abs, { withFileTypes: true })
          const lines = entries
            .filter((e) => !e.name.startsWith(".") && e.name !== "node_modules")
            .sort((a, b) => {
              if (a.isDirectory() !== b.isDirectory())
                return a.isDirectory() ? -1 : 1
              return a.name.localeCompare(b.name)
            })
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          return {
            content: [{ type: "text", text: lines.join("\n") || "(empty)" }],
          }
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
            isError: true,
          }
        }
      },
    }),

    read_file: tool({
      description: "Read the contents of a file in the repo.",
      inputSchema: z.object({
        path: z.string().describe("Relative path from repo root."),
      }),
      execute: async ({ path: relPath }) => {
        try {
          const abs = resolveRepoPath(relPath)
          const content = await fs.readFile(abs, "utf-8")
          return { content: [{ type: "text", text: truncate(content) }] }
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
            isError: true,
          }
        }
      },
    }),

    write_file: tool({
      description:
        "Create or overwrite a file in the repo. Creates parent directories as needed.",
      inputSchema: z.object({
        path: z.string().describe("Relative path from repo root."),
        content: z.string().describe("Full file content."),
      }),
      execute: async ({ path: relPath, content }) => {
        try {
          const abs = resolveRepoPath(relPath)
          await fs.mkdir(path.dirname(abs), { recursive: true })
          await fs.writeFile(abs, content, "utf-8")
          return {
            content: [
              {
                type: "text",
                text: `Wrote ${relPath} (${content.length} chars)`,
              },
            ],
          }
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
            isError: true,
          }
        }
      },
    }),

    edit_file: tool({
      description:
        "Exact string replacement in a file. old_string must be unique in the file or the call fails.",
      inputSchema: z.object({
        path: z.string(),
        old_string: z.string().describe("Exact text to find (must appear exactly once)."),
        new_string: z.string().describe("Replacement text."),
      }),
      execute: async ({ path: relPath, old_string, new_string }) => {
        try {
          const abs = resolveRepoPath(relPath)
          const before = await fs.readFile(abs, "utf-8")
          const occurrences = before.split(old_string).length - 1
          if (occurrences === 0) {
            return {
              content: [{ type: "text", text: `old_string not found in ${relPath}` }],
              isError: true,
            }
          }
          if (occurrences > 1) {
            return {
              content: [
                {
                  type: "text",
                  text: `old_string appears ${occurrences} times in ${relPath}; make it unique first`,
                },
              ],
              isError: true,
            }
          }
          const after = before.replace(old_string, new_string)
          await fs.writeFile(abs, after, "utf-8")
          return { content: [{ type: "text", text: `Edited ${relPath}` }] }
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
            isError: true,
          }
        }
      },
    }),

    bash: tool({
      description:
        "Run a shell command inside the repo. Use for git, npm install, type-check, running scripts. Not for starting servers — use start_dev_server for that.",
      inputSchema: z.object({
        command: z.string().describe("Shell command to run."),
        timeoutMs: z
          .number()
          .optional()
          .describe("Timeout in ms. Default 60s."),
      }),
      execute: async ({ command, timeoutMs }) => {
        const result = await runShell(command, { timeoutMs })
        const out =
          `exit=${result.exitCode}\n\n--- stdout ---\n${result.stdout}\n\n--- stderr ---\n${result.stderr}`
        return {
          content: [{ type: "text", text: truncate(out) }],
          isError: result.exitCode !== 0,
        }
      },
    }),

    grep: tool({
      description: "Search file contents with ripgrep. Returns matching lines with file:line prefix.",
      inputSchema: z.object({
        pattern: z.string().describe("Regex pattern."),
        path: z.string().default(".").describe("Relative path to search in."),
        glob: z.string().optional().describe("Optional glob filter, e.g. '*.tsx'."),
      }),
      execute: async ({ pattern, path: relPath, glob }) => {
        try {
          const target = relPath === "." ? REPO_DIR : resolveRepoPath(relPath)
          const globArg = glob ? `-g '${glob}'` : ""
          const cmd = `rg --line-number --no-heading ${globArg} -- ${JSON.stringify(pattern)} ${JSON.stringify(target)}`
          const result = await runShell(cmd, { timeoutMs: 15_000 })
          const text = result.stdout || "(no matches)"
          return { content: [{ type: "text", text: truncate(text) }] }
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
            isError: true,
          }
        }
      },
    }),

    start_dev_server: tool({
      description:
        "Start (or restart) the Next.js dev server on port 3000. Safe to call repeatedly — always kills any existing server first. Returns once the server answers HTTP. The user's UI attaches a preview iframe automatically.",
      inputSchema: z.object({}),
      execute: async () => {
        try {
          // Always start from a clean state: kill anything on 3000 and any lingering next-server.
          await runShell(
            "pkill -f 'next dev' 2>/dev/null; pkill -f 'next-server' 2>/dev/null; fuser -k 3000/tcp 2>/dev/null; sleep 1; true",
            { timeoutMs: 10_000 },
          )

          // Start the dev server detached. We explicitly set NODE_ENV=development
          // because the E2B sandbox ships with a non-standard NODE_ENV value
          // that makes Next.js behave like production (skips PostCSS, looks for
          // build artifacts that don't exist).
          // setsid + nohup + & so the server survives this tool's shell exit.
          await runShell(
            `rm -rf .next /tmp/next-dev.log; NODE_ENV=development setsid nohup npm run dev </dev/null >/tmp/next-dev.log 2>&1 &`,
            { background: true },
          )

          // Poll HTTP — does NOT rely on lsof (not installed in E2B default image).
          const deadline = Date.now() + 45_000
          let lastCode = "0"
          while (Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 1500))
            const probe = await runShell(
              "curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3000/ 2>&1 || echo 000",
              { timeoutMs: 5_000 },
            )
            lastCode = probe.stdout.trim()
            // Any 2xx/3xx/4xx from Next.js means the server is accepting — even a 404 on / is fine.
            if (/^[234]\d\d$/.test(lastCode)) {
              return {
                content: [
                  {
                    type: "text",
                    text: `Dev server is up on port 3000 (HTTP ${lastCode}). Preview is now live.`,
                  },
                ],
              }
            }
          }

          const logs = await runShell("tail -n 60 /tmp/next-dev.log 2>/dev/null || echo '(no log)'", {
            timeoutMs: 5_000,
          })
          return {
            content: [
              {
                type: "text",
                text: `Dev server failed to answer within 45s (last code: ${lastCode}).\n\n--- /tmp/next-dev.log ---\n${logs.stdout}`,
              },
            ],
            isError: true,
          }
        } catch (err) {
          return {
            content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
            isError: true,
          }
        }
      },
    }),
  },

  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[canvas-agent] ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
