import { agent, tool, Sandbox } from "@21st-sdk/agent"
import { z } from "zod"

export default agent({
  runtime: "claude-code",
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  maxTurns: 25,

  systemPrompt: `You are a support agent. Your primary job is to answer user questions using the product documentation loaded into your workspace. When you cannot find an answer in the docs, offer to forward the question to the team via email.

RULES:
1. Documentation files are available locally:
   - /workspace/llms.txt — index of all doc pages with links and short descriptions
   - /workspace/llms-full.txt — full documentation content (may not exist if the site doesn't provide it)
2. ALWAYS search local files first using grep. Do NOT read the entire file — it may be very large.
3. Use grep with relevant keywords to find the right sections, then read only those sections.
4. If local docs are insufficient, use the fetch_doc_page tool to retrieve specific pages.
5. When answering, cite the relevant documentation page URLs so the user can read more.
6. Be concise and accurate. Provide code examples from the docs when relevant.
7. If the user asks about something not covered in the docs, say you couldn't find an answer and ask if they'd like you to forward the question to the team.

ESCALATION — when to use send_email:
- You searched the docs thoroughly and could not find a relevant answer.
- The user explicitly asks to contact the team or get human help.
- The question involves account-specific issues, billing, or bugs you cannot diagnose from the docs alone.
When sending an email, include the full conversation context so the team can reply without asking the user to repeat themselves.

WORKFLOW:
1. For any question, first grep /workspace/llms.txt to find relevant page titles and URLs.
2. Then grep /workspace/llms-full.txt for detailed content (if available).
3. If you need more detail, use fetch_doc_page to get the full page content.
4. Synthesize a clear answer with citations.
5. If no answer is found, ask the user if they'd like you to forward the question to the team — then use send_email.`,

  sandbox: Sandbox({
    setup: [
      `mkdir -p /home/user/workspace && cd /home/user/workspace && \
DOCS_URL="\${DOCS_URL:-}" && \
DOCS_LLMS_TXT_URL="\${DOCS_LLMS_TXT_URL:-}" && \
if [ -n "$DOCS_LLMS_TXT_URL" ]; then \
  curl -fsSL "$DOCS_LLMS_TXT_URL" -o llms.txt 2>/dev/null || echo "# Could not fetch llms.txt from $DOCS_LLMS_TXT_URL" > llms.txt; \
elif [ -n "$DOCS_URL" ]; then \
  BASE=$(echo "$DOCS_URL" | sed 's|/$||'); \
  curl -fsSL "$BASE/llms.txt" -o llms.txt 2>/dev/null || echo "# Could not fetch llms.txt from $BASE/llms.txt" > llms.txt; \
  curl -fsSL "$BASE/llms-full.txt" -o llms-full.txt 2>/dev/null || true; \
else \
  echo "# No DOCS_URL configured. Set DOCS_URL env var to your documentation base URL." > llms.txt; \
fi`,
    ],
  }),

  tools: {
    fetch_doc_page: tool({
      description:
        "Fetch a specific documentation page by URL. Use this when grep results from local files are not detailed enough and you need the full page content.",
      inputSchema: z.object({
        url: z.string().url().describe("Full URL of the documentation page to fetch"),
      }),
      execute: async ({ url }) => {
        try {
          const res = await fetch(url, {
            headers: { Accept: "text/plain, text/markdown, text/html" },
            signal: AbortSignal.timeout(15_000),
          })

          if (!res.ok) {
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to fetch ${url}: ${res.status} ${res.statusText}`,
                },
              ],
              isError: true,
            }
          }

          const text = await res.text()
          const truncated =
            text.length > 30_000
              ? text.slice(0, 30_000) + "\n\n[...truncated]"
              : text

          return {
            content: [{ type: "text", text: truncated }],
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error fetching ${url}: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          }
        }
      },
    }),

    list_doc_pages: tool({
      description:
        "List all available documentation pages from the llms.txt index. Returns page titles and URLs.",
      inputSchema: z.object({}),
      execute: async () => {
        const { readFile } = await import("fs/promises")
        try {
          const content = await readFile(
            "/home/user/workspace/llms.txt",
            "utf-8",
          )
          return { content: [{ type: "text", text: content }] }
        } catch {
          return {
            content: [
              {
                type: "text",
                text: "llms.txt not found. Make sure DOCS_URL is configured.",
              },
            ],
            isError: true,
          }
        }
      },
    }),

    search_docs: tool({
      description:
        "Search through the local documentation files for a keyword or phrase. Returns matching lines with context.",
      inputSchema: z.object({
        query: z
          .string()
          .min(1)
          .describe("Search term or phrase to look for in the docs"),
        file: z
          .enum(["llms.txt", "llms-full.txt"])
          .optional()
          .default("llms-full.txt")
          .describe(
            "Which docs file to search (llms-full.txt has full content, llms.txt has index)",
          ),
      }),
      execute: async ({ query, file }) => {
        const { execSync } = await import("child_process")
        const targetFile = `/home/user/workspace/${file}`

        try {
          const result = execSync(
            `grep -i -n -C 5 ${JSON.stringify(query)} ${JSON.stringify(targetFile)} | head -200`,
            { encoding: "utf-8", timeout: 10_000 },
          )
          return {
            content: [
              {
                type: "text",
                text: result || `No matches found for "${query}" in ${file}.`,
              },
            ],
          }
        } catch {
          return {
            content: [
              {
                type: "text",
                text: `No matches found for "${query}" in ${file}, or file does not exist.`,
              },
            ],
          }
        }
      },
    }),

    send_email: tool({
      description:
        "Send an email to the support team to escalate a question the docs could not answer. Use this only after confirming with the user that they want their question forwarded.",
      inputSchema: z.object({
        subject: z
          .string()
          .min(1)
          .describe("Short subject line summarizing the question"),
        message: z
          .string()
          .min(1)
          .describe(
            "Full message body with the user's question and any relevant context from the conversation",
          ),
        user_email: z
          .string()
          .email()
          .optional()
          .describe("User's email address for the team to reply to (if provided)"),
      }),
      execute: async ({ subject, message, user_email }) => {
        const apiKey = process.env.RESEND_API_KEY
        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "Email sending is not configured. The RESEND_API_KEY environment variable is missing.",
              },
            ],
            isError: true,
          }
        }

        const to = process.env.SUPPORT_EMAIL
        if (!to) {
          return {
            content: [
              {
                type: "text",
                text: "No support email configured. The SUPPORT_EMAIL environment variable is missing.",
              },
            ],
            isError: true,
          }
        }

        const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

        const body: Record<string, unknown> = {
          from,
          to: [to],
          subject: `[Support Agent] ${subject}`,
          text: user_email
            ? `${message}\n\n---\nUser email: ${user_email}`
            : message,
        }

        if (user_email) {
          body.reply_to = user_email
        }

        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
          })

          if (!res.ok) {
            const err = await res.text()
            return {
              content: [
                {
                  type: "text",
                  text: `Failed to send email (${res.status}): ${err}`,
                },
              ],
              isError: true,
            }
          }

          const data = await res.json()
          return {
            content: [
              {
                type: "text",
                text: `Email sent successfully (id: ${data.id}). The team will follow up.`,
              },
            ],
          }
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `Error sending email: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          }
        }
      },
    }),
  },
})
