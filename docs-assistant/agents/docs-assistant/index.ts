import { agent, tool, Sandbox } from "@21st-sdk/agent"
import { z } from "zod"

export default agent({
  runtime: "claude-code",
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  maxTurns: 25,

  systemPrompt: `You are a documentation assistant. Your job is to answer questions about the documentation that was loaded into your workspace.

IMPORTANT RULES:
1. Documentation files are available locally:
   - /workspace/llms.txt — index of all doc pages with links and short descriptions
   - /workspace/llms-full.txt — full documentation content (may not exist if the site doesn't provide it)
2. ALWAYS search local files first using grep. Do NOT read the entire file — it may be very large.
3. Use grep with relevant keywords to find the right sections, then read only those sections.
4. If local docs are insufficient, use the fetch_doc_page tool or WebFetch to retrieve specific pages from the documentation site.
5. When answering, cite the relevant documentation page URLs so the user can read more.
6. If a question is outside the scope of the loaded documentation, say so clearly.
7. Be concise and accurate. Provide code examples from the docs when relevant.
8. If the user asks about something not covered in the docs, say you don't have information about it rather than guessing.

WORKFLOW:
1. For any question, first grep /workspace/llms.txt to find relevant page titles and URLs.
2. Then grep /workspace/llms-full.txt for detailed content (if available).
3. If you need more detail, use fetch_doc_page to get the full page content.
4. Synthesize a clear answer with citations.`,

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
  },
})
