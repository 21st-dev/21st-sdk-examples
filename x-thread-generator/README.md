# 21st SDK — X Thread Generator

An agent that drafts Twitter/X threads. Paste a blog post or give a topic,
pick a style, and the agent streams a numbered thread into a Twitter-style
preview — with ray.so-style code blocks, OG link/video/file previews, mock
engagement, and a Customize popover for the screenshot look.

> **Standalone template.** Every file this app needs lives inside this folder
> — no workspace packages, no cross-template imports. Copy it out as its own
> repo and it will run unchanged:
>
> ```bash
> npx degit 21st-dev/21st-sdk-examples/x-thread-generator my-thread-agent
> cd my-thread-agent && npm install
> ```

## What you'll build

A Next.js app with three panes:

- **Prompt sidebar (left)** — sections: Voice reference, Quick drafts, Dev
  launches (with code snippets), Refine.
- **Thread preview (center)** — Twitter-style tweet cards, thread line, mock
  engagement counters, per-tweet code blocks, link/video/file attachments.
  Toolbar: Style toggle (`punchy / thoughtful / meme`) · Code theme picker
  (18 ray.so-style themes) · Customize popover · Copy thread.
- **Agent chat (right)** — full conversational interface from `@21st-sdk/react`.

### Key features

**Voice reference.** Set `@handle` (fetched once from Twitter's public
syndication endpoint and cached 10 min server-side) or paste 5–10 of your
tweets. Samples ride along in the hidden system note as `AUTHOR_STYLE`; the
agent matches your rhythm and lexicon without copying topics or revealing
the source.

**Code blocks.** The agent can attach a `codeBlock: { lang, code, filename }`
to any tweet. The UI renders it as a **ray.so-style** card: gradient frame,
window with chrome, shiki-highlighted body. Five branded frames (Vercel,
Supabase, Tailwind, OpenAI, Resend) plus a Default frame for the rest —
ported from raycast/ray-so's actual source. 18 dark-mode themes. The file
icon (TS/JS/JSON/PY are real VSCode-style SVGs from our own codebase, others
are colored badges) updates live as you rename. Renaming `relay.ts` →
`relay.py` re-highlights via shiki.

**Attachments.** Agent can emit `{ kind: "video" | "link" | "file", ... }`
per tweet. Rendered as Twitter's OG video card (16:9 + play overlay +
duration), compact link card (thumb + title + description + domain), or
file card (extension-colored tile + size + pages).

**Engagement.** Mocked per tweet: hook gets the biggest numbers (~1.7K
likes, 133K views), last tweet decent, middle declining. Deterministic
jitter keyed on text length so it stays stable across re-renders.

**Customize popover.** Global overrides: padding, line numbers, background
on/off, file icon on/off. Every setting persists in localStorage.

**Editable filename.** Click the filename in any branded chrome — it's an
inline input. The shiki language follows the extension.

## Prerequisites

