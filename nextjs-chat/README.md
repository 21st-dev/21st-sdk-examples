# 21st SDK — Next.js Chat Example

Deploy a Claude Code agent with a custom web search tool and connect it to a streaming chat UI.

## What you'll build

A full-stack Next.js app with a streaming chat UI powered by a deployed Claude Code agent. The agent has a custom `search_docs` tool that queries DuckDuckGo for documentation and code references.

- **Real-time streaming** of Claude's responses via SSE
- **Tool calls rendered live** — Bash, Read, Write, Edit, Grep, and your custom tools
- **File diffs, search results, and terminal output** displayed inline
- **Custom `search_docs` tool** fetching web results via DuckDuckGo

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/nextjs-chat
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
# Add your API_KEY_21ST to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Code walkthrough

### Agent definition (`agents/my-agent.ts`)

The agent uses Claude Sonnet with a custom `search_docs` tool that hits the DuckDuckGo instant-answer API:

```typescript
import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

export default agent({
  model: "claude-sonnet-4-6",
  systemPrompt: "You are a helpful coding assistant.",
  tools: {
    search_docs: tool({
      description: "Search documentation or code references on the web",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
      }),
      execute: async ({ query }) => {
        const { execSync } = await import("child_process")
        try {
          const result = execSync(
            `curl -s "https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json"`,
            { encoding: "utf-8", timeout: 10_000 },
          )
          const data = JSON.parse(result)
          const text =
            data.AbstractText ||
            data.RelatedTopics?.slice(0, 3)
              .map((t: any) => t.Text)
              .join("\n") ||
            "No results found."
          return { content: [{ type: "text", text }] }
        } catch {
          return {
            content: [{ type: "text", text: "Search failed." }],
            isError: true,
          }
        }
      },
    }),
  },
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

Uses `createAgentChat()` to create a chat session, then renders the conversation with `<AgentChat>`:

- **Token exchange** — the Next.js API route at `/api/agent/token` exchanges your key for a JWT
- **Chat session** — `createAgentChat()` connects to the deployed agent via the relay
- **Streaming** — responses stream in real time, tool calls render live as they execute

## Try it out

- "Search for the latest Next.js middleware docs"
- "Find examples of using Zod with tRPC"
- "What is the recommended way to handle auth in Next.js 15?"

## Project structure

```
nextjs-chat/
├── agents/
│   └── my-agent.ts            # Agent definition (deploy this)
├── app/
│   ├── api/agent/
│   │   ├── sandbox/route.ts   # Creates/caches agent sandboxes
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

## Next steps

- Add more tools to the agent — see [Build & Deploy](https://21st.dev/agents/docs/agent-projects)
- Customize the chat theme — see [Themes](https://21st.dev/agents/docs/customization)
- Add behavior rules with skills — see [Skills](https://21st.dev/agents/docs/skills)
