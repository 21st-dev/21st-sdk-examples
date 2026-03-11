# 21st SDK — Nia Chat Example

Deploy a Claude Code agent with Nia MCP and connect it to the existing `nextjs-chat` streaming UI.

## What you'll build

A full-stack Next.js app with the same streaming chat UI as `nextjs-chat`, but with an agent configured to use Nia MCP for GitHub repository analysis.

- **Same chat UI** and thread sidebar as `nextjs-chat`
- **Real-time streaming** of Claude's responses via SSE
- **MCP-backed repo analysis** through Nia's local MCP server
- **No custom web-search tool** in the agent code

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |
| `NIA_API_KEY` | `.env.local` | API key used by the Next.js server via `nia-ai-ts` to resolve/create the repository before chat starts |
| `NIA_API_KEY` | 21st dashboard env vars | Exposed inside the deployed agent sandbox for the local `nia-mcp-server` process |

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/nia-chat
npm install
```

### 2. Deploy the agent

```bash
npx @21st-sdk/cli login    # paste your an_sk_ API key
npx @21st-sdk/cli deploy   # deploys agents/ to 21st cloud
```

The CLI bundles everything in `agents/` and deploys it to 21st cloud. Your agent gets a unique ID you can reference from the client.

### 3. Configure and run

```bash
cp .env.example .env.local
# Add your API_KEY_21ST and NIA_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Code walkthrough

### Agent definition (`agents/nia-agent.ts`)

The agent writes `/home/user/.mcp.json` through `Sandbox({ files })`, which is how 21st's Claude Code runtime discovers MCP servers. Nia is configured as a local command-based MCP server:

```typescript
import { agent, Sandbox } from "@21st-sdk/agent"

const mcpConfig = JSON.stringify({
  mcpServers: {
    nia: {
      command: "pipx",
      args: ["run", "--no-cache", "nia-mcp-server"],
      env: {
        NIA_API_URL: "https://apigcp.trynia.ai/",
      },
    },
  },
}, null, 2)

export default agent({
  runtime: "claude-code",
  model: "claude-haiku-4-5",
  permissionMode: "bypassPermissions",
  sandbox: Sandbox({
    apt: ["python3", "python3-venv", "pipx"],
    build: ["python3 --version", "pipx --version"],
    files: {
      "/home/user/.mcp.json": mcpConfig,
    },
  }),
  systemPrompt: "You are a GitHub repository analysis assistant.",
  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[agent] Done: ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
```

### Token handler (`app/api/agent/token/route.ts`)

Exchanges your server-side `an_sk_` key for a short-lived JWT. The client never sees your API key:

```typescript
import { createTokenHandler } from "@21st-sdk/nextjs/server"

export const POST = createTokenHandler({
  apiKey: process.env.API_KEY_21ST!,
})
```

### Chat UI (`app/page.tsx`)

Starts with a required repository form. The Next.js server uses `nia-ai-ts` to resolve or create the repository source first, and only then creates one fresh sandbox and one fresh thread for that chat.

- **Token exchange** — the Next.js API route at `/api/agent/token` exchanges your key for a JWT
- **Repository step** — `/api/nia/source` uses `NiaSDK`, `sources.resolve()`, and `sources.create()` before chat starts
- **Chat session** — each chat gets exactly one sandbox and one thread, and `createAgentChat()` connects only after that session is created
- **Streaming** — responses stream in real time, tool calls render live as they execute

## Try it out

- "Analyze https://github.com/vercel/ai and explain the main folders"
- "Which files implement the chat transport in https://github.com/vercel/ai?"
- "Find the auth flow in owner/repo and summarize it"

## Project structure

```
nia-chat/
├── agents/
│   └── nia-agent.ts           # Agent definition (deploy this)
├── app/
│   ├── api/agent/
│   │   ├── sandbox/route.ts   # Creates one sandbox + one thread per chat
│   │   ├── threads/route.ts   # Creates/lists chat threads
│   │   └── token/route.ts     # Token handler (server-side)
│   ├── components/
│   │   └── thread-sidebar.tsx # Thread navigation
│   ├── page.tsx               # Chat UI (client-side)
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```

## Notes

- This app keeps the same UI structure as `nextjs-chat` on purpose.
- `pipx` availability is handled in the agent sandbox config, not in the Next.js app. `apt` installs `python3`, `python3-venv`, and `pipx`, and `build` verifies that `pipx` is present before sandboxes are created.
- Nia availability for a repo depends on what Nia can access/index in the current session.
- If you want repo onboarding before chat starts, add a server route that calls Nia's indexing API first.
