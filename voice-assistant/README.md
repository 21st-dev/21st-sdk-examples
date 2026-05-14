# 21st SDK — Voice Assistant Example

A voice assistant that runs in the browser using [Vapi](https://vapi.ai) for real-time voice (WebRTC: STT → LLM → TTS) and [21st SDK](https://21st.dev/agents) for the backing agent.

## What you'll build

- Real-time voice conversation in the browser — click a button and talk
- Live transcript of the conversation
- Claude Sonnet as the language model via Vapi
- ElevenLabs voice synthesis

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account and API key
- A [Vapi](https://dashboard.vapi.ai) account and **public** API key

## Environment variables

| Variable | Description |
|----------|-------------|
| `API_KEY_21ST` | Server-side 21st Agents API key (`an_sk_...`) |
| `NEXT_PUBLIC_VAPI_KEY` | Vapi **public** key — safe to expose in the browser |

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/an-examples.git
cd an-examples/voice-assistant
npm install
```

### 2. Deploy the agent

```bash
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
```

### 3. Configure and run

```bash
cp .env.example .env.local
# Fill in API_KEY_21ST and NEXT_PUBLIC_VAPI_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click the mic button, allow microphone access, and start talking.

## How it works

### Voice (`app/components/voice-panel.tsx`)

Uses `@vapi-ai/web` loaded dynamically on the client. When the user clicks the mic button:

1. Vapi opens a WebRTC connection to its cloud
2. Deepgram transcribes speech in real time
3. Claude Sonnet generates a response
4. ElevenLabs synthesizes and plays the audio response
5. Transcript entries stream into the UI

The Vapi public key is read from `process.env.NEXT_PUBLIC_VAPI_KEY` — it is safe to expose in the browser.

### Agent (`agents/voice-assistant.ts`)

A standard 21st SDK agent with a `search_web` tool. It backs the text layer and can be extended with more tools.

## Project structure

```
voice-assistant/
├── agents/
│   └── voice-assistant.ts         # 21st SDK agent definition
├── app/
│   ├── api/agent/
│   │   ├── sandbox/route.ts       # Sandbox creation
│   │   ├── threads/route.ts       # Thread management
│   │   └── token/route.ts         # JWT token exchange
│   ├── components/
│   │   └── voice-panel.tsx        # Voice UI (Vapi web SDK)
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── .env.example
└── package.json
```
