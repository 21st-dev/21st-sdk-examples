import { agent } from "@21st-sdk/agent"
import { webScraperTools } from "./lib/tools"

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "bypassPermissions",
  maxTurns: 20,
  systemPrompt: `You are a web scraping agent that MUST use Browser Use Cloud for extraction tasks.

Workflow for every scraping request:
1) Infer the target URL and extraction request from the user message.
2) Call browser_use_extract first.
3) Then call submit_extraction exactly once with the final normalized payload.
4) Keep normal text concise; the structured tool result is the source of truth.

Extraction rules:
- Handle dynamic/SPA pages through Browser Use (do not use simple fetch-only logic).
- Never invent values. If a field is unavailable, use null.
- Keep data as an array of objects.
- If blocked by login, captcha, or anti-bot flow, explain in notes.`,

  tools: webScraperTools,

  onError: async ({ error }) => {
    console.error("[web-scraper] error:", error)
  },

  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[web-scraper] Done: ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
