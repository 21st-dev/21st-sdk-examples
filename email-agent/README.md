# 21st SDK — Email Agent

Build an email operations copilot that sends intros, reads inbox, and auto-replies using AgentMail.

## What you'll build

A Next.js app with a chat UI and quick-prompt panel that lets you manage email workflows through natural language. The agent connects to [AgentMail](https://agentmail.to) to send, read, and reply to emails.

- **Send intro emails** — draft concise outreach and send it
- **Review inbox** — fetch and summarize recent messages
- **Auto-reply** — respond to the latest inbound or a specific message

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key
- An [AgentMail](https://agentmail.to) account with an API key and inbox ID

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |
| `AGENTMAIL_API_KEY` | 21st dashboard env vars | AgentMail API key for sending and reading emails |
| `AGENTMAIL_INBOX_ID` | 21st dashboard env vars | Your AgentMail sender inbox ID |

> `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID` are set in the 21st dashboard environment variables, not in `.env.local`. They are injected into the agent sandbox at runtime.

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/email-agent
npm install
```

### 2. Deploy the agent

```bash
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
```

After deploying, go to the 21st dashboard and set `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID` in the agent's environment variables section.

### 3. Configure and run

```bash
cp .env.example .env.local
# Add your API_KEY_21ST to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Code walkthrough

### Agent definition (`agents/email-agent.ts`)

Imports tools from a separate `tools.ts` file and sets a system prompt focused on three email workflows:

```typescript
import { agent } from "@21st-sdk/agent"
import { emailAgentTools } from "./tools"

export default agent({
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  maxTurns: 12,
  systemPrompt: `You are an email operations copilot for early-stage teams.
Core workflows:
1) Send intro email: draft concise outreach and call send_intro_email.
2) Review inbox: call read_inbox when user asks to check responses.
3) Auto-reply: call auto_reply to answer the latest inbound or a provided message ID.
Rules:
- Keep responses concise and execution-focused.
- Do not invent product claims or customer facts.
- If required input is missing, ask one targeted question.
- After each send_intro_email call, respond with one short status line.
- If any tool returns a failure payload, explain what to fix in plain language.`,
  tools: emailAgentTools,
})
```

### Tools (`agents/tools.ts`)

Three email operations, each validated with Zod and delegated to the AgentMail client:

```typescript
import { tool } from "@21st-sdk/agent"
import { z } from "zod"
import { getAgentMailConfig } from "./env"
import { readMessages, replyToMessage, sendMessage } from "./agentmail"

export const emailAgentTools = {
  send_intro_email: tool({
    description: "Send an intro/outreach email through AgentMail",
    inputSchema: z.object({
      to: z.string().email(),
      subject: z.string().min(3).max(200),
      text: z.string().min(10),
      html: z.string().optional(),
    }),
    execute: async ({ to, subject, text, html }) => {
      const config = getAgentMailConfig()
      if (!config.ok) return toolTextResult({ sent: false, error: config.error })
      const result = await sendMessage(config, { to, subject, text, html })
      if (!result.ok) return toolTextResult({ sent: false, error: result.error })
      return toolTextResult({ sent: true, to, subject })
    },
  }),

  read_inbox: tool({
    description: "Read recent messages from the configured AgentMail inbox",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional(),
    }),
    execute: async ({ limit = 10 }) => { /* ... */ },
  }),

  auto_reply: tool({
    description: "Auto-reply to a specific or latest inbound message",
    inputSchema: z.object({
      text: z.string().min(3),
      html: z.string().optional(),
      messageId: z.string().optional(),
      replyAll: z.boolean().optional(),
    }),
    execute: async ({ text, html, messageId, replyAll = false }) => { /* ... */ },
  }),
}
```

### Environment handling (`agents/env.ts`)

Checks `process.env` first, then falls back to the sandbox `/home/user/.env` file. The `getAgentMailConfig()` helper validates that both keys are present before making API calls:

```typescript
export type AgentMailConfigResult =
  | { ok: true; apiKey: string; inboxId: string }
  | { ok: false; error: string }

export function getAgentMailConfig(): AgentMailConfigResult {
  const apiKey = getEnv("AGENTMAIL_API_KEY")
  const inboxId = getEnv("AGENTMAIL_INBOX_ID")
  if (!apiKey) return { ok: false, error: "AGENTMAIL_API_KEY is not configured" }
  if (!inboxId) return { ok: false, error: "AGENTMAIL_INBOX_ID is not configured" }
  return { ok: true, apiKey, inboxId }
}
```

### AgentMail client (`agents/agentmail.ts`)

Wraps the AgentMail REST API with typed helper functions for sending, reading, and replying to messages.

## How it works

- **Tool orchestration** — the agent has three tools: `send_intro_email`, `read_inbox`, and `auto_reply`. The system prompt guides the agent to pick the right tool based on user intent.
- **AgentMail integration** — all email operations go through the AgentMail REST API. API keys are loaded from the sandbox environment.
- **Environment handling** — `env.ts` checks `process.env` first, then falls back to the sandbox `/home/user/.env` file.

## Try it out

- "Send an intro email to alice@example.com about our new analytics product"
- "Check my inbox for any new responses"
- "Reply to the latest message with a thank you and next steps"

## Project structure

```
email-agent/
├── agents/
│   ├── email-agent.ts          # Agent config (prompt, model, tool wiring)
│   ├── tools.ts                # Tool schemas + execution orchestration
│   ├── env.ts                  # Env loading (local + sandbox) and validation
│   └── agentmail.ts            # AgentMail API client helpers
├── app/
│   ├── api/agent/token/route.ts   # Server token exchange (API_KEY_21ST stays server-side)
│   ├── page.tsx                # Chat UI + quick prompts panel
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```

## Commands

```bash
npm run dev          # Run dev server
npm run build        # Production build
npm run login        # Authenticate with the platform
npm run deploy       # Deploy the agent
npm run typecheck    # TypeScript type checking
```

## Next steps

- Add more tools (e.g., schedule follow-ups, manage contacts)
- Add skills for email tone and templates — see [Skills](https://21st.dev/agents/docs/skills)
- Learn about agent configuration — see [Build & Deploy](https://21st.dev/agents/docs/agent-projects)
