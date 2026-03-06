import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"

function getSlackWebhookUrl(): string {
  if (process.env.SLACK_WEBHOOK_URL) return process.env.SLACK_WEBHOOK_URL
  try {
    const raw = readFileSync("/home/user/.env", "utf-8")
    for (const line of raw.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) process.env[match[1].trim()] ??= match[2].trim()
    }
  } catch {}
  return process.env.SLACK_WEBHOOK_URL || ""
}

/** Converts a service name to a filesystem-safe slug. */
function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-")
}

/** Wraps a value as an MCP-compatible text content result. */
function textResult(data: object, isError?: boolean) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    ...(isError && { isError: true }),
  }
}

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "bypassPermissions",
  maxTurns: 20,

  systemPrompt: `You are a status monitoring agent. You check service health via Atlassian Statuspage APIs, detect changes against stored snapshots, and send Slack alerts when status changes.

IMPORTANT: You must check EXACTLY these 4 services and NO others:
1. Vercel     → https://www.vercel-status.com/api/v2/broken.json  (intentionally broken endpoint to demo Slack alerts)
2. GitHub     → https://www.githubstatus.com/api/v2/status.json
3. Cloudflare → https://www.cloudflarestatus.com/api/v2/status.json
4. Supabase   → https://status.supabase.com/api/v2/status.json

Do NOT add, invent, or check any other services. Only these 4.
Vercel will always return "unknown" — this is intentional for testing the Slack alert flow.

For each service: fetchStatus → readSnapshot → compare → sendSlackMessage (only on change) → saveSnapshot.

Refer to your skills for comparison rules, snapshot format, and alert formatting.

Reply with ONLY a compact status table — no prose, no greetings, no explanations.
If Slack is not configured, note "Slack alerts disabled" at the end.`,

  tools: {
    fetchStatus: tool({
      description:
        "Fetch JSON status from an Atlassian Statuspage endpoint.",
      inputSchema: z.object({
        url: z.string().url().describe("Status page JSON endpoint URL"),
        serviceName: z.string().describe("Human-readable service name"),
      }),
      execute: async ({ url, serviceName }) => {
        try {
          const res = await fetch(url)
          if (!res.ok) {
            return textResult({ error: `HTTP ${res.status}`, serviceName }, true)
          }
          const data = await res.json()
          return textResult({ serviceName, ...data })
        } catch (e) {
          return textResult({ error: String(e), serviceName }, true)
        }
      },
    }),

    readSnapshot: tool({
      description:
        "Read the previous status snapshot for a service. Returns null if no snapshot exists.",
      inputSchema: z.object({
        serviceName: z.string().describe("Service name (e.g. 'vercel', 'github')"),
      }),
      execute: async ({ serviceName }) => {
        const slug = toSlug(serviceName)
        const path = `snapshots/${slug}.json`
        try {
          if (!existsSync(path)) {
            return textResult({ exists: false, serviceName: slug })
          }
          const data = JSON.parse(readFileSync(path, "utf-8"))
          return textResult({ exists: true, serviceName: slug, ...data })
        } catch {
          return textResult({ exists: false, serviceName: slug })
        }
      },
    }),

    saveSnapshot: tool({
      description:
        "Save a status snapshot so future checks can detect changes.",
      inputSchema: z.object({
        serviceName: z.string().describe("Service name (e.g. 'vercel', 'github')"),
        indicator: z
          .enum(["none", "minor", "major", "critical", "unknown"])
          .describe("Status indicator from the Statuspage API"),
        components: z
          .array(z.object({ name: z.string(), status: z.string() }))
          .optional()
          .describe("Component-level statuses if available"),
      }),
      execute: async ({ serviceName, indicator, components }) => {
        const slug = toSlug(serviceName)
        mkdirSync("snapshots", { recursive: true })
        const snapshot = {
          indicator,
          components: components || [],
          checkedAt: new Date().toISOString(),
        }
        const path = `snapshots/${slug}.json`
        writeFileSync(path, JSON.stringify(snapshot, null, 2))
        return textResult({ saved: true, path })
      },
    }),

    sendSlackMessage: tool({
      description:
        "Send a Slack alert. Use ONLY when status has changed from the previous snapshot.",
      inputSchema: z.object({
        text: z.string().describe("Alert message text (plain text, no markdown)"),
      }),
      execute: async ({ text }) => {
        const webhookUrl = getSlackWebhookUrl()
        if (!webhookUrl) {
          return textResult({ sent: false, error: "SLACK_WEBHOOK_URL not configured" }, true)
        }
        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          })
          return textResult({ sent: res.ok })
        } catch (e) {
          return textResult({ sent: false, error: String(e) }, true)
        }
      },
    }),
  },

  onError: async ({ error }) => {
    console.error("[monitor] error:", error)
  },

  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[monitor] ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
