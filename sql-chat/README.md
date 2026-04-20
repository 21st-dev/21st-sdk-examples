# 21st SDK — SQL Chat

A Supabase-style table editor paired with an agent chat. Switch between tables, sort, filter, paginate — then talk to the agent in plain English to query or edit data. Toggle **Read-only ↔ Read & Write** directly in the chat input bar to allow `INSERT / UPDATE / DELETE`.

## What you'll build

A Next.js app with:

- **Table editor (center)** — tabs for each table (`customers`, `products`, `orders`, `order_items`), sticky header with column names + inferred types (`int8`, `text`, `date`…), PK icon on `id`, click-to-sort, client-side filter, pagination, and a `Definition / Data` toggle to peek at the last SQL.
- **Agent chat (right)** — full conversational interface from `@21st-sdk/react`. The mode selector (`Read-only` / `Read & Write`) lives in the input bar. In write mode, the agent can compose `INSERT / UPDATE / DELETE` against the demo database.
- **Prompt sidebar (left)** — categorized read / write examples with icons. When in read-only mode, write examples show a hint nudging the user to flip the toggle.
- **Row-flash animation** — new rows pulse green for ~2s so INSERTs are visually obvious.
- **Schema + mode injection** — every user message is prefixed with a hidden `[[[SYSTEM NOTE]]]` carrying the current schema and the active `WRITE_MODE`, so the agent never has to guess column names and always knows what it's allowed to do.

## Prerequisites

- Node.js 20.9+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

```bash
git clone https://github.com/21st-dev/21st-sdk-examples.git
cd 21st-sdk-examples/sql-chat
npm install
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
cp .env.example .env.local
# add API_KEY_21ST
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `customers` is loaded by default — click any other tab to switch tables, or ask the agent in the chat.

## How it works

### Demo engine (`lib/sql-engine.ts`)

Pure-TypeScript in-memory engine. Data lives on a shared `SCHEMA` object — writes mutate it in place and survive across agent turns in the same sandbox (they reset when the sandbox restarts / is redeployed).

Supported grammar:

```
SELECT <cols | *> FROM <table> [WHERE col <op> value] [ORDER BY col [ASC|DESC]] [LIMIT n]
SELECT COUNT(*)  FROM <table> [WHERE ...]
INSERT INTO <table> (col1, col2, ...) VALUES (v1, v2, ...)    -- single row; omit id to auto-assign
UPDATE <table> SET col=val[, col=val, ...] [WHERE col <op> value]
DELETE FROM <table> [WHERE col <op> value]
```

Operators: `= != <> < <= > >= LIKE`. No JOINs, no GROUP BY, no subqueries.

Every write call must pass `allowWrite: true`; otherwise the engine returns `"Write mode is disabled."` This runtime gate is enforced in two places so the user and the agent see identical behavior:

- **Inside the agent** (`agents/sql-agent.ts`) when it calls `run_sql` with `allow_write`
- **Server-side** (`app/api/run-sql/route.ts`) — still available for direct HTTP calls

### Context injection

Each user message is wrapped with a hidden note:

```ts
const note = `[[[SYSTEM NOTE: CURRENT_SCHEMA: ${JSON.stringify(schema)} WRITE_MODE: ${writeMode ? "enabled" : "disabled"}]]]`
const withContext = `${note}\n\n${userMessage}`
```

The prefix is stripped from the UI render so users only see their own words. The agent's system prompt tells it to trust `WRITE_MODE` as authoritative and pass `allow_write` to `run_sql` accordingly.

### Mode selector in the chat input

The toggle is rendered by `@21st-sdk/react`'s `AgentChat` via the `modeSelector` prop, with `--an-mode-selector-position: inline` in the theme to pin it inside the input bar:

```tsx
<AgentChat
  theme={{ theme: { "--an-mode-selector-position": "inline" }, light: {}, dark: {} }}
  modeSelector={{
    modes: [
      { id: "read",  label: "Read-only" },
      { id: "write", label: "Read & Write" },
    ],
    activeMode: writeMode ? "write" : "read",
    onModeChange: (id) => setWriteMode(id === "write"),
  }}
  /* ... */
/>
```

### Tool output -> UI state

The client watches messages for `run_sql` tool parts, extracts the JSON payload (`{ sql, columns, rows, rowCount }`), and hands it to the table editor. The active tab is auto-derived from the SQL's `FROM <table>` clause, so the grid follows whatever the agent last queried or mutated. Each `toolCallId` is applied exactly once.

### New-row animation

After every result update, the client diffs the previous set of `id` values against the new set. Any truly new id gets the `row-flash` class, which runs a 2.2s CSS keyframe (green fill + left rail, fading to transparent). Defined in `app/globals.css`.

## Try it out

**Read examples** (work in both modes):

- "Show me the top 5 orders by total_cents, highest first."
- "Which products are in the 'plan' category?"
- "Find orders where notes LIKE '%rush%'."
- "How many customers do we have?"
- "Describe all tables."

**Write examples** (flip to **Read & Write** first):

- "Add a new customer: name 'Mira Okafor', email 'mira@example.com', country 'NG', signup_month '2025-05'."
- "Update order 5006: set status to 'paid'."
- "Delete all orders where status = 'refunded'."
- "Raise Pro Plan price to 3900 cents."

## Project structure

```
sql-chat/
├── agents/sql-agent.ts             # Agent with run_sql + describe_schema; reads WRITE_MODE from system note
├── lib/sql-engine.ts               # Shared in-memory engine (SELECT / INSERT / UPDATE / DELETE)
├── app/
│   ├── api/agent/{token,sandbox,threads,status}/route.ts
│   ├── api/run-sql/route.ts        # Server-side runner (direct HTTP)
│   ├── _components/
│   │   ├── agent-sidebar.tsx       # Sidebar shell + prompt buttons with icon slot
│   │   └── setup-checklist.tsx
│   ├── page.tsx                    # Table editor + tabs + chat + mode toggle + example prompts
│   ├── layout.tsx
│   └── globals.css                 # Theme tokens + row-flash keyframe
├── .env.example
└── package.json
```

## Next steps

- Swap the demo engine for a real Supabase/Postgres connection (same `runSql(sql, { allowWrite })` interface)
- Add `EXPLAIN` as a second tool and render the plan tree
- Surface per-cell edits (double-click a value → UPDATE) on top of the existing grid
- Persist writes across sandbox restarts via a durable KV (so "Add customer" sticks between sessions)
