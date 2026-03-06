import { agent, Sandbox } from "@21st-sdk/agent"

export default agent({
  model: "claude-sonnet-4-6",
  sandbox: Sandbox({
    apt: ["gh"],
    cwd: "/home/user/repo",
  }),
  systemPrompt: `You are a code reviewer. A repository has been cloned at /home/user/repo.

Your job:
1. Explore the repository structure
2. Read key files (README, configs, main source files)
3. Identify potential issues: bugs, security concerns, code smells, missing tests
4. Provide a structured review with actionable feedback

Use the gh CLI if you need to interact with GitHub (e.g., check open issues or PRs).
Keep your review concise and focused on the most important findings.`,
  onFinish: async ({ cost, duration, turns }) => {
    console.log(`Review complete: ${turns} turns, ${(duration / 1000).toFixed(1)}s, $${cost.toFixed(4)}`)
  },
})
