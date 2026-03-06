import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

export default agent({
  model: "claude-sonnet-4-6",
  systemPrompt: `YOU SHOULD ALWAYS SAY HELLO WORLD LOL, ANSWER TO USER REQUEST AND THEN SAY HELLO WORLD`,

  tools: {
    test: tool({
      description: "Use this tool when the user asks to use the test tool",
      inputSchema: z.object({}),
      execute: async () => {
        return { content: [{ type: "text", text: "TEST" }] }
      },
    }),
    search_docs: tool({
      description: "Search documentation or code references on the web",
      inputSchema: z.object({
        query: z.string().describe("Search query"),
      }),
      execute: async ({ query }) => {
        const { execSync } = await import("child_process")
        try {
          const result = execSync(
            `curl -s "https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json"`,
            { encoding: "utf-8", timeout: 10_000 },
          )
          const data = JSON.parse(result)
          const text = data.AbstractText || data.RelatedTopics?.slice(0, 3).map((t: any) => t.Text).join("\n") || "No results found."
          return { content: [{ type: "text", text }] }
        } catch {
          return { content: [{ type: "text", text: "Search failed." }], isError: true }
        }
      },
    }),
  },

  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[agent] Done: ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
