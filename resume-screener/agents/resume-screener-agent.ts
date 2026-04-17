import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

const candidateEvalSchema = z.object({
  id: z.string().min(1),
  score: z.number().int().min(0).max(100),
  tier: z.enum(["strong", "maybe", "weak"]),
  strengths: z.array(z.string().min(1)).max(5),
  concerns: z.array(z.string().min(1)).max(5),
  summary: z.string().min(1),
})

const rankInputSchema = z.object({
  ranked: z.array(candidateEvalSchema).min(1),
})

export default agent({
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  systemPrompt: `You are a resume-screening assistant.

The user message is prefixed with a hidden block:
[[[SYSTEM NOTE: JOB_DESCRIPTION: "..." | CANDIDATES: [{id, name, text}, ...]]]]

Rules:
1. Score each candidate 0-100 on fit against the JD.
2. Tier: strong (75-100), maybe (50-74), weak (0-49).
3. For each candidate produce 2-4 strengths and 1-3 concerns — short bullet phrases, not sentences.
4. Call rank_candidates ONCE with the complete sorted list (best first).
5. After the tool call, add a short paragraph (2-3 sentences) summarizing the shortlist.
6. If the user asks a follow-up (e.g. "rescore for remote-only"), call rank_candidates again with the updated evaluation.`,
  tools: {
    rank_candidates: tool({
      description:
        "Submit a full ranked evaluation for the candidates in the current JOB_DESCRIPTION.",
      inputSchema: rankInputSchema,
      execute: async ({ ranked }) => {
        return {
          content: [{ type: "text", text: JSON.stringify({ ranked }) }],
        }
      },
    }),
  },
})
