# 21st SDK — Landing Copywriter

Build a v0-style landing-copy generator. Enter a brief on the left; the agent generates hero + features + CTA in three distinct voices (Plain / Bold / Playful), live-rendered on the right.

## What you'll build

A Next.js app with a brief form + chat on the left and three stacked preview cards on the right. Each card is its own mini design system so you can feel the voice difference instantly.

- **Three voices, one schema** — `update_copy` with `{ voice, copy }` fires once per voice
- **Three visual styles** — Plain (serif, white), Bold (black + yellow), Playful (pastel gradient + pill CTA)
- **Per-voice regenerate** — each card has its own Regenerate button that sends only `ACTIVE_VOICE: <voice>`
- **Parallel updates** — when the agent calls `update_copy` three times (once per voice), each call streams independently into its card

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

```bash
cd landing-copywriter
npm install
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
cp .env.example .env.local
# add API_KEY_21ST
npm run dev
```

## How it works

### Context injection

Each user message is prefixed with a hidden note carrying the full brief + which voice is active + what we already have:

```
[[[SYSTEM NOTE: BRIEF: {...} | ACTIVE_VOICE: "plain"|"bold"|"playful"|"all" | CURRENT_COPY: {...} ]]]
```

The agent uses `ACTIVE_VOICE` to decide how many `update_copy` calls to make:
- `"all"` → three calls, one per voice
- single voice → one call

### Tool output → per-voice state

The client watches messages for `update_copy` parts, parses each payload, and routes to `copy[voice]`. Each `toolCallId` is applied exactly once so re-hydrating from localStorage is idempotent.

### Voice styling

All three previews render the same `CopyBlock` shape but through completely different components (in `app/_components/preview-card.tsx`). That's intentional — it sells the voice differences visually, not just verbally.

## Try it out

- "Generate all three voices" (default prompt)
- "Make the bold voice punchier and shorter."
- "Rewrite only the playful features — less whimsy, more specificity."
- "Try a more enterprise-leaning plain voice."
- Change the brief's audience from "indie developers" to "Series B infra teams" and regenerate.

## Project structure

```
landing-copywriter/
├── agents/landing-copywriter-agent.ts   # Agent with update_copy tool
├── app/
│   ├── api/agent/{token,sandbox,threads,status}/route.ts
│   ├── _components/
│   │   ├── agent-sidebar.tsx
│   │   ├── setup-checklist.tsx
│   │   └── preview-card.tsx             # Plain/Bold/Playful renderers
│   ├── page.tsx                         # Brief + chat + 3 previews
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```

## Next steps

- Add a fourth voice (e.g. Technical) — just add the enum value in the agent and a new case in `preview-card.tsx`
- Add copy history / undo by keeping a stack of `CopyBlock`s per voice
- Export the picked voice as a real HTML/JSX snippet the user can paste
