# Docs Assistant (llms.txt)

Turn any documentation site into a conversational AI assistant. Set one env var (`DOCS_URL`), deploy, and get a streaming chat UI that answers questions with citations.

Uses the [llms.txt](https://llmstxt.org) standard — the agent downloads `llms.txt` and `llms-full.txt` at startup, then greps locally for speed with fallback page fetching.

## Quick start

```bash
cd docs-assistant
npm install
```

### Deploy the agent

```bash
npx @21st-sdk/cli login    # paste your an_sk_ API key
npx @21st-sdk/cli deploy
```

### Set the docs URL

In the [21st dashboard](https://21st.dev/agents) → your agent → **Environment Variables**:

```
DOCS_URL=https://docs.anthropic.com
```

Redeploy after adding the env var:

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

## Agent tools

| Tool | Purpose |
|------|---------|
| `search_docs` | Grep through local docs with keyword + context lines |
| `list_doc_pages` | Show full docs index from llms.txt |
| `fetch_doc_page` | Fetch a specific doc page URL for full content |

## Compatible sites

| Site | `DOCS_URL` |
|------|-----------|
| Anthropic | `https://docs.anthropic.com` |
| Vercel | `https://vercel.com` |
| Supabase | `https://supabase.com/docs` |
| Stripe | `https://docs.stripe.com` |

If llms.txt is at a non-standard path, use `DOCS_LLMS_TXT_URL` instead:

```
DOCS_LLMS_TXT_URL=https://example.com/custom/path/llms.txt
```

## Project structure

```
docs-assistant/
├── agents/
│   └── docs-assistant/
│       └── index.ts              # Agent definition (deploy this)
├── app/
│   ├── api/agent/token/route.ts  # Token handler
│   ├── page.tsx                  # Chat UI
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Styles
├── .env.example
└── package.json
```
