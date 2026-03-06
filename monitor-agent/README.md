# Status Monitor Agent

Build an autonomous service health monitor that checks Statuspage APIs, detects outages, and sends Slack alerts — built with [21st SDK](https://21st.dev/agents).

No database. No cron jobs. No frontend. Just deploy and say `check all`.

> This is a CLI-only agent — there is no frontend. After deploying, you interact with the agent in the 21st dashboard chat.

## What you'll build

- **4 tools** — `fetchStatus`, `readSnapshot`, `saveSnapshot`, `sendSlackMessage`
- **Monitors** Vercel, GitHub, Cloudflare, and Supabase via Atlassian Statuspage APIs
- **Snapshot-based change detection** — alerts only fire on status changes
- **Slack webhook alerts** (optional)
- **Skills as markdown files** — monitoring strategy and alert format, no recompile needed
- **CLAUDE.md guardrails** — restricts the agent to its 4 tools

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key
- A Slack workspace with an [incoming webhook](https://api.slack.com/messaging/webhooks) (optional, for alerts)

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `SLACK_WEBHOOK_URL` | 21st dashboard env vars | Slack incoming webhook URL (optional) |

> No `.env.local` is needed for this example. The agent runs entirely in the 21st dashboard — environment variables are set there.

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/monitor-agent
npm install
```

### 2. Deploy

```bash
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
```

That's it. Open the agent in your [21st dashboard](https://21st.dev/agents) and type `check all`.

### 3. Add Slack alerts (optional)

1. Go to [Slack API → Apps](https://api.slack.com/apps) → **Create New App** → From scratch
2. Enable **Incoming Webhooks** → **Add New Webhook to Workspace**
3. Copy the webhook URL
4. Set it in the **21st dashboard** → your agent → **Environment Variables**:

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

5. Redeploy: `npm run deploy`

## Code walkthrough

### Agent definition (`agents/agent.ts`)

The entire agent — model, tools, and system prompt — is defined in a single file. Tools are defined inline:

```typescript
import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "bypassPermissions",
  maxTurns: 20,
  systemPrompt: `You are a status monitoring agent. Check these 4 services:
1. Vercel     → https://www.vercel-status.com/api/v2/broken.json
2. GitHub     → https://www.githubstatus.com/api/v2/status.json
3. Cloudflare → https://www.cloudflarestatus.com/api/v2/status.json
4. Supabase   → https://status.supabase.com/api/v2/status.json

For each: fetchStatus → readSnapshot → compare → sendSlackMessage (only on change) → saveSnapshot.`,
  tools: {
    fetchStatus: tool({
      description: "Fetch JSON status from an Atlassian Statuspage endpoint.",
      inputSchema: z.object({
        url: z.string().url(),
        serviceName: z.string(),
      }),
      execute: async ({ url, serviceName }) => {
        const res = await fetch(url)
        if (!res.ok) return textResult({ error: `HTTP ${res.status}`, serviceName }, true)
        const data = await res.json()
        return textResult({ serviceName, ...data })
      },
    }),
    readSnapshot: tool({
      description: "Read the previous status snapshot for a service.",
      inputSchema: z.object({ serviceName: z.string() }),
      execute: async ({ serviceName }) => {
        const path = `snapshots/${toSlug(serviceName)}.json`
        if (!existsSync(path)) return textResult({ exists: false })
        return textResult({ exists: true, ...JSON.parse(readFileSync(path, "utf-8")) })
      },
    }),
    saveSnapshot: tool({
      description: "Save a status snapshot for change detection.",
      inputSchema: z.object({
        serviceName: z.string(),
        indicator: z.enum(["none", "minor", "major", "critical", "unknown"]),
        components: z.array(z.object({ name: z.string(), status: z.string() })).optional(),
      }),
      execute: async ({ serviceName, indicator, components }) => {
        mkdirSync("snapshots", { recursive: true })
        const snapshot = { indicator, components: components || [], checkedAt: new Date().toISOString() }
        writeFileSync(`snapshots/${toSlug(serviceName)}.json`, JSON.stringify(snapshot, null, 2))
        return textResult({ saved: true })
      },
    }),
    sendSlackMessage: tool({
      description: "Send a Slack alert. Use ONLY when status has changed.",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        const webhookUrl = getSlackWebhookUrl()
        if (!webhookUrl) return textResult({ sent: false, error: "SLACK_WEBHOOK_URL not configured" }, true)
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })
        return textResult({ sent: res.ok })
      },
    }),
  },
})
```

> The Vercel endpoint intentionally uses `broken.json` instead of `status.json` to demonstrate the `unknown` status and Slack alerting flow.

## How it works

1. **`an deploy`** bundles your TypeScript with esbuild and uploads it to 21st
2. 21st creates an **E2B sandbox** — an isolated environment with Node.js and your code
3. When you send a message, the **relay runtime** routes it to the sandbox
4. The agent executes tools in the sandbox, streams responses back via SSE
5. **Snapshots** are persisted to the sandbox filesystem between runs

## Monitored services

| Service    | Status Page | Notes |
|------------|-------------|-------|
| Vercel     | vercelstatus.com | Intentionally broken endpoint — always returns `unknown` |
| GitHub     | githubstatus.com | |
| Cloudflare | cloudflarestatus.com | |
| Supabase   | status.supabase.com | |

Any service using Atlassian Statuspage works — just add the URL to `skills/monitoring-strategy.md`.

## Try it out

- "check all"
- "check only GitHub and Cloudflare"
- "what was the last status for Vercel?"

> On the first run, every service triggers a "status changed" alert since there are no previous snapshots. On subsequent runs, only actual changes trigger alerts.

## Customization

### Add a service

Edit `skills/monitoring-strategy.md` and add a row to the table. No code changes — just redeploy.

### Change the alert format

Edit `skills/alert-format.md` — modify emoji mappings, Slack message structure, or output rules.

### Use Discord / Teams / PagerDuty instead of Slack

Replace the `fetch()` call inside `sendSlackMessage` in `agents/agent.ts`. The interface is simple — just swap the webhook URL and payload format.

## Project structure

```
monitor-agent/
├── agents/
│   └── agent.ts              # Agent config — model, tools, system prompt
├── skills/
│   ├── monitoring-strategy.md # Service list, endpoints, comparison rules
│   └── alert-format.md       # Emoji mappings, chat + Slack output format
├── CLAUDE.md                  # Guardrails — restricts agent to its 4 tools
├── package.json
├── tsconfig.json
└── .env.example
```

## Commands

```bash
npm run deploy      # Bundle and deploy to 21st
npm run login       # Authenticate with your 21st API key
npm run typecheck   # Run TypeScript type checking
```

## Next steps

- Add a service — edit `skills/monitoring-strategy.md`
- Learn more about skills — see [Skills](https://21st.dev/agents/docs/skills)
- [21st Docs](https://21st.dev/agents/docs)
- [21st Dashboard](https://21st.dev/agents)
