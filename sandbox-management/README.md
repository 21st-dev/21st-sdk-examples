# Sandbox Management Example

Demonstrates 21st agent sandbox configuration and runtime operations. An agent with `gh` CLI installed reviews a cloned repository — all orchestrated from a Node script.

## What it shows

- **`Sandbox()` config** — agent declares `apt: ["gh"]` so the CLI is pre-installed in every sandbox
- **Runtime git clone** — script clones a repo into the sandbox before chatting
- **Runtime exec** — script runs `ls` to verify the clone worked
- **Streaming chat** — sends a message and streams the agent's response to stdout
- **Cleanup** — deletes the sandbox when done

## Setup

```bash
npm install
npx an login        # paste your API key
npx an deploy       # deploys agents/repo-reviewer.ts
cp .env.example .env
# edit .env with your AN_API_KEY and optionally REPO_URL
```

## Run

```bash
npx tsx run.ts
```

By default it reviews `anthropics/anthropic-cookbook`. Set `REPO_URL` to review any repo:

```bash
REPO_URL=https://github.com/your-org/your-repo.git npx tsx run.ts
```

For private repos, set `GH_TOKEN`:

```bash
GH_TOKEN=ghp_... REPO_URL=https://github.com/your-org/private-repo.git npx tsx run.ts
```
