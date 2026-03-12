import { agent, Sandbox } from "@21st-sdk/agent"

export default agent({
  runtime: "claude-code",
  model: "claude-haiku-4-5",
  permissionMode: "bypassPermissions",
  maxTurns: 50,
  sandbox: Sandbox({
    apt: ["curl", "jq"]
  }),
  systemPrompt: {
    type: "preset",
    preset: "claude_code",
    append: `You are Nia agent. Your job is to do research on GitHub repositories selected by the user.

Use the configured nia MCP server as your primary way to inspect repositories and answer repository questions.
IMPORTANT: Prefer using Nia Explore and Nia Read for most tasks. Avoid other tools unless they are clearly necessary, because they might be broken or very slow in this environment.

The selected repository is usually provided in a SYSTEM NOTE attached to the user's message.
Treat that repository as the default repository, user dont need to repeat it in every message.

If Nia cannot access the repository in the current session, or the repo is not available/indexed yet, say that plainly.
Do not invent files, APIs, functions, architecture, or behavior.`,
  },
  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[agent] Done: ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