- Node.js 20.9+
- A [21st Agents](https://21st.dev/agents) account with an API key

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `API_KEY_21ST` | `.env.local` | Server-side API key (`an_sk_`) for token exchange |

## Quick start

```bash
npx degit 21st-dev/21st-sdk-examples/x-thread-generator my-thread-agent
cd my-thread-agent
npm install
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
cp .env.example .env.local
# add API_KEY_21ST
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Click any prompt in
the sidebar to generate a thread.

## How it works

### Agent (`agents/thread-agent.ts`)

Single tool: `update_thread({ tweets: [{ text, codeBlock?, attachment? }] })`.
Agent is instructed to call it exactly once per turn with the full thread.

System prompt enforces:
- 6–12 tweets, ≤ 280 chars each
- no `1/` prefixes (the UI numbers them)
- first tweet is the hook, last is CTA
- explicit filename for code snippets (`relay.ts`, `schema.prisma`, etc. —
  never `snippet.ts`)
- voice matching when `AUTHOR_STYLE` is in the system note
- attachments only when they genuinely sell the tweet

### Context injection

Every user message is prefixed with a hidden block:

```ts
[[[SYSTEM NOTE:
  CURRENT_THREAD: [...] |
  STYLE: "punchy" |
  AUTHOR_STYLE: {"handle": "...", "samples": [...]}
]]]
```

Stripped from the UI. `AUTHOR_STYLE` is only injected when the user has
loaded ≥ 3 samples AND the "Match my voice" toggle is on. `]]]` in samples
is escaped to `]]_]` so no injection.

### Voice reference

Server-side fetch at `POST /api/style/fetch`:

- Pulls `https://syndication.twitter.com/srv/timeline-profile/screen-name/<handle>`
  (the same unofficial endpoint Twitter's own embeds use, no auth).
- Parses `full_text` occurrences out of the embedded JSON with a plain regex.
- Strips `t.co` shortlinks, leading RT/@-mentions, trims empty/duplicate
  samples, caps at 10.
- In-memory cache per handle for 10 min so repeated clicks don't burn the
  ~30/min rate-limit budget. Pass `{ fresh: true }` to bypass (used by the
  Refresh button).
- On 429 the response includes `retryAfterSeconds` so the UI can show
  "retry in N s".

Paste mode is the primary path: works offline, no network. Syndication
fetch is a best-effort bonus.

### Code frames

Each theme renders via a dedicated sub-component in `app/_components/code-frame/`:

- `vercel-frame.tsx` — black background, extending gridlines + corner brackets.
- `supabase-frame.tsx` — `#121212` / `#171717` window, `#1f1f1f` header bar
  with file icon + editable filename (IBM Plex Mono) + lang label.
- `tailwind-frame.tsx` — deep navy, faded gridlines with mask-image, blurred
  sky→pink gradient streak.
- `openai-frame.tsx` — `#121a29` / `#232b41`, heavy multi-layer drop shadow.
- `resend-frame.tsx` — radial gradient backdrop, translucent blurred window.
- `default-frame.tsx` — generic ray-so DefaultFrame (mac-dots, minimal, or
  branded chrome based on theme metadata).

Shared `shared.tsx`:
- `useShikiHtml(code, lang)` — dynamic import of shiki, CSS-variable theme
  so swapping `CodeTheme` re-skins tokens without re-highlighting.
- `FrameActions` — hover overlay with `rename` / `copy` / `png` buttons.
  `png` uses `html-to-image` at 2× pixelRatio.
- `EditableFilename` — inline text input that looks like plain text (grid
  hack with invisible measurer + `size={1}` input so flex centering works).
- `langFromFilename(name, fallback)` — `"relay.py"` → `"python"` for shiki.

### Tweet attachments

`app/_components/tweet-attachment.tsx` — discriminated union on `kind`:

- `video`: 16:9 thumbnail (gradient fallback), centered play button, duration
  badge, domain footer.
- `link`: horizontal card — 130px thumb left, title + description + domain
  right.
- `file`: colored extension tile (shared with code-frame icons via
  `lib/file-icons.ts`) + filename + size + pages/mime.

### File icons

`lib/file-icons.ts` → map of 50+ extensions to `{ label, bg, fg? }`. Reused
by both code-frame headers and file-attachment tiles.

`app/_components/code-frame/file-ext-icon.tsx` — renders brand-accurate SVG
for TS/TSX, JS/JSX/MJS/CJS, JSON/JSONC, PY (ported verbatim from the
private 21st codebase). Falls back to a colored text-badge for the rest.

### State

Three localStorage-backed slots via `app/_hooks/use-persistent-state.ts`:

- `x_thread_author_style` — voice reference
- `x_thread_code_theme` — selected theme id
- `x_thread_code_settings` — padding / line numbers / background / file icon

## Try it out

**Quick drafts:**

- "Write a thread about what I learned shipping my first SaaS. 8 tweets."
- "Turn this into a thread: '...'"
- "Write a thread sharing 5 non-obvious tips for prompting Claude."

**Dev launches (with code blocks):**

- "Draft a launch thread for Relay — a TypeScript background job library.
  Include a codeBlock on tweet 2 (lang: ts, filename: relay.ts) showing
  the 5-line API. 8 tweets."
- "Announce a new CLI tool. codeBlock (bash, install.sh) with install +
  deploy commands; another (ts) showing the agent definition. 8 tweets."

**Refine (run against the current thread):**

- "Tighten every tweet — cut anything that isn't concrete."
- "Rewrite tweet 1 — stronger hook."
- "Shorten to 6 tweets without losing the punchline."

## Project structure

```
x-thread-generator/
├── agents/
│   └── thread-agent.ts               # update_thread tool + system prompt
├── app/
│   ├── api/
│   │   ├── agent/                    # token, sandbox, threads, status
│   │   └── style/fetch/route.ts      # syndication fetch + 10-min cache
│   ├── _components/
│   │   ├── agent-sidebar.tsx
│   │   ├── code-frame/               # ray.so-style frames
│   │   │   ├── index.tsx             # dispatcher by theme.id
│   │   │   ├── default-frame.tsx
│   │   │   ├── vercel-frame.tsx
│   │   │   ├── supabase-frame.tsx
│   │   │   ├── tailwind-frame.tsx
│   │   │   ├── openai-frame.tsx
│   │   │   ├── resend-frame.tsx
│   │   │   ├── file-ext-icon.tsx     # VSCode-style brand SVGs
│   │   │   └── shared.tsx            # useShiki, EditableFilename, etc.
│   │   ├── code-settings.tsx         # Customize popover
│   │   ├── code-themes.ts            # 18 ray.so themes
│   │   ├── setup-checklist.tsx
│   │   ├── tweet-attachment.tsx      # video / link / file cards
│   │   ├── tweet-card.tsx            # Twitter-style tweet
│   │   └── voice-reference.tsx       # handle fetch + paste
│   ├── _hooks/
│   │   ├── use-dismissible.ts        # click-outside + Escape
│   │   └── use-persistent-state.ts   # localStorage-backed useState
│   ├── page.tsx                      # layout + thread state
│   ├── layout.tsx
│   └── globals.css                   # font imports + tokens
├── lib/
│   ├── file-icons.ts                 # extension → badge
│   ├── tool-parts.ts                 # agent-SDK tool-call parsing
│   └── twitter-syndication.ts        # handle → samples
├── .env.example
├── LICENSE
└── package.json
```

## Next steps

- "Post to X" button (OAuth + Twitter API)
- Stream tweets in as they arrive (partial `update_thread` calls) instead
  of one atomic replace
- Per-tweet "Rewrite just this one" button wired to a `refine_tweet` tool
- Export the whole thread to a Typefully / Hypefury draft
- Let the agent pick the code theme from context ("this is a Supabase
  launch → use Supabase theme")

## License

MIT — see `LICENSE`.
