# 21st SDK — Next.js Fill Form Example

Build a side-by-side form UI + chat assistant where the agent fills form fields via a custom tool with discriminated union schemas.

## What you'll build

A Next.js app with a tabbed form panel on the left and an agent chat panel on the right. The agent reads the active form's schema and current data via context injection, then calls a single `fill_form` tool to patch fields. The client parses the tool output and applies changes in real time.

- **Three form types** — Profile, Order, and Support
- **Discriminated union input schema** — type-safe per form via Zod
- **Context injection** — prepends form state to every user message
- **Tool output parsed client-side** — applied once per tool call

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `AN_API_KEY` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/nextjs-fill-form
npm install
```

### 2. Deploy the agent

```bash
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
```

### 3. Configure and run

```bash
cp .env.example .env.local
# Add AN_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Code walkthrough

### Agent definition (`agents/form-agent.ts`)

Exposes a single `fill_form` tool with a discriminated union input schema — the `formId` field determines which patch schema is validated:

```typescript
import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

const profilePatchSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  age: z.number().int().min(0).max(120).optional(),
  role: z.enum(["designer", "engineer", "manager", "other"]).optional(),
  newsletter: z.boolean().optional(),
}).strict()

const orderPatchSchema = z.object({
  product: z.enum(["starter", "pro", "enterprise"]).optional(),
  quantity: z.number().int().min(1).max(999).optional(),
  deliveryDate: z.string().optional(),
  giftWrap: z.boolean().optional(),
  notes: z.string().optional(),
}).strict()

const supportPatchSchema = z.object({
  topic: z.string().min(1).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  contactMethod: z.enum(["email", "phone", "chat"]).optional(),
  allowFollowUp: z.boolean().optional(),
  message: z.string().optional(),
}).strict()

const fillFormInputSchema = z.discriminatedUnion("formId", [
  z.object({ formId: z.literal("profile"), patch: profilePatchSchema }),
  z.object({ formId: z.literal("order"), patch: orderPatchSchema }),
  z.object({ formId: z.literal("support"), patch: supportPatchSchema }),
])

export default agent({
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  systemPrompt: `You are a form-filling assistant. ...`,
  tools: {
    fill_form: tool({
      description: "Fill fields for one of the forms (profile, order, support)",
      inputSchema: z.object({
        formId: z.enum(["profile", "order", "support"]),
        patch: z.record(z.unknown()),
      }),
      execute: async ({ formId, patch }) => {
        const parsed = fillFormInputSchema.safeParse({ formId, patch })
        if (!parsed.success) {
          return {
            content: [{ type: "text", text: "Invalid fill_form payload" }],
            isError: true,
          }
        }
        return {
          content: [{ type: "text", text: JSON.stringify({ formId, patch }) }],
        }
      },
    }),
  },
})
```

### How context injection works

Before each message, the client prepends a hidden `[[[SYSTEM NOTE...]]]` block containing the active form ID, current field values, and the form schema:

```typescript
const systemNote = `[[[SYSTEM NOTE: CURRENTLY USER IS WORKING WITH THE FORM "${activeFormId}"
CURRENT FORM DATA: ${JSON.stringify(formData)}
FORM SCHEMA AGAIN: ${JSON.stringify(formSchema)}]]]`

const messageWithContext = systemNote + "\n" + userMessage
```

The agent reads this to know which form it's working with. The prefix is only sent to the model — it's stripped from rendered user messages in the chat UI.

### How tool output is applied

The client parses the latest tool output (JSON with `formId` and `patch`) and merges it into form state. Each tool call is applied exactly once, keyed by `toolCallId`:

```typescript
const toolOutput = JSON.parse(lastToolResult.text)
// { formId: "profile", patch: { fullName: "Jane Doe", email: "jane@example.com" } }

setFormData((prev) => ({ ...prev, ...toolOutput.patch }))
```

## Try it out

- "Fill this form with my name Jane Doe, email jane@example.com, age 29"
- "Set quantity to 3 and add note rush delivery"
- "Set support priority high and contact method email"

## Project structure

```
nextjs-fill-form/
├── agents/
│   └── form-agent.ts          # Agent with fill_form tool
├── app/
│   ├── api/an/token/route.ts  # Token handler (server-side)
│   ├── page.tsx               # Tabs + forms + chat integration
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```

## Next steps

- Add more form types by extending the discriminated union
- Add validation feedback — show errors from `safeParse` in the chat
- Learn about agent tools — see [Build & Deploy](https://21st.dev/agents/docs/agent-projects)
