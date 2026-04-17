# 21st SDK — Resume Screener

Build a recruiter workbench: paste a JD, screen a pool of candidates, get a ranked Kanban with tier/score/strengths/concerns. The agent does the judgment; the UI renders the verdict.

## What you'll build

A Next.js app with JD textarea on the left, candidate list below, a 3-column Kanban (Strong / Maybe / Weak), and the agent chat on the right.

- **JD + 5 bundled sample resumes** — all wired as structured data, no file upload
- **Single tool call** — `rank_candidates` returns the complete evaluation; the UI applies it in one pass
- **Drawer view** — click any candidate to see the full resume + strengths + concerns
- **Re-ranking** — ask the agent to re-score against a different lens ("remote-only", "TS-heavy", etc.)

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

```bash
cd resume-screener
npm install
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
cp .env.example .env.local
# add API_KEY_21ST
npm run dev
```

## How it works

### Context injection

Every user message is prefixed with a hidden `[[[SYSTEM NOTE]]]` containing the current JD and candidate list:

```ts
const note = `[[[SYSTEM NOTE: JOB_DESCRIPTION: "${jd}" | CANDIDATES: ${JSON.stringify(candidates)}]]]`
const withContext = `${note}\n\n${userMessage}`
```

The agent never has to ask "who are the candidates?" — they're in context on every turn.

### Tool output → Kanban

`rank_candidates` returns a sorted array of evaluations:

```ts
{ ranked: [
  { id, score: 0-100, tier: "strong"|"maybe"|"weak", strengths: [...], concerns: [...], summary: "..." },
  ...
]}
```

The client parses the JSON, groups by tier, and applies it exactly once per `toolCallId`. The tool output is stripped from the chat log so the UI shows only the agent's natural-language summary.

## Try it out

- "Screen all candidates against the JD."
- "Rescore assuming the role is remote-only."
- "Which candidates have startup or 0-to-1 experience?"
- "Who has the strongest TypeScript background? Rerank for TS-heavy work."

## Project structure

```
resume-screener/
├── agents/resume-screener-agent.ts     # Agent with rank_candidates tool
├── lib/sample-data.ts                  # Sample JD + 5 candidate resumes
├── app/
│   ├── api/agent/{token,sandbox,threads,status}/route.ts
│   ├── _components/{agent-sidebar,setup-checklist}.tsx
│   ├── page.tsx                        # JD + list + Kanban + drawer + chat
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```

## Next steps

- Swap bundled samples for real resume uploads (PDF parser + object storage)
- Add "bulk actions" on a tier (email top 3, export to ATS)
- Persist evaluations to a DB keyed by JD hash so rescoring has history
