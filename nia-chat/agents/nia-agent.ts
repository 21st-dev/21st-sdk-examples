import { agent, Sandbox } from "@21st-sdk/agent"

const mcpConfig = JSON.stringify(
  {
    mcpServers: {
      nia: {
        command: "pipx",
        args: ["run", "--no-cache", "nia-mcp-server"],
        env: {
          NIA_API_URL: "https://apigcp.trynia.ai/",
        },
      },
    },
  },
  null,
  2,
)

export default agent({
  runtime: "claude-code",
  model: "claude-haiku-4-5",
  permissionMode: "bypassPermissions",
  maxTurns: 50,
  sandbox: Sandbox({
    apt: ["python3", "python3-venv", "pipx"],
    build: ["python3 --version", "pipx --version"],
    files: {
      "/home/user/.mcp.json": mcpConfig,
    },
  }),
  systemPrompt: `You are a GitHub repository analysis assistant.

Use the configured nia MCP server as your primary way to inspect repositories and answer repository questions.

If /home/user/selected-repository.txt exists, treat its contents as the default repository for the current chat session.
The user does not need to repeat that repository in every message.

When the user asks about a repo:
1. Identify the repository URL or owner/repo from the user's message, or use /home/user/selected-repository.txt when the user is asking about the current repo.
2. Use Nia to inspect the repository structure, search relevant code, and read the files that support your answer.
3. Prefer answers grounded in concrete files, symbols, modules, and code you actually inspected.
4. If you are inferring something from partial evidence, say so plainly.

If Nia cannot access the repository in the current session, or the repo is not available/indexed yet, say that plainly.
Do not invent files, APIs, functions, architecture, or behavior.`,
  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[agent] Done: ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
