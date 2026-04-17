# 21st SDK — SQL Chat

Build a side-by-side SQL workbench + chat assistant. The agent composes read-only SQL against a demo e-commerce schema; the UI streams the query into an editor and renders results in a table.

## What you'll build

A Next.js app with a schema tree, SQL editor, results table, and an agent chat.

- **Schema tree** — click a table to inspect it (and send a "describe" prompt to the agent)
- **SQL editor** — agent-authored SQL lands here; user can edit and re-run via the `Run` button
- **Results table** — rows streamed back from the `run_sql` tool
- **Read-only guard** — the in-process demo engine rejects any write statement
- **Schema context injection** — each user message is prefixed with a hidden `[[[SYSTEM NOTE]]]` containing the current schema so the agent never has to guess column names

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

```bash
git clone <this repo>
cd sql-chat
npm install
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
cp .env.example .env.local
# add API_KEY_21ST
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

### Demo engine (`lib/sql-engine.ts`)

Pure-TypeScript mini-engine. Supports:

```
SELECT <cols | *> FROM <table> [WHERE col <op> value] [ORDER BY col [ASC|DESC]] [LIMIT n]
SELECT COUNT(*) FROM <table> [WHERE ...]
```

Operators: `= != <> < <= > >= LIKE`. No JOINs, no GROUP BY, no subqueries.

Any statement matching `\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|replace|merge)\b` is rejected — even if the agent somehow emits it. The same engine runs in two places:

- **Inside the agent** (`agents/sql-agent.ts`) when it calls `run_sql`
- **Server-side** (`app/api/run-sql/route.ts`) when the user clicks Run in the editor

That way the user and the agent see identical results.

### Context injection

Before each user message, the client prepends a hidden `[[[SYSTEM NOTE]]]` block containing the schema:

```ts
const note = `[[[SYSTEM NOTE: CURRENT_SCHEMA: ${JSON.stringify(schema)}]]]`
const withContext = `${note}\n\n${userMessage}`
```

The prefix is stripped from the UI render so users only see their own words.

### Tool output → UI state

The client watches messages for parts matching `run_sql` tool output, extracts the JSON payload (`{ sql, columns, rows, rowCount }`), and drops it straight into the editor + results table. Each `toolCallId` is applied exactly once.

## Try it out

- "Show me the top 5 orders by total_cents, highest first."
- "Which products are in the 'plan' category?"
- "Find orders where notes LIKE '%rush%'."
- "How many customers do we have?"
- "Describe all tables."

## Project structure

```
sql-chat/
├── agents/sql-agent.ts             # Agent with run_sql + describe_schema tools
├── lib/sql-engine.ts               # Shared demo executor (read-only SELECT parser)
├── app/
│   ├── api/agent/{token,sandbox,threads,status}/route.ts
│   ├── api/run-sql/route.ts        # Server-side runner for the Run button
│   ├── _components/
│   │   ├── agent-sidebar.tsx
│   │   └── setup-checklist.tsx
│   ├── page.tsx                    # Schema tree + editor + results + chat
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```

## Next steps

- Swap the demo engine for a real Supabase/Postgres read-only connection (same tool interface)
- Add `EXPLAIN` support as a second tool and render the plan tree
- Persist saved queries in a `lib/saved-queries.ts` and add a Saved tab to the sidebar
