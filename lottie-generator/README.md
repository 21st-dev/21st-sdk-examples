# 21st SDK — Lottie Generator

An agent that turns plain-language prompts into **Lottie (Bodymovin) JSON** animations. Split layout: live preview on the left, chat on the right. One tool (`render_lottie`) — no external APIs, no GPU.

## What you'll build

- **Agent**: a Claude Sonnet agent with a single `render_lottie` tool that emits validated Lottie JSON (shape layers, animated transforms, loops).
- **UI**: live `lottie-react` preview with pause/play, copy JSON, download `.json`.
- **Pattern**: the client watches the latest `render_lottie` tool call and re-renders the canvas on every new iteration.

No heavy models. The agent writes Lottie JSON directly from a compact format cheatsheet in its system prompt.

## Prerequisites

- Node.js 18+
- A [21st Agents](https://21st.dev/agents) account with an API key (`an_sk_...`)

## Environment variables

| Variable | Where | Description |
|----------|-------|-------------|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

```bash
git clone https://github.com/21st-dev/21st-sdk-examples.git
cd 21st-sdk-examples/lottie-generator
cp .env.example .env.local
npm install
```

Add `API_KEY_21ST` to `.env.local`, then deploy the agent:

```bash
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
```

Run locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Example prompts

- `Bouncing ball loader, 3 bounces per loop, blue`
- `Rotating spinner with 8 dots fading in sequence`
- `Pulsing heart, 1 second loop, red gradient`
- `Morphing square to circle, 60fps`
- `Animated AI brain — nodes connecting with glow lines`
- `Make the last one slower and more bouncy`
- `Change the color to purple and add a drop shadow`

Every follow-up triggers a new full `render_lottie` call — the preview swaps in-place.

## Project structure

```
lottie-generator/
├── agents/
│   └── lottie-generator.ts        # Agent + render_lottie tool (Zod-validated)
├── app/
│   ├── _components/               # Shared 21st SDK sidebar + setup checklist
│   ├── api/agent/
│   │   ├── sandbox/route.ts       # Creates agent sandbox
│   │   ├── status/route.ts        # Env status for setup checklist
│   │   ├── threads/route.ts       # Creates/lists threads
│   │   └── token/route.ts         # Token handler for streaming auth
│   ├── components/
│   │   ├── lottie-canvas.tsx      # Lottie preview (copy / download / pause)
│   │   └── lottie-tool-renderer.tsx # Inline chip shown in chat per tool call
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                   # Split canvas + chat, parses tool output
│   └── types.ts
├── .env.example
└── package.json
```

## How it works

### Agent (`agents/lottie-generator.ts`)

Single tool. Input schema is the full Lottie JSON plus a name and description. The agent has a compact Lottie cheatsheet in its system prompt — canvas size, frame rate, `ks` transforms (opacity/rotation/position/anchor/scale), shape primitives (`el`, `rc`, `sr`, `sh`), fills, strokes, animated keyframes.

```ts
render_lottie({
  animation: { v: "5.7.1", fr: 60, ip: 0, op: 120, w: 400, h: 400, layers: [...] },
  name: "Bouncing ball",
  description: "Blue ball bounces 3× per 2-second loop"
})
```

The tool's `execute` validates with a Zod `passthrough` schema (top-level keys required, inner layers typed loose). On success, it returns a JSON string with metadata (`width`, `height`, `frameRate`, `durationSeconds`, `layerCount`, `animation`). On validation failure, it returns structured Zod issues so the agent can self-correct on the next turn.

### Client (`app/page.tsx`)

Same pattern as the `fill-form` example — keyed by `toolCallId`, the client:

1. Walks every message's `parts` (newest first) looking for a `render_lottie` part with a non-preliminary payload.
2. Extracts JSON text from the tool output (handles string, array-of-text-parts, and numeric-key object shapes).
3. Parses into a `RenderLottiePayload` and sets it on state.
4. `LottieCanvas` re-renders via `lottie-react` (dynamic import to avoid SSR).

The tool chip in chat is rendered by `RenderLottieRenderer` — a compact badge with the name, dimensions, duration, and layer count. The big JSON never shows up inline.

### Download

The canvas exposes **Copy JSON** and **Download `.json`** — works with any Lottie player (After Effects, LottieFiles, `@lottiefiles/dotlottie-react`, etc.). For `.lottie` zipped format, convert the JSON at https://lottiefiles.com/tools/json-to-dotlottie.

## Extending

- **Multiple variants**: change `render_lottie` to accept `variants: [{ name, animation }]` and render a grid.
- **Style presets**: inject a style token into the system prompt (e.g. "flat", "neon", "skeuomorphic") via a hidden SYSTEM NOTE prefix, same trick as the `fill-form` example.
- **Library search**: add a second tool that searches LottieFiles via their public API — agent picks one, tweaks colors, re-emits as `render_lottie`.
- **Export `.lottie`**: run `pnpm add @lottiefiles/dotlottie-js`, pack the JSON into a dotLottie bundle in a new `/api/export` route.
- **OmniLottie fallback**: for prompts the agent struggles with, hand off to a self-hosted OmniLottie endpoint (CVPR 2026, 4B VLM → Lottie JSON) behind a `render_lottie_vlm` tool.
