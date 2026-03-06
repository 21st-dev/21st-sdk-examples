import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

const profilePatchSchema = z
  .object({
    fullName: z.string().min(1).optional(),
    email: z.string().email().optional(),
    age: z.number().int().min(0).max(120).optional(),
    role: z.enum(["designer", "engineer", "manager", "other"]).optional(),
    newsletter: z.boolean().optional(),
  })
  .strict()

const orderPatchSchema = z
  .object({
    product: z.enum(["starter", "pro", "enterprise"]).optional(),
    quantity: z.number().int().min(1).max(999).optional(),
    deliveryDate: z.string().optional(),
    giftWrap: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .strict()

const supportPatchSchema = z
  .object({
    topic: z.string().min(1).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    contactMethod: z.enum(["email", "phone", "chat"]).optional(),
    allowFollowUp: z.boolean().optional(),
    message: z.string().optional(),
  })
  .strict()

const fillFormInputSchema = z.discriminatedUnion("formId", [
  z.object({ formId: z.literal("profile"), patch: profilePatchSchema }),
  z.object({ formId: z.literal("order"), patch: orderPatchSchema }),
  z.object({ formId: z.literal("support"), patch: supportPatchSchema }),
])

const fillFormBaseInputSchema = z.object({
  formId: z.enum(["profile", "order", "support"]),
  patch: z.record(z.unknown()),
})

export default agent({
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  systemPrompt: `You are a form-filling assistant.

The user message may include a hidden prefix like:
[[[SYSTEM NOTE: CURRENTLY USER IS WORKING WITH THE FORM "<formId>" ... CURRENT FORM DATA: ... FORM SCHEMA AGAIN: ...]]]

Rules:
1. Always follow that SYSTEM NOTE block when present.
2. Call fill_form with the matching formId from the SYSTEM NOTE.
3. Only set fields that are present in that form schema.
4. Return concise normal text after the tool call if needed.`,

  tools: {
    fill_form: tool({
      description: "Fill fields for one of the forms (profile, order, support)",
      inputSchema: fillFormBaseInputSchema,
      execute: async ({ formId, patch }) => {
        const parsed = fillFormInputSchema.safeParse({ formId, patch })
        if (!parsed.success) {
          return {
            content: [{ type: "text", text: "Invalid fill_form payload" }],
            isError: true,
          }
        }

        const payload = { formId, patch }
        return {
          content: [{ type: "text", text: JSON.stringify(payload) }],
        }
      },
    }),
  },
})
