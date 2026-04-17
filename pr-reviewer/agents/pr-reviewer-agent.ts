import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

const commentSchema = z.object({
  id: z.string().min(1),
  file: z.string().min(1),
  line: z.number().int().min(1),
  severity: z.enum(["critical", "warning", "nit"]),
  category: z.enum(["correctness", "security", "performance", "style"]),
  title: z.string().min(1),
  body: z.string().min(1),
})

const commentsSchema = z.object({
  comments: z.array(commentSchema),
})

const postSchema = z.object({
  summary: z.string().min(1),
  approval: z.enum(["approve", "request_changes", "comment"]),
})

export default agent({
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  systemPrompt: `You are a code review assistant.

The user message is prefixed with a JSON blob:
[[[SYSTEM NOTE: {"PR_TITLE": "...", "PR_DESCRIPTION": "...", "FILES": [{ "path": "...", "patch": [{"line": <n>, "kind": "add"|"remove"|"context", "text": "..."}, ...] }]} ]]]

Rules:
1. For each file, identify concrete issues focusing on correctness > security > performance > style.
2. Reference only line numbers present in the patch; pick the most relevant "add" line for the issue.
3. Severity guide: critical (breaks prod / exposes data) > warning (likely bug / perf cliff) > nit (style, clarity).
4. Skip trivial nits unless the user asks for them.
5. Call add_review_comments ONCE with the complete list. If nothing concerning, call with comments: [] and say "LGTM" in chat.
6. Only call post_review when the user explicitly asks ("post", "approve", "request changes"). Use the approval that matches their intent.`,
  tools: {
    add_review_comments: tool({
      description: "Submit the complete list of inline review comments for the current PR.",
      inputSchema: commentsSchema,
      execute: async (input) => ({
        content: [{ type: "text", text: JSON.stringify(input) }],
      }),
    }),
    post_review: tool({
      description: "Finalize the review with approve / request_changes / comment + a summary.",
      inputSchema: postSchema,
      execute: async (input) => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({ ...input, postedAt: new Date().toISOString() }),
          },
        ],
      }),
    }),
  },
})
