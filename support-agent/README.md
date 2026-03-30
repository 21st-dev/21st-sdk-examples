# Support Agent

Docs-powered support agent that answers questions from llms.txt and escalates unanswered ones to your team via email (Resend).

Built on top of the [Docs Assistant](../docs-assistant) template — keeps the full docs search flow and adds a `send_email` tool for forwarding questions the docs can't answer.

## Quick start

```bash
cd support-agent
npm install
```

### Deploy the agent

```bash
npx @21st-sdk/cli login    # paste your an_sk_ API key
npx @21st-sdk/cli deploy
```

### Set environment variables

```bash
npx @21st-sdk/cli env set support-agent DOCS_URL https://docs.example.com
npx @21st-sdk/cli env set support-agent RESEND_API_KEY re_your_key_here
npx @21st-sdk/cli env set support-agent SUPPORT_EMAIL team@yourcompany.com
npx @21st-sdk/cli env set support-agent RESEND_FROM_EMAIL "Support <support@yourcompany.com>"
```

Redeploy after adding env vars:

```bash
npx @21st-sdk/cli deploy
```

### Run the app

```bash
cp .env.example .env.local
# Add your API_KEY_21ST to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. **Sandbox setup** — downloads `{DOCS_URL}/llms.txt` and `{DOCS_URL}/llms-full.txt` via curl
2. **Local search** — agent greps through downloaded docs for keywords
3. **Fallback fetch** — `fetch_doc_page` tool retrieves specific pages when needed
4. **Citations** — every answer includes links to relevant doc pages
5. **Email escalation** — when the docs don't have an answer, the agent offers to forward the question to your team via Resend

## Agent tools

| Tool | Purpose |
|------|---------|
| `search_docs` | Grep through local docs with keyword + context lines |
| `list_doc_pages` | Show full docs index from llms.txt |
| `fetch_doc_page` | Fetch a specific doc page URL for full content |
| `send_email` | Forward unanswered questions to the team via Resend |

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |
| `DOCS_URL` | Agent env | Base URL of the docs site (e.g. `https://docs.anthropic.com`) |
| `DOCS_LLMS_TXT_URL` | Agent env (optional) | Direct URL to llms.txt if at a non-standard path |
| `RESEND_API_KEY` | Agent env | Resend API key (`re_`) |
| `SUPPORT_EMAIL` | Agent env | Team email where unanswered questions are sent |
| `RESEND_FROM_EMAIL` | Agent env (optional) | Sender address, defaults to `onboarding@resend.dev` |

## Project structure

```
support-agent/
├── agents/
│   └── support-agent/
│       └── index.ts              # Agent definition (deploy this)
├── app/
│   ├── api/agent/token/route.ts  # Token handler
│   ├── page.tsx                  # Chat UI
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Styles
├── .env.example
└── package.json
```
