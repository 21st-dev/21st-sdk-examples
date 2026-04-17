import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

const featureSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
})

const copySchema = z.object({
  heroTitle: z.string().min(1),
  heroSubtitle: z.string().min(1),
  features: z.array(featureSchema).length(3),
  ctaLabel: z.string().min(1),
})

const updateSchema = z.object({
  voice: z.enum(["plain", "bold", "playful"]),
  copy: copySchema,
})

export default agent({
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  systemPrompt: `You are a landing-page copywriter.

The user message is prefixed with:
[[[SYSTEM NOTE: BRIEF: {...} | ACTIVE_VOICE: "plain"|"bold"|"playful"|"all" | CURRENT_COPY: {...}]]]

Rules:
1. If ACTIVE_VOICE is "all", call update_copy THREE times — once for each voice.
2. If it's a single voice, call update_copy ONCE for just that voice.
3. Per voice, produce: heroTitle (<= 10 words), heroSubtitle (<= 22 words), 3 features ({ title <= 5 words, body <= 18 words }), ctaLabel (<= 4 words).
4. Voice guidelines:
   - plain: clear, professional, no fluff. SaaS-brochure tone. Sentence case.
   - bold: short, punchy, high-contrast. Uppercase hero allowed. Declarative.
   - playful: witty, slightly irreverent, fresh metaphors. Skip the cringe.
5. After tool calls, add 1-2 short sentences summarizing what you regenerated and why.`,
  tools: {
    update_copy: tool({
      description: "Submit a new copy block for one voice.",
      inputSchema: updateSchema,
      execute: async (input) => ({
        content: [{ type: "text", text: JSON.stringify(input) }],
      }),
    }),
  },
})
