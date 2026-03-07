# 21st SDK — Python Terminal Chat

A minimal terminal chat example for the 21st Python SDK. It connects to a deployed agent, creates a sandbox and thread, then streams responses directly in your terminal.

## What you'll build

- **CLI-only chat** with no frontend
- **Streaming text output** from a deployed agent
- **One sandbox + one thread per process** so follow-up turns continue the same session
- **Optional `.env` config** for quick local testing

## Prerequisites

- Python 3.9+
- A deployed [21st Agent](https://21st.dev/agents)
- A 21st API key (`an_sk_...`)

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `API_KEY_21ST` | `.env` or shell | Server-side API key |
| `AGENT_SLUG` | `.env` or shell | Deployed agent slug to chat with |

## Quick start

### 1. Clone and enter the example

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/python-terminal-chat
```

### 2. Create a virtual environment

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
```

### 3. Install the SDK

```bash
python -m pip install 21st-sdk
```

### 4. Install the example

```bash
python -m pip install .
cp .env.example .env
# Edit .env with your API_KEY_21ST and AGENT_SLUG
```

This installs the small CLI from this folder so you can run `python-terminal-chat` from your shell.

### 5. Run it

```bash
python-terminal-chat
```

## Usage

Type messages and press Enter.

Commands:

- `/new` — start a fresh thread in the same sandbox
- `/exit` — quit the program

## How it works

1. Loads `API_KEY_21ST` and `AGENT_SLUG` from `.env` or your shell
2. Creates `AgentClient(api_key=..., base_url=...)`
3. Creates a sandbox for the deployed agent
4. Creates a thread inside that sandbox
5. For each user message:
   - appends the message to local chat history
   - calls `client.threads.run(...)`
   - reads the SSE stream from `result.response`
   - prints `text-delta` chunks to the terminal
   - appends the final assistant text back into local history

## Example session

```text
$ python-terminal-chat
Connected to agent: support-agent
Sandbox: 1d5f...
Thread: 97a1...

you> summarize what this agent can do
assistant> I can answer questions, use tools, and work inside a persistent sandbox.

you> /new
Started a new thread: 2f9d...

you> quit
```

## Project structure

```text
python-terminal-chat/
├── .env.example
├── pyproject.toml
├── README.md
└── src/
    └── python_terminal_chat/
        ├── __init__.py
        └── cli.py
```
