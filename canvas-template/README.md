# 21st SDK — Canvas Template

An AI canvas built on the [21st SDK](https://21st.dev/agents) — a coding agent that lives in an E2B sandbox, edits a Next.js app from chat, and streams the live preview back into an iframe. Split layout: chat on the left, live app on the right.

**Demo-first:** a minimal Next.js starter is pre-seeded into every sandbox. No repo clone, no boilerplate — the agent writes the app.

---

## What you'll build

- **Agent**: a Claude coding agent (`canvas-agent.ts`) with filesystem + bash access scoped to `/home/user/repo` inside an E2B sandbox
- **UI**: two-pane layout — `ChatPanel` (`@21st-sdk/react`) + iframe preview of the sandbox's dev server
- **Sandbox lifecycle**: one E2B sandbox per session, pre-seeded from `sandbox-starter/`, `npm install`-ed on first call (~90s), Next dev server starts on port 3000 and is proxied out as a public URL
- **Pattern**: the agent doesn't render a predefined artifact — it writes arbitrary code. The host app just chat + iframe.

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key (`an_sk_...`)

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/21st-sdk-examples.git
cd 21st-sdk-examples/canvas-template
npm install
```

### 2. Configure

```bash
cp .env.example .env.local
# Put your API_KEY_21ST in .env.local
```

### 3. Deploy the agent

```bash
npx @21st-sdk/cli login
npm run agent:deploy
```

`agent:deploy` wraps `npx @21st-sdk/cli deploy agents/canvas-agent.ts --name canvas-agent`. Re-run it every time you change `agents/canvas-agent.ts`.

### 4. Run the host app

```bash
npm run dev
# open http://localhost:3000
# first sandbox creation is ~90s (npm install inside the sandbox)
```

## Architecture

```
┌──────────── browser ────────────┐
│  ChatPanel    PreviewPanel      │
│    │              │             │
│    ▼              ▼             │
│  /api/chat    /api/preview      │
└────┬──────────────┬──────────────┘
     │              │
     ▼              ▼
  AgentClient (@21st-sdk/node) ──▶ relay.21st.dev ──▶ E2B sandbox
                                                    ├─ /home/user/repo  (Next.js starter)
                                                    └─ canvas-agent     (Claude Code runtime)
```

- `/api/agent/sandbox` — creates a sandbox, writes `sandbox-starter/` files, runs `npm install`. ~90s cold, cached per session.
- `/api/agent/threads` — creates a conversation thread inside a sandbox.
- `/api/chat` — proxies `client.threads.run()`. Injects per-message state (e.g. tldraw shapes) via `options.systemPrompt.append`.
- `/api/preview` — resolves the E2B public URL for port 3000 and probes it until the dev server is up.

## The agent's tools

| Tool | What it does |
|------|--------------|
| `run_shell({ cmd })` | Runs a bash command inside the sandbox. Used for `npm install`, starting the dev server, ad-hoc inspection. Path-escaping + output-truncation guards in place. |
| `start_dev_server` | Starts `next dev` on `0.0.0.0:3000` and waits until it's reachable. |

The agent has **full bash access** inside its sandbox — treat the sandbox as untrusted. Don't inject secrets you wouldn't hand to an LLM.

## Customization

### Replace the starter app

Swap `sandbox-starter/` for any Node project. Make sure `package.json` has a `dev` script that binds to `0.0.0.0:3000`, and update the agent's `start_dev_server` tool if you use a different port.

### Add tldraw as visual input

Render a tldraw canvas in a third pane, serialize its shapes on each `sendMessage`, post them to `/api/chat` as `shapes`. The proxy already forwards them into the agent's system prompt (see `app/api/chat/route.ts`).

### Add custom tools

Edit `agents/canvas-agent.ts`, add `tool({...})` entries, redeploy. Tools run inside the sandbox, scoped to `/home/user/repo`.

### Persist sessions

Right now `sandboxId` lives in `localStorage`. Wire it to your auth system (Clerk, NextAuth, etc.) and store per-user in your DB — that's the production-ready shape.

## Project structure

```
canvas-template/
├── agents/
│   └── canvas-agent.ts          # Agent definition (tools, systemPrompt). Deployed via CLI.
├── sandbox-starter/             # Next.js starter written into the sandbox on create
├── lib/
│   └── starter-files.ts         # Reads sandbox-starter/ into a { path: content } map
├── app/
│   ├── api/
│   │   ├── agent/sandbox/route.ts   # Sandbox create + file seed
│   │   ├── agent/threads/route.ts   # Thread create
│   │   ├── agent/token/route.ts     # Token exchange
│   │   ├── chat/route.ts            # Proxy with systemPrompt.append
│   │   └── preview/route.ts         # E2B public URL resolver
│   ├── page.tsx                 # Chat + preview layout
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── chat-panel.tsx           # @21st-sdk/react chat UI
│   ├── canvas-header.tsx
│   └── ...                      # shadcn primitives
├── .env.example
└── package.json
```

## Commands

```bash
npm run dev            # Next.js dev server for the host app
npm run build          # Production build
npm run start          # Production server
npm run agent:deploy   # Deploy the canvas agent
```

## Caveats

- **First sandbox is slow** (~90s for `npm install`). Caching the sandbox per user is the obvious optimization.
- **E2B sandbox TTL** — sandboxes expire; once they do, you need a new one (and a new `npm install`).
- **Broad bash access** — the agent can run arbitrary shell inside the sandbox. That's the point, but it also means don't inject secrets.
- **Status:** this template is WIP — the README pattern matches our shipped templates, but the template itself hasn't been deployed to Vercel or registered yet.

## Next steps

- [21st Docs](https://21st.dev/agents/docs)
- [E2B Docs](https://e2b.dev/docs)
- [@21st-sdk/react](https://www.npmjs.com/package/@21st-sdk/react)

## License

MIT
