# 21st SDK Examples

Example projects for the [21st SDK](https://21st.dev/agents) — deploy AI coding agents and connect them to your app.

## Examples

| Example | Description | Stack |
|---------|-------------|-------|
| [`nextjs-chat`](./nextjs-chat) | Chat UI connected to a deployed agent with web search | Next.js, @21st-sdk |
| [`nia-chat`](./nia-chat) | Same chat UI pattern, but wired to Nia MCP for GitHub repository analysis | Next.js, @21st-sdk |
| [`nextjs-fill-form`](./nextjs-fill-form) | AI-powered form filling with tabbed forms + chat | Next.js, React Hook Form, @21st-sdk |
| [`email-agent`](./email-agent) | Email operations copilot — send, read inbox, auto-reply via AgentMail | Next.js, AgentMail, @21st-sdk |
| [`note-taker`](./note-taker) | AI notebook assistant with persistent notes via Convex | Next.js, Convex, @21st-sdk |
| [`monitor-agent`](./monitor-agent) | Service health monitoring with Slack alerts | Node.js CLI, @21st-sdk |
| [`python-terminal-chat`](./python-terminal-chat) | Minimal terminal chat client using the Python SDK | Python, 21st-sdk |

## Quick Start

Each example is self-contained. Pick one, navigate to its directory, and follow its README:

```bash
cd nextjs-chat
pnpm install
npx an login
npx an deploy
cp .env.example .env.local
pnpm dev
```

## Links

- [21st Agents](https://21st.dev/agents)
- [21st Docs](https://21st.dev/agents/docs)
- [@21st-sdk/agent](https://www.npmjs.com/package/@21st-sdk/agent)
- [@21st-sdk/react](https://www.npmjs.com/package/@21st-sdk/react)
- [@21st-sdk/nextjs](https://www.npmjs.com/package/@21st-sdk/nextjs)
- [@21st-sdk/cli](https://www.npmjs.com/package/@21st-sdk/cli)
