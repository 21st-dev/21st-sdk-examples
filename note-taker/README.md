# Note Taker Agent

Build an AI notebook assistant that saves, searches, updates, and deletes notes with real-time sync via Convex — built with [21st SDK](https://21st.dev/agents) and [Convex](https://convex.dev).

Chat naturally. Notes persist across sessions in Convex.

## What you'll build

A three-panel Next.js app — thread sidebar, chat, and live notes panel — powered by a Claude Code agent with 6 custom CRUD tools.

- **6 custom tools** — `save_note`, `search_notes`, `list_notes`, `get_notes_by_tag`, `update_note`, `delete_note`
- **Skills as markdown files** — behavior rules and response formatting, no recompile needed
- **CLAUDE.md guardrails** — restricts the agent to its 6 custom tools only
- **Three-panel layout** — threads sidebar + chat + notes panel
- **Custom tool renderers** — visual note operation feedback
- **Convex real-time subscriptions** — live note updates without polling

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key
- A [Convex](https://www.convex.dev) account (free tier works)

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `AN_API_KEY` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Convex deployment URL for the React client |
| `CONVEX_URL` | 21st dashboard env vars | Same Convex URL — set in 21st dashboard so the agent sandbox can reach Convex |

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/note-taker
npm install
```

### 2. Set up Convex

```bash
npx convex dev
# Copy the deployment URL from the output
```

### 3. Deploy the agent

```bash
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
```

After deploying, go to the 21st dashboard and add `CONVEX_URL` to your agent's environment variables. This lets the agent sandbox connect to your Convex database.

### 4. Configure and run

```bash
cp .env.example .env.local
# Add AN_API_KEY and NEXT_PUBLIC_CONVEX_URL to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Code walkthrough

### Agent definition (`agents/note-taker.ts`)

Uses Claude Sonnet with 6 CRUD tools. The system prompt instructs the agent to always search notes before claiming it has no information:

```typescript
import { agent } from "@21st-sdk/agent"
import { noteTools } from "./lib/tools"

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "bypassPermissions",
  maxTurns: 10,
  systemPrompt: `You are a personal notebook assistant. You help users save, find, update, and delete notes.

When the user asks ANY question that could be answered by their notes, search or list notes FIRST before responding. Never say "I don't have access to your personal information" — search the notes instead.

Refer to your skills for detailed behavior rules and response formatting.`,
  tools: noteTools,
  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[note-taker] Done: ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
```

Each tool in `agents/lib/tools.ts` uses Zod schemas for input validation and calls Convex HTTP endpoints via helpers in `agents/lib/convex.ts`.

## How it works

- **CRUD tools** — the 6 tools each call Convex HTTP endpoints. Zod schemas validate every input before execution.
- **Real-time sync** — the notes panel subscribes to Convex queries using real-time subscriptions. When the agent creates, updates, or deletes a note, the panel updates instantly — no polling.
- **Skills as config** — behavior rules live in `skills/note-management.md` (tag taxonomy, note categories) and `skills/response-format.md` (output formatting). Edit these to change behavior without recompiling.
- **Guardrails** — `CLAUDE.md` restricts the agent to its 6 custom tools only, preventing arbitrary shell commands or file operations.

## Try it out

```
You: "Remember that project Alpha demo is Tuesday at 2pm"
Agent: Saved "Project Alpha Demo" with tags: deadline, meeting

You: "What are my upcoming deadlines?"
Agent: Project Alpha Demo — Tuesday at 2pm

You: "Update the deadline to Wednesday"
Agent: Updated "Project Alpha Demo" — deadline changed to Wednesday

You: "Delete the note about Alpha"
Agent: Deleted "Project Alpha Demo"
```

## Customization

### Add a new tool

1. Define the tool in `agents/lib/tools.ts` with a Zod schema
2. Add a custom renderer in `app/components/note-tool-renderers.tsx`
3. Wire the renderer in `app/page.tsx` `toolRenderers` prop
4. Redeploy: `npm run deploy`

### Change note categories/tags

Edit `skills/note-management.md` — update the tag taxonomy table.

### Add a new Convex field

1. Update `convex/schema.ts`
2. Update `convex/notes.ts` queries/mutations
3. Update the `ConvexNote` interface in `agents/lib/tools.ts`
4. Run `npx convex dev` to push schema changes

### Change the UI layout

Edit `app/page.tsx`. The three-panel layout uses Tailwind flex:
- Thread sidebar: `w-56`
- Chat: `flex-1`
- Notes panel: `w-80`

## Project structure

```
note-taker/
├── agents/
│   ├── note-taker.ts       # Agent config (prompt, model, tool wiring)
│   └── lib/
│       ├── tools.ts         # 6 note CRUD tools with Zod schemas
│       ├── convex.ts        # Convex HTTP client helpers
│       └── env.ts           # Env loading (local + sandbox)
├── skills/
│   ├── note-management.md   # Behavior rules, tag taxonomy
│   └── response-format.md   # Output formatting rules
├── app/
│   ├── api/
│   │   ├── an/token/route.ts    # Token exchange
│   │   ├── an/sandbox/route.ts  # Sandbox creation/caching
│   │   ├── an/threads/route.ts  # Thread management
│   │   └── notes/route.ts       # REST API for notes (optional)
│   ├── components/
│   │   ├── thread-sidebar.tsx    # Thread navigation
│   │   ├── notes-panel.tsx       # Real-time notes display (Convex subscriptions)
│   │   └── note-tool-renderers.tsx  # Custom tool call visualization
│   ├── page.tsx             # Main layout: sidebar + chat + notes panel
│   ├── layout.tsx
│   ├── convex-provider.tsx  # Convex React provider
│   └── globals.css
├── convex/
│   ├── schema.ts            # Database schema (notes table)
│   └── notes.ts             # Queries and mutations
├── CLAUDE.md                # Agent guardrails
├── .env.example
└── package.json
```

## Commands

```bash
npm run dev          # Run Next.js + Convex dev servers
npm run dev:next     # Run Next.js only
npm run dev:convex   # Run Convex only
npm run build        # Production build
npm run login        # Authenticate with An
npm run deploy       # Deploy agent to An
npm run typecheck    # TypeScript type checking
```

## Next steps

- Learn more about skills — see [Skills](https://21st.dev/agents/docs/skills)
- Learn about agent configuration — see [Build & Deploy](https://21st.dev/agents/docs/agent-projects)
- [21st Docs](https://21st.dev/agents/docs)
- [Convex Documentation](https://docs.convex.dev)
