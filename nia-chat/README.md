# Nia Chat

A Next.js example that lets users chat about GitHub repositories using a deployed agent with Nia knowledge tools.

## How it works

1. User enters a GitHub repo → the app indexes it via the Nia API (`/api/nia/source`)
2. A sandbox + thread is created for the agent (`/api/agent/sandbox`)
3. The frontend connects to the agent using `createAgentChat` + `useChat` and streams responses

The agent runs inside a sandbox with [Nia skill scripts](https://docs.trynia.ai/integrations/installation/skill) (shell wrappers around the Nia REST API) baked in at deploy time. This gives it the ability to search, read, and explore the indexed repository.

## Requirements

- Node.js 18+
- `API_KEY_21ST` — from [21st.dev](https://21st.dev/agents/api-keys)
- `NIA_API_KEY` — Nia API key
- deployed `nia-agent-v2`

`NIA_API_KEY` must exist both in `.env.local` (for the Next.js server to resolve/index repos) and in the deployed sandbox environment (for the Nia skill scripts).

## Quick start

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/nia-chat
cp .env.example .env.local
pnpm install
```

Set `API_KEY_21ST` and `NIA_API_KEY` in `.env.local`, then deploy and run:

```bash
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Key files

| File | What it does |
|------|-------------|
| `agents/nia-agent-v2/index.ts` | Agent definition — model, system prompt, sandbox setup (`curl`/`jq` install). Uses `@21st-sdk/agent`. |
| `agents/nia-agent-v2/template/.claude/skills/nia/` | Nia skill scripts baked into the sandbox. Shell wrappers for search, read, explore, etc. |
| `app/api/nia/source/route.ts` | Normalizes the repo input, then resolves (or indexes) it via the Nia SDK. |
| `app/api/agent/sandbox/route.ts` | Creates a sandbox + thread via `AgentClient` from `@21st-sdk/node`. |
| `app/api/agent/token/route.ts` | Token endpoint using `createTokenHandler` from `@21st-sdk/nextjs/server` — needed for streaming auth. |
| `app/api/agent/threads/route.ts` | Lists/creates threads within a sandbox for multi-thread sessions. |
| `app/page.tsx` | Main UI — repo picker, chat panel (`createAgentChat` + `useChat`), thread sidebar. Sessions persist in `localStorage`. |

## Building something similar

The core pattern is:

1. **Define your agent** with `@21st-sdk/agent` — set the model, system prompt, and any tools/skills to include in the template directory.
2. **Deploy** with `npx @21st-sdk/cli deploy` to bake the template into the sandbox image.
3. **Create API routes** for sandbox/thread management (`AgentClient`) and a token endpoint (`createTokenHandler`).
4. **Connect the frontend** with `createAgentChat()` bound to a sandbox + thread, then pass it to `useChat()` from `@ai-sdk/react` for streaming.

To add external knowledge (like Nia), index sources server-side before the chat starts, then give the agent skill scripts or MCP tools so it can query those sources at runtime.
