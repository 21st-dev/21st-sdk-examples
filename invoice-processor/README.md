# 21st SDK — Invoice Processor

Build an accounts-payable copilot: pick an invoice, watch the agent extract fields, match against a PO database, and push to accounting with human-in-the-loop approval.

## What you'll build

A Next.js app with an invoice preview (pure-Tailwind, no PDF lib), extracted-fields panel, PO-match banner, and an agent chat — all driven by three tool calls.

- **3 bundled sample invoices** — one clean match, one mismatch, one no-PO
- **Three tools** — `extract_invoice`, `match_po`, `push_to_accounting`
- **Human approval gate** — `push_to_accounting` only fires on explicit user approval
- **Per-tool idempotency** — each `toolCallId` is applied exactly once

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

```bash
cd invoice-processor
npm install
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
cp .env.example .env.local
# add API_KEY_21ST
npm run dev
```

## How it works

### Context injection

Each user message is prefixed with a hidden note carrying the current invoice's raw text + the PO database:

```
[[[SYSTEM NOTE: CURRENT_INVOICE_ID: "INV-001" | RAW_TEXT: "..." | PO_DB: [...] ]]]
```

The raw text is what the agent "reads" — in a real app this would come from an OCR step. Here we pre-bake it so the demo is deterministic.

### Tool sequence

1. **`extract_invoice`** — agent parses the raw text into structured fields.
2. **`match_po`** — agent compares extracted vendor + amount to the PO database and returns one of `matched` / `mismatch` / `not_found` with human-readable reasons.
3. **`push_to_accounting`** — only on explicit approval ("approve", "push to quickbooks", etc.).

Each tool output is a JSON-stringified payload. The client parses it, routes to the right piece of state (`extracted`, `match`, `pushed`), and renders once per `toolCallId`.

### Human approval

The "Approve & push" button is disabled until both `extracted` and `match` are present. Clicking it sends `"Approve and push to QuickBooks."` — the agent then calls `push_to_accounting`. The flag comes back as `{ success: true, pushedAt, system }` and the button flips to `Pushed ✓`.

## Try it out

- Pick INV-001 → "Extract this invoice." → expect a clean match against PO-1234.
- Pick INV-002 → "Extract and match." → expect a mismatch (fuel surcharge was off-PO).
- Pick INV-003 → "Match the PO." → expect not_found; ask the agent to suggest next steps.
- After any match: "Approve and push to QuickBooks."

## Project structure

```
invoice-processor/
├── agents/invoice-agent.ts              # Agent + 3 tools
├── lib/sample-data.ts                   # 3 invoices + PO_DB
├── app/
│   ├── api/agent/{token,sandbox,threads,status}/route.ts
│   ├── _components/
│   │   ├── agent-sidebar.tsx
│   │   ├── setup-checklist.tsx
│   │   └── invoice-preview.tsx          # Pure-Tailwind invoice card
│   ├── page.tsx                         # Picker + preview + extracted + chat
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```

## Next steps

- Replace the `rawText` field with a real OCR step (Tesseract, Textract, or an MCP)
- Hook `push_to_accounting` to the actual QuickBooks/Xero API
- Add line-item-level PO matching (not just total)
