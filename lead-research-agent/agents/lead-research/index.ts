import { agent, tool } from "@21st-sdk/agent"
import Exa from "exa-js"
import { readFileSync, existsSync } from "fs"
import { z } from "zod"

function getSlackWebhookUrl(): string {
  if (process.env.SLACK_WEBHOOK_URL) return process.env.SLACK_WEBHOOK_URL
  try {
    const envPath = "/home/user/.env"
    if (existsSync(envPath)) {
      const raw = readFileSync(envPath, "utf-8")
      for (const line of raw.split("\n")) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) process.env[match[1].trim()] ??= match[2].trim()
      }
    }
  } catch {}
  return process.env.SLACK_WEBHOOK_URL || ""
}

function readLeadCriteria(): string {
  const paths = [
    "/home/user/skills/lead-criteria.md",
    "skills/lead-criteria.md",
  ]
  for (const p of paths) {
    try {
      if (existsSync(p)) return readFileSync(p, "utf-8")
    } catch {}
  }
  return "Consider: company domain email, technical role, startup/tech company, recent agent deploy."
}

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
  maxTurns: 25,

  systemPrompt: `You are a lead research agent. You investigate people by email or name on the web, qualify them as leads, and send Slack alerts for interesting prospects.

You have built-in WebSearch and WebFetch from Claude Code — use them for web search and fetching URLs. You also have optional exaSearch (better for people/companies) when EXA_API_KEY is set.

WORKFLOW:
1. Call readLeadCriteria to get qualification rules.
2. Search: use exaSearch if available (prefer for people/companies), otherwise use the built-in WebSearch. Queries: "email domain", "name + company", "name LinkedIn", "company about".
3. Use built-in WebFetch to open promising URLs (LinkedIn, company site, GitHub).
4. Decide if the lead is "interesting" based on criteria.
5. If interesting: call sendSlackMessage. Format: name, role, company, why interesting, links. If not interesting: summarize only, do NOT call sendSlackMessage.

OUTPUT: Brief research summary. Only call sendSlackMessage when you find an interesting lead.`,

  tools: {
    exaSearch: tool({
      description:
        "Search the web via Exa.ai (better for people, companies, professional content). Prefer this when EXA_API_KEY is set. Returns rich results.",
      inputSchema: z.object({
        query: z.string().describe("Search query (e.g. 'John Doe Acme CTO LinkedIn')"),
      }),
      execute: async ({ query }) => {
        const key = process.env.EXA_API_KEY
        if (!key) {
          return textResult({
            available: false,
            hint: "Use built-in WebSearch instead. Set EXA_API_KEY in dashboard for Exa.ai.",
          })
        }
        try {
          const exa = new Exa(key)
          const result = await exa.search(query, {
            numResults: 8,
            contents: { text: true },
          })
          const results = (result.results || []).map((r) => ({
            title: r.title ?? undefined,
            url: r.url ?? undefined,
            text: typeof (r as { text?: string }).text === "string" ? (r as { text: string }).text.slice(0, 500) : undefined,
          }))
          return textResult({ results })
        } catch (e) {
          return textResult({ error: String(e) }, true)
        }
      },
    }),

    sendSlackMessage: tool({
      description:
        "Send a Slack alert. Call ONLY when the lead is interesting and qualifies per lead-criteria.",
      inputSchema: z.object({
        text: z.string().describe("Alert message: name, role, company, why interesting, links"),
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

    readLeadCriteria: tool({
      description: "Read the lead qualification criteria from skills/lead-criteria.md.",
      inputSchema: z.object({}),
      execute: async () => {
        const content = readLeadCriteria()
        return textResult({ criteria: content })
      },
    }),
  },

  onError: async ({ error }) => {
    console.error("[lead-research] error:", error)
  },

  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[lead-research] ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
