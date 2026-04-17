import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

const lineItemSchema = z.object({
  description: z.string().min(1),
  qty: z.number(),
  unitPrice: z.number(),
  total: z.number(),
})

const extractSchema = z.object({
  invoiceId: z.string().min(1),
  vendor: z.string().min(1),
  amount: z.number(),
  currency: z.string().min(1),
  invoiceDate: z.string().min(1),
  poNumber: z.string().nullable().optional(),
  lineItems: z.array(lineItemSchema),
  vatAmount: z.number().optional(),
  vatRate: z.number().optional(),
})

const matchSchema = z.object({
  invoiceId: z.string().min(1),
  poNumber: z.string().min(1).nullable(),
  status: z.enum(["matched", "mismatch", "not_found"]),
  reasons: z.array(z.string()),
})

const pushSchema = z.object({
  invoiceId: z.string().min(1),
  system: z.enum(["quickbooks", "xero"]).default("quickbooks"),
})

export default agent({
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  systemPrompt: `You are an accounts-payable assistant.

The user message is prefixed with:
[[[SYSTEM NOTE: CURRENT_INVOICE_ID: "..." | RAW_TEXT: "..." | PO_DB: [...]]]]

Rules:
1. When asked to extract or when a new invoice is loaded, call extract_invoice with the parsed fields (vendor, amount, currency, invoiceDate, poNumber if present, lineItems, VAT).
2. After extract_invoice, call match_po comparing the extracted amount + vendor against PO_DB. Status: "matched" if vendor matches and amount is within $1 of PO amount, "mismatch" if the PO exists but amount/vendor differs, "not_found" if no PO number.
3. Only call push_to_accounting when the user explicitly approves (e.g. "approve", "push to quickbooks", "send to accounting").
4. Keep chat replies short (1-2 sentences). The UI renders all structured data.`,
  tools: {
    extract_invoice: tool({
      description: "Submit the extracted fields for the current invoice.",
      inputSchema: extractSchema,
      execute: async (input) => ({
        content: [{ type: "text", text: JSON.stringify(input) }],
      }),
    }),
    match_po: tool({
      description: "Submit the PO match result for the current invoice.",
      inputSchema: matchSchema,
      execute: async (input) => ({
        content: [{ type: "text", text: JSON.stringify(input) }],
      }),
    }),
    push_to_accounting: tool({
      description: "Push the approved invoice to the accounting system (mock).",
      inputSchema: pushSchema,
      execute: async ({ invoiceId, system }) => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              invoiceId,
              system,
              pushedAt: new Date().toISOString(),
              success: true,
            }),
          },
        ],
      }),
    }),
  },
})
