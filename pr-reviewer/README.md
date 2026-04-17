# 21st SDK — PR Reviewer

Build a GitHub-style PR reviewer. Pick a PR, watch the agent stream inline comments onto the diff with severity badges, then post the review with approve / request_changes / comment.

## What you'll build

A Next.js app with a PR picker, file-by-file diff viewer, inline comment cards, and the agent chat.

- **3 bundled sample PRs** — one good, one tricky (race + null check), one risky (N+1 + SQL injection)
- **Structured patches** — PRs are stored as `PatchLine[]` (no diff parser needed)
- **Inline comments** — `add_review_comments` returns the full comment list; UI groups by `file:line`
- **Finalize** — `post_review` sets a top-of-PR banner with the approval state

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

```bash
cd pr-reviewer
npm install
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
cp .env.example .env.local
# add API_KEY_21ST
npm run dev
```

## How it works

### Why structured patches

We store diffs as `{ line, kind: "add"|"remove"|"context", text }[]` instead of raw unified-diff strings. This means:

- No diff parser in the browser
- Line numbers are explicit, so the agent references real positions
- Comments key into a `Map<"path:line", Comment[]>` directly

### Context injection

Each user message is prefixed with a hidden note containing the full PR payload:

```
[[[SYSTEM NOTE: {"PR_TITLE":"...","PR_DESCRIPTION":"...","FILES":[...]} ]]]
```

The agent always has the complete PR in context — no tool calls needed to fetch files.

### Tool outputs → UI

- `add_review_comments` → `setComments(parsed.comments)` and re-group by file/line.
- `post_review` → banner in the PR header with the approval state and timestamp.
- Each `toolCallId` applied once.

## Try it out

- Pick pr-001 → "Review this PR." → expect a correctness concern on the read-through cache (race) and one on the missing `user === null` check.
- Pick pr-002 → "Review this PR." → expect LGTM.
- Pick pr-003 → "Focus only on security issues." → expect a critical on the raw-string-concatenated SQL.
- "Post approval with a short summary."

## Project structure

```
pr-reviewer/
├── agents/pr-reviewer-agent.ts          # Agent with add_review_comments + post_review
├── lib/sample-data.ts                   # 3 PRs as PatchLine[]
├── app/
│   ├── api/agent/{token,sandbox,threads,status}/route.ts
│   ├── _components/
│   │   ├── agent-sidebar.tsx
│   │   ├── setup-checklist.tsx
│   │   ├── diff-viewer.tsx              # Renders PatchLine[] with inline comment slots
│   │   └── comment-card.tsx             # Severity-colored comment block
│   ├── page.tsx                         # PR picker + diff + chat
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```

## Next steps

- Swap `lib/sample-data.ts` for a GitHub REST fetch (accept a PR URL, parse `files` with line positions)
- Add a "dismiss" action per comment that drops it from state
- Wire `post_review` to the real GitHub Review API
