# 21st SDK — Video Editor (ffmpeg-in-sandbox)

Non-linear video editor where rendering happens inside the agent's own sandbox with **ffmpeg**. No third-party video-editing API. You get a real timeline (tracks, clips, trim handles, playhead), a chat where the agent can mutate the timeline or kick off renders, and a preview that plays whatever ffmpeg just produced.

**Demo-first:** works with zero extra credentials — renders upload to catbox.moe out of the box.
**Production path:** one env-var flip sends renders to your own Supabase Storage / R2 bucket — see [Scaling to production](#scaling-to-production).

---

## What makes this different from the usual "cloud video API" template

| | Cloud-API approach (Shotstack, Creatomate…) | This template |
|---|---|---|
| Rendering | Vendor-hosted, JSON Edit → MP4 URL | `ffmpeg` in the agent sandbox |
| State | Stateless chat, agent re-sends full edit JSON each turn | Persistent `Project` model; UI + agent mutate via small ops |
| UI | Chat + preview | **NLE**: tracks, clips, trim handles, playhead, inspector, chat |
| Costs | Per-minute vendor pricing | Just sandbox compute + egress |
| Custom filters | Whatever vendor exposes | Full ffmpeg (drawtext, overlay, xfade, amix, …) |

---

## Architecture at a glance

```
┌───────────────────── Browser ─────────────────────┐
│  Timeline UI (drag/trim/inspect)                  │
│  Agent Chat                                       │
│          │                       │                │
│          ▼ dispatches ops        ▼ `sendMessage`  │
│  ┌──────────────────────────────────────────────┐ │
│  │  Project reducer (app/lib/project-ops.ts)    │ │
│  │     add_clip · trim_clip · move_clip · …     │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────────────┘
                         │ system-note prefix:
                         │   [[[SYSTEM NOTE: PROJECT: {...} ]]]
                         ▼
┌─────────────── Agent sandbox (21st) ──────────────┐
│  tools:                                           │
│    probe_asset(url)       → ffprobe               │
│    update_timeline({ops}) → same reducer shape    │
│    render_project({project, preview})             │
│       ├── ensureLocalCopy() for every asset       │
│       ├── compileProject() → ffmpeg args          │
│       ├── spawn ffmpeg                            │
│       └── uploadRender() → Supabase OR catbox     │
└───────────────────────────────────────────────────┘
```

Both **drag-edits** in the timeline UI and **agent tool calls** land in the same `applyOp(project, op)` reducer — so the two stay in sync automatically.

---

## Project structure

```
video-editor/
├── agents/
│   ├── video-editor.ts              # Agent definition (deploy this)
│   └── lib/
│       ├── env.ts                   # Loads /home/user/.env inside the sandbox
│       ├── project-schema.ts        # Zod mirrors of the project + ops shapes
│       ├── storage.ts               # Upload: Supabase (prod) / catbox (demo)
│       ├── tools.ts                 # probe_asset, update_timeline, render_project
│       └── ffmpeg/
│           ├── run.ts               # spawn wrappers + ensureFfmpeg + probeMedia
│           ├── download.ts          # URL → /tmp/... (cached by URL hash)
│           └── compile.ts           # Project → ffmpeg args (filter_complex)
├── app/
│   ├── api/agent/
│   │   ├── sandbox/route.ts         # Create / cache agent sandboxes
│   │   ├── threads/route.ts         # List / create threads
│   │   ├── threads/[threadId]/route.ts  # GET thread + messages (hydration)
│   │   ├── token/route.ts           # createTokenHandler
│   │   └── status/route.ts          # Env checks for the sidebar checklist
│   ├── _components/
│   │   ├── agent-sidebar.tsx
│   │   └── setup-checklist.tsx
│   ├── components/
│   │   ├── asset-library.tsx        # URL asset input + thumbnail strip
│   │   ├── inspector.tsx            # Selected-clip editor (trim, volume, overlay)
│   │   ├── video-preview.tsx        # Preview player + Render / Preview buttons
│   │   └── timeline/
│   │       ├── Timeline.tsx         # Ruler + tracks + playhead + zoom
│   │       ├── Ruler.tsx
│   │       ├── ClipBlock.tsx        # Block with left/right trim handles
│   │       └── Playhead.tsx
│   ├── lib/
│   │   ├── project.ts               # Data types + derived helpers
│   │   ├── project-ops.ts           # Reducer (applyOp / applyOps)
│   │   └── timeline-geom.ts         # px ↔ seconds, snap, tick interval
│   ├── page.tsx                     # NLE layout glue
│   ├── layout.tsx
│   ├── globals.css
│   └── sample-data.ts               # Sample assets + prompt starters
├── .env.example
└── package.json
```

---

## Setup (demo mode — no storage credentials needed)

### 1. Clone and install

```bash
git clone https://github.com/21st-dev/21st-sdk-examples.git
cd 21st-sdk-examples/video-editor
npm install
```

### 2. Configure

```bash
cp .env.example .env.local
# Put your API_KEY_21ST in .env.local
```

### 3. Deploy the agent

```bash
npx @21st-sdk/cli login
npx @21st-sdk/cli deploy
```

### 4. Run the UI

```bash
npm run dev
# open http://localhost:3000
```

Click **Load sample** in the asset library to get a handful of verified public clips. Drop one onto the timeline, press **Render**, and a ~10-second MP4 will come back through the preview player within a minute.

---

## The agent's three tools

| Tool | What it does |
|------|--------------|
| `probe_asset({ url })` | Runs `ffprobe` on a public URL, returns `{ duration, width, height, hasAudio, videoCodec, audioCodec }`. Called automatically whenever the agent discovers an asset without a known duration. |
| `update_timeline({ ops, summary })` | Mutates the project. Ops: `add_asset`, `update_asset`, `remove_asset`, `add_clip`, `remove_clip`, `move_clip`, `trim_clip`, `set_volume`, `set_text_overlay`, `set_output`, `add_track`, `remove_track`, `clear_timeline`. Client applies them through the same reducer the drag UI uses. |
| `render_project({ project, preview })` | Downloads every referenced asset to `/tmp/video-editor/media/` (cached by URL hash), compiles a single `filter_complex` graph, runs ffmpeg, uploads the result, returns a public URL. `preview=true` uses `-preset ultrafast -crf 28` for fast iteration. |

The UI injects the current project into every message as a hidden system-note block, so the agent always sees the canonical state before deciding what ops to emit.

---

## Scaling to production

The demo works because **catbox.moe** accepts anonymous uploads and the sandbox fetches its assets from public URLs. Neither is a good production default. Here's how to harden each piece.

### 1. Storage → Supabase or R2

Create a **public** bucket (e.g. `video-renders`) in your Supabase project. Then set the env on the agent runtime and redeploy:

```bash
npx @21st-sdk/cli env set video-editor \
  SUPABASE_URL=https://your-project.supabase.co \
  SUPABASE_SERVICE_KEY=eyJ...your-service-role-key...

npx @21st-sdk/cli deploy
```

`agents/lib/storage.ts` auto-detects those env vars and switches backends. No code change needed.

For **Cloudflare R2 / S3-compatible**, replace `uploadRender` with an `aws-sdk/client-s3` PutObject call — the contract (take a local path, return `{ url, backend, bytes }`) is what the rest of the pipeline relies on. Signed-URL delivery is one `.getSignedUrl(...)` away.

### 2. Source media → your own storage

Right now assets are "paste a public URL". For user-uploaded files add a small upload endpoint that writes to the same bucket and returns a signed URL; the agent's `probe_asset` + `render_project` tools work unchanged because they only read URLs.

### 3. Database-backed projects

The project JSON currently lives in `localStorage`. For multi-user, multi-device editing:

- Persist the `Project` shape in Postgres (one row per project, JSONB column for the body, plus a normalised `clips` table if you want to query them).
- Swap the two `useEffect` blocks in `page.tsx` that hydrate/persist from `localStorage` for fetch calls to `/api/projects/:id`.
- Append the `update_timeline` op log to a `project_events` table to get free undo/redo and per-user audit.

### 4. ffmpeg availability

The template assumes `ffmpeg` + `ffprobe` are on `PATH` in the sandbox. If your sandbox image doesn't ship with them:

- **Preferred:** bake them into your sandbox template / Dockerfile (`apt-get install -y ffmpeg`).
- **Fallback:** at agent startup, shell out to install them. Adds ~20s to the first tool call; fine for prototypes, wrong for production.

`ensureFfmpeg()` in `agents/lib/ffmpeg/run.ts` already returns a friendly error if the binary is missing, so the UI stays functional and tells the user what to do.

### 5. Scaling the render itself

The MVP compiles a single `filter_complex` graph per render. That's easy to read but can't be cached per-clip.

Next hops:
- **Segmented rendering** — render each clip to `segment_<id>.mp4` with a tight cache key (`hash(assetUrl, trimIn, length, filters)`), then concat. A 10-clip project that changes one trim becomes a 1-segment re-render.
- **Job queue** — wrap `render_project` in a BullMQ / Inngest job so the preview player can stream partial progress instead of blocking the tool call.
- **Hardware encoding** — swap `libx264` for `h264_videotoolbox` on Mac, `h264_nvenc` on NVIDIA, drops encode time ~5×.
- **Stream preview** — serve the rendered MP4 from an endpoint that supports HTTP range requests (every S3-compatible store does) so the `<video>` tag can seek without downloading the full file.

### 6. Transitions / effects / text beyond what's shipped

`compileProject` intentionally keeps the graph simple. To extend:

- **Crossfades** — detect neighbouring clips with `start+length > next.start` on the same track; splice an `xfade` filter at the overlap.
- **Per-clip effects** — append `brightness=…`, `eq=`, `setpts=N*PTS` (speed ramp) etc. after the `trim` filter in `compile.ts`. Add matching op types to both `project-ops.ts` and `project-schema.ts`.
- **HTML overlays** — render an HTML snippet to PNG with `@vercel/og` / `satori`, include it as an image input, overlay it. Useful for brand-heavy titles.

---

## Known limits of the MVP

- No cross-fades between clips (neighbouring clips cut directly).
- No Ken-Burns / pan-zoom on still images (held at one position for the clip duration).
- Audio mixing is linear `amix` — no ducking or sidechain.
- Rendered MP4s aren't proxy-cached; every render starts from scratch.
- Drag-and-drop **assets onto tracks** is not implemented — click an asset tile to append to the matching track, or let the agent do it via `add_clip`.

Every one of those is a short feature away; each has a concrete extension point called out in _Scaling to production_.

---

## Troubleshooting

**Render fails with `ffmpeg: not found`.**
The sandbox image doesn't include ffmpeg. Rebuild with `apt-get install -y ffmpeg` in your sandbox template, or add a startup tool call that runs the install.

**catbox.moe uploads fail on the very first render.**
Occasionally rate-limited on free IPs. Just retry — or switch to Supabase which has much higher limits.

**Agent keeps saying "asset has no duration".**
Something blocked `ffprobe` from reading the URL (CORS, auth, anti-bot). Inspect the tool output for the ffprobe stderr — or upload the file to your own bucket first.

**UI shows an old render / stuck in "Rendering".**
Press **Reset session** in the sidebar. It clears sandbox + thread + messages from localStorage and starts fresh.
