# 21st SDK — Notion Agent

Build a Notion workspace assistant that searches, reads, creates, and updates pages through natural language.

## What you'll build

A Next.js app with a chat UI where users connect their own Notion integration key and then interact with their workspace. The agent runs as a Claude Code sandbox and calls the Notion API directly via bash.

- **Search pages and databases** — find content across your entire workspace
- **Read page content** — retrieve blocks, properties, and database entries
- **Create pages** — add new pages inside databases or as subpages
- **Update and append** — modify page properties and append new content blocks
- **Per-user key injection** — each user connects with their own Notion integration key; the key is injected into the sandbox at creation time and never stored server-side

## Prerequisites

- Node.js 20+
- A [21st Agents](https://21st.dev/agents) account with an API key
- A [Notion](https://notion.so) account with an integration key (`ntn_...`)

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for sandbox creation and token exchange |
| `NOTION_API_KEY` | Sandbox environment | Injected at sandbox creation via `envs` from the user's UI input; available as `process.env.NOTION_API_KEY` inside the sandbox |

> `NOTION_API_KEY` is injected into the sandbox process environment via the `envs` option when calling `sandboxes.create()`. Do not use the `files` option for this — the platform overwrites `/home/user/.env` with its own relay config after creation.

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/notion-agent
npm install
```

### 2. Deploy the agent

```bash
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
```

### 3. Configure and run

```bash
cp .env.example .env.local
# Add your API_KEY_21ST to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter your Notion integration key, and start chatting.

### 4. Set up your Notion integration

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations) and create a new integration
2. Copy the integration key (`ntn_...`)
3. In Notion, open any page you want the agent to access, click **···** → **Connect to** → select your integration
4. Paste the key into the app's connect form

## Code walkthrough

### Agent definition (`agents/notion-agent.ts`)

Uses `runtime: "claude-code"` so the agent can run bash commands. The Notion API key is read from `process.env.NOTION_API_KEY` — no file parsing needed. All async calls are wrapped in an IIFE because Node 24 rejects top-level `await` in `-e` scripts:

```typescript
import { agent } from "@21st-sdk/agent"

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "bypassPermissions",
  maxTurns: 20,
  systemPrompt: `You are a Notion workspace assistant...

  node -e "(async () => {
    const key = process.env.NOTION_API_KEY;
    const r = await fetch('https://api.notion.com/v1/search', { ... });
    console.log(JSON.stringify(await r.json(), null, 2));
  })()"`,
})
```

### Key injection (`app/api/agent/sandbox/route.ts`)

The Notion API key is sent from the browser to the Next.js server, which injects it as an environment variable at sandbox creation time via the `envs` option. The server never stores it — it lives only inside the sandbox process:

```typescript
const sandbox = await client.sandboxes.create({
  agent: NOTION_AGENT_NAME,
  envs: body.notionApiKey
    ? { NOTION_API_KEY: body.notionApiKey }
    : undefined,
})
const thread = await client.threads.create({ sandboxId: sandbox.id, name: "Notion Chat" })
```

### Token handler (`app/api/agent/token/route.ts`)

Exchanges your server-side `an_sk_` key for a short-lived JWT. The client never sees your API key:

```typescript
import { createTokenHandler } from "@21st-sdk/nextjs/server"

export const POST = createTokenHandler({
  apiKey: process.env.API_KEY_21ST!,
})
```

### Connect form (`app/page.tsx`)

Before the first chat, the user enters their Notion integration key. The key is saved to `localStorage` so returning users don't have to re-enter it. On submit, a new sandbox is created with the key injected:

```typescript
// Save key to localStorage for returning users
localStorage.setItem(NOTION_KEY_STORAGE_KEY, notionApiKey)

// Create sandbox with key injected into filesystem
const res = await fetch("/api/agent/sandbox", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ notionApiKey }),
})
```

## How it works

- **bash-based API calls** — the agent uses `runtime: "claude-code"` to execute `node` one-liners that call the Notion REST API. This avoids custom tools entirely and works reliably on Node 24.
- **Key injection via `envs`** — `client.sandboxes.create({ envs: { NOTION_API_KEY: "..." } })` injects the key directly into the sandbox process environment. The `files` option cannot be used here because the platform overwrites `/home/user/.env` with relay config after sandbox creation.
- **Async IIFE in bash** — Node 24 rejects top-level `await` in `-e` scripts when `require` is also present. All commands wrap async code in `(async () => { ... })()`.
- **Per-session sandboxes** — each chat session gets its own sandbox. The key is scoped to that sandbox and is not shared across sessions.
- **localStorage persistence** — sessions, messages, and the Notion key are persisted locally so the UI survives page reloads.

## Try it out

- "Search for pages about product roadmap"
- "Show me all entries in my Tasks database"
- "Read the content of my Meeting Notes page"
- "Create a new page called 'Q2 Planning' in my Projects database"
- "Add a bullet list to my Weekly Review page"

## Project structure

```
notion-agent/
├── agents/
│   └── notion-agent.ts              # Agent definition (runtime, system prompt, bash examples)
├── app/
│   ├── api/agent/
│   │   ├── sandbox/route.ts         # Creates sandbox with NOTION_API_KEY injected
│   │   ├── threads/route.ts         # Lists and creates threads
│   │   └── token/route.ts           # Token exchange (API_KEY_21ST stays server-side)
│   ├── components/
│   │   └── thread-sidebar.tsx       # Thread navigation sidebar
│   ├── constants.ts                 # NOTION_AGENT_NAME
│   ├── types.ts                     # ChatSession interface
│   ├── globals.css                  # CSS variables and utility classes
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Connect form + chat UI + session management
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

- Add more Notion operations (update page properties, move pages, work with databases)
- Restrict agent capabilities with a `CLAUDE.md` file — see [Skills](https://21st.dev/agents/docs/skills)
- Learn about sandbox environment injection — see [Build & Deploy](https://21st.dev/agents/docs/agent-projects)
