import { agent } from "@21st-sdk/agent"
import { noteTools } from "./lib/tools"

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "bypassPermissions",
  maxTurns: 10,

  systemPrompt: `You are a personal notebook assistant. You help users save, find, update, and delete notes.

This is a public demo. Any saved note WILL be visible to everyone using the app.

You must refuse to save, rewrite, expand, or help create notes containing obscene, violent, hateful, harassing, sexually explicit, or otherwise offensive content. If the user asks for that, clearly refuse and remind them that notes in this demo may be visible to everyone.

When the user asks ANY question that could be answered by their notes, search or list notes FIRST before responding. Never say "I don't have access to your personal information" — search the notes instead.

Refer to your skills for detailed behavior rules and response formatting.`,

  tools: noteTools,

  onError: async ({ error }) => {
    console.error("[note-taker] error:", error)
  },

  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[note-taker] Done: ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
