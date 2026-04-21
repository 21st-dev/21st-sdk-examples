"use client"

import { AgentChat, createAgentChat } from "@21st-sdk/nextjs"
import "@21st-sdk/react/styles.css"
import type { Chat } from "@ai-sdk/react"
import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { useSearchParams } from "next/navigation"
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { SAMPLE_ASSETS, SAMPLE_PROMPTS } from "./sample-data"
import type { ThreadItem } from "./types"
import { AssetPanel } from "./components/asset-panel"
import { InspectorDrawer } from "./components/inspector-drawer"
import { ResizableSplit } from "./components/resizable-split"
import { Timeline, MAX_ZOOM_IDX, MIN_ZOOM_IDX } from "./components/timeline/Timeline"
import { TopBar } from "./components/top-bar"
import {
  LivePreview,
  type LivePreviewHandle,
  type RenderStatus,
} from "./components/live-preview"
import {
  type Asset,
  type Clip,
  type Project,
  type ProjectOutput,
  type UUID,
  getAsset,
  getClip,
  newId,
  newProject,
  projectDuration,
} from "./lib/project"
import type { Op } from "./lib/project-ops"
import { useProjectHistory } from "./lib/use-project-history"
import { useShortcuts } from "./lib/use-shortcuts"

const AGENT_SLUG = "video-editor"
const SYSTEM_NOTE_PREFIX = "[[[SYSTEM NOTE:"
const SYSTEM_NOTE_SUFFIX = "]]]"
/**
 * Messages that start with this marker are UI-initiated commands (like
 * "render the project") which we don't want cluttering the visible chat.
 * The agent sees them normally; the user just sees an activity indicator.
 */
const SILENT_PREFIX = "[[[UI-ACTION:"
const SILENT_SUFFIX = "]]]"

const projectStoreKey = (sb: string) => `video-editor:project:${sb}`
const messagesStoreKey = (sb: string, th: string) => `video-editor:messages:${sb}:${th}`
const chatOpenStoreKey = "video-editor:chat-open"

// ───────────────── chat/tool helpers (same as before) ─────────────────

function stripSystemNotePrefix(text: string): string {
  if (!text.startsWith(SYSTEM_NOTE_PREFIX)) return text
  const i = text.indexOf(SYSTEM_NOTE_SUFFIX)
  if (i === -1) return text
  return text.slice(i + SYSTEM_NOTE_SUFFIX.length).trimStart()
}

function isSilentMessage(text: string): boolean {
  return text.startsWith(SYSTEM_NOTE_PREFIX)
    ? isSilentMessage(stripSystemNotePrefix(text))
    : text.startsWith(SILENT_PREFIX)
}

function extractToolPart(part: unknown) {
  if (!part || typeof part !== "object") return null
  const m = part as Record<string, unknown>
  if (typeof m.type !== "string") return null
  const type = m.type
  const toolName = typeof m.toolName === "string" ? m.toolName : undefined
  if (!type.startsWith("tool-") && !toolName) return null
  return {
    type,
    toolName,
    state: typeof m.state === "string" ? m.state : undefined,
    toolCallId: typeof m.toolCallId === "string" ? m.toolCallId : undefined,
    preliminary: typeof m.preliminary === "boolean" ? m.preliminary : undefined,
    input: m.input,
    output: m.output,
    result: m.result,
  }
}

function extractToolText(output: unknown): string | null {
  if (typeof output === "string") return output
  if (Array.isArray(output)) {
    const t = (output as Array<{ type?: string; text?: string }>).find(
      (p) => p?.type === "text" && typeof p.text === "string",
    )
    return t?.text ?? null
  }
  if (output && typeof output === "object") {
    const m = output as { text?: unknown; content?: unknown }
    if (typeof m.text === "string") return m.text
    if (Array.isArray(m.content)) {
      const t = (m.content as Array<{ type?: string; text?: string }>).find(
        (p) => p?.type === "text" && typeof p.text === "string",
      )
      return t?.text ?? null
    }
  }
  return null
}

function parseToolJson(o: unknown): Record<string, unknown> | null {
  const t = extractToolText(o)
  if (!t) return null
  try {
    const v = JSON.parse(t)
    return v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function matchTool(name: string, want: string) {
  return (
    name === want ||
    name.endsWith(`-${want}`) ||
    name.endsWith(`__${want}`) ||
    name.includes(want)
  )
}

// ───────────────── render state ─────────────────

interface RenderState {
  url: string | null
  status: RenderStatus
  errorMessage: string | null
  upload: { backend: string; bytes: number; elapsedMs: number } | null
}

const INITIAL_RENDER: RenderState = {
  url: null,
  status: "idle",
  errorMessage: null,
  upload: null,
}

// ───────────────── chat panel ─────────────────

interface ChatPanelProps {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
  project: Project
  onApplyOps: (ops: Op[]) => void
  onProbeResult: (url: string, info: Partial<Asset>) => void
  onRenderResult: (state: RenderState) => void
  onRenderPending: () => void
  pendingPrompt: string | null
  onPromptConsumed: () => void
}

function ChatPanel({
  sandboxId,
  threadId,
  colorMode,
  project,
  onApplyOps,
  onProbeResult,
  onRenderResult,
  onRenderPending,
  pendingPrompt,
  onPromptConsumed,
}: ChatPanelProps) {
  const chat = useMemo(
    () =>
      createAgentChat({
        agent: AGENT_SLUG,
        tokenUrl: "/api/agent/token",
        sandboxId,
        threadId,
      }),
    [sandboxId, threadId],
  )
  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    chat: chat as Chat<UIMessage>,
  })
  const didHydrateRef = useRef(false)
  const storageKey = messagesStoreKey(sandboxId, threadId)
  const appliedToolCallsRef = useRef<Set<string>>(new Set())
  const lastRenderPhaseRef = useRef<{
    id: string
    phase: "pending" | "done" | "error"
  } | null>(null)

  useEffect(() => {
    if (didHydrateRef.current) return
    didHydrateRef.current = true
    let cancelled = false
    async function hydrate() {
      try {
        const res = await fetch(
          `/api/agent/threads/${encodeURIComponent(threadId)}?sandboxId=${encodeURIComponent(
            sandboxId,
          )}`,
        )
        if (cancelled) return
        if (res.ok) {
          const thread = (await res.json()) as { messages?: UIMessage[] | unknown }
          if (Array.isArray(thread.messages) && thread.messages.length > 0) {
            setMessages(thread.messages as UIMessage[])
            return
          }
        }
      } catch {}
      if (cancelled) return
      try {
        const stored = localStorage.getItem(storageKey)
        if (!stored) return
        const parsed = JSON.parse(stored) as UIMessage[]
        if (!cancelled && parsed.length > 0) setMessages(parsed)
      } catch {}
    }
    hydrate()
    return () => {
      cancelled = true
    }
  }, [sandboxId, threadId, setMessages, storageKey])

  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {}
  }, [messages, storageKey])

  useEffect(() => {
    const updateOps: Op[] = []
    let newRenderPhase: {
      id: string
      phase: "pending" | "done" | "error"
      state: RenderState | null
    } | null = null

    for (const message of messages) {
      for (const part of message.parts) {
        const tp = extractToolPart(part)
        if (!tp) continue
        const name = tp.toolName ?? tp.type.replace(/^tool-/, "")

        if (
          matchTool(name, "update_timeline") &&
          tp.toolCallId &&
          !appliedToolCallsRef.current.has(tp.toolCallId)
        ) {
          const body = parseToolJson(tp.output ?? tp.result)
          if (body?.ops && Array.isArray(body.ops)) {
            updateOps.push(...(body.ops as Op[]))
            appliedToolCallsRef.current.add(tp.toolCallId)
          }
        }

        if (
          matchTool(name, "probe_asset") &&
          tp.toolCallId &&
          !appliedToolCallsRef.current.has(tp.toolCallId)
        ) {
          const body = parseToolJson(tp.output ?? tp.result)
          if (body?.url && typeof body.url === "string") {
            onProbeResult(body.url, {
              duration: typeof body.duration === "number" ? body.duration : null,
              width: typeof body.width === "number" ? body.width : null,
              height: typeof body.height === "number" ? body.height : null,
              hasAudio: typeof body.hasAudio === "boolean" ? body.hasAudio : null,
            })
            appliedToolCallsRef.current.add(tp.toolCallId)
          } else if (body?.error) {
            appliedToolCallsRef.current.add(tp.toolCallId)
          }
        }

        if (matchTool(name, "render_project") && tp.toolCallId) {
          const isPending =
            tp.state === "input-available" ||
            tp.state === "streaming" ||
            tp.preliminary === true ||
            (tp.output === undefined && tp.result === undefined)

          if (isPending) {
            newRenderPhase = { id: tp.toolCallId, phase: "pending", state: null }
            continue
          }
          const body = parseToolJson(tp.output ?? tp.result)
          if (body?.url && typeof body.url === "string") {
            newRenderPhase = {
              id: tp.toolCallId,
              phase: "done",
              state: {
                url: body.url,
                status: "done",
                errorMessage: null,
                upload: {
                  backend: String(body.backend ?? "?"),
                  bytes: typeof body.bytes === "number" ? body.bytes : 0,
                  elapsedMs: typeof body.elapsedMs === "number" ? body.elapsedMs : 0,
                },
              },
            }
          } else if (body?.error) {
            newRenderPhase = {
              id: tp.toolCallId,
              phase: "error",
              state: {
                url: null,
                status: "error",
                errorMessage: String(body.error),
                upload: null,
              },
            }
          }
        }
      }
    }

    if (updateOps.length > 0) onApplyOps(updateOps)

    if (newRenderPhase) {
      const prev = lastRenderPhaseRef.current
      const same = prev && prev.id === newRenderPhase.id && prev.phase === newRenderPhase.phase
      if (!same) {
        lastRenderPhaseRef.current = { id: newRenderPhase.id, phase: newRenderPhase.phase }
        if (newRenderPhase.phase === "pending") onRenderPending()
        else if (newRenderPhase.state) onRenderResult(newRenderPhase.state)
      }
    }
  }, [messages, onApplyOps, onProbeResult, onRenderPending, onRenderResult])

  // Project reference is stable between renders when nothing changes, but
  // `project` in deps would still rebuild every edit. We snapshot it on the
  // fly when the prompt fires so agent always sees the freshest state.
  const projectSnapshotRef = useRef(project)
  projectSnapshotRef.current = project

  useEffect(() => {
    if (!pendingPrompt) return
    const prefix = `${SYSTEM_NOTE_PREFIX} PROJECT: ${JSON.stringify(projectSnapshotRef.current)} ${SYSTEM_NOTE_SUFFIX}`
    sendMessage({ text: `${prefix}\n\n${pendingPrompt}` })
    onPromptConsumed()
  }, [pendingPrompt, sendMessage, onPromptConsumed])

  useEffect(() => {
    if (!error) return
    const msg =
      typeof error === "string" ? error : (error as Error)?.message ?? String(error)
    if (msg.includes("thread_not_found") || msg.includes("sandbox_not_found")) {
      try {
        for (const key of Object.keys(localStorage)) {
          if (
            key === "agent_thread_id" ||
            key === "agent_sandbox_id" ||
            key.startsWith("video-editor:")
          )
            localStorage.removeItem(key)
        }
      } catch {}
      window.location.reload()
    }
  }, [error])

  const displayMessages = useMemo<UIMessage[]>(
    () =>
      messages
        // Hide user messages that are UI-initiated commands (render, probe)
        // — they're plumbing, not conversation.
        .filter((m) => {
          if (m.role !== "user") return true
          const textPart = m.parts.find(
            (p): p is { type: "text"; text: string } =>
              p.type === "text" && typeof (p as { text?: unknown }).text === "string",
          )
          if (!textPart) return true
          return !isSilentMessage(textPart.text)
        })
        .map((m) => ({
          ...m,
          parts: m.parts.map((p) =>
            m.role !== "user" || p.type !== "text"
              ? p
              : { ...p, text: stripSystemNotePrefix(p.text) },
          ),
        })),
    [messages],
  )

  return (
    <div className={`flex h-full flex-col ${colorMode === "dark" ? "dark" : ""}`}>
      <AgentChat
        messages={displayMessages}
        onSend={(msg) => {
          const prefix = `${SYSTEM_NOTE_PREFIX} PROJECT: ${JSON.stringify(projectSnapshotRef.current)} ${SYSTEM_NOTE_SUFFIX}`
          sendMessage({ text: `${prefix}\n\n${msg.content}` })
        }}
        status={status}
        onStop={stop}
        error={error ?? undefined}
        colorMode={colorMode}
      />
    </div>
  )
}

// ───────────────── main ─────────────────

function HomeContent() {
  const searchParams = useSearchParams()
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)
  const themeParam = searchParams.get("theme")
  const [colorMode, setColorMode] = useState<"light" | "dark">("dark")

  const history = useProjectHistory(newProject())
  const { project, apply: applyOpsWithHistory, set: setProject, undo, redo, canUndo, canRedo } =
    history
  const [selectedClipId, setSelectedClipId] = useState<UUID | null>(null)
  const [render, setRender] = useState<RenderState>(INITIAL_RENDER)
  const [playhead, setPlayhead] = useState(0)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [zoomIdx, setZoomIdx] = useState(3) // 120 px/s
  // Chat is an integral part of the editor — open by default so users see it.
  const [chatOpen, setChatOpen] = useState(true)
  const hydratedProjectRef = useRef(false)
  const hydratedChatOpenRef = useRef(false)
  const previewRef = useRef<LivePreviewHandle | null>(null)

  // Keep a stable reference to the latest project so callbacks don't need
  // `project` in their deps (which would force them to rebuild every edit
  // and re-trigger downstream effects → infinite loops).
  const projectRef = useRef(project)
  projectRef.current = project

  const duration = useMemo(() => projectDuration(project), [project])

  useEffect(() => {
    if (themeParam === "light") { setColorMode("light"); return }
    if (themeParam === "dark") { setColorMode("dark"); return }
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setColorMode(mq.matches ? "dark" : "light")
    const handler = (e: MediaQueryListEvent) => setColorMode(e.matches ? "dark" : "light")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [themeParam])

  // session init (same as before)
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    async function init() {
      try {
        async function createFreshSandbox() {
          const r = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!r.ok) throw new Error(`Failed to create sandbox: ${r.status}`)
          const d = await r.json()
          const id = d.sandboxId as string
          localStorage.setItem("agent_sandbox_id", id)
          return id
        }
        let sbId = localStorage.getItem("agent_sandbox_id")
        if (!sbId) sbId = await createFreshSandbox()
        let threadsRes = await fetch(`/api/agent/threads?sandboxId=${sbId}`)
        if (!threadsRes.ok) {
          localStorage.removeItem("agent_thread_id")
          sbId = await createFreshSandbox()
          threadsRes = await fetch(`/api/agent/threads?sandboxId=${sbId}`)
          if (!threadsRes.ok) throw new Error(`Failed to fetch threads: ${threadsRes.status}`)
        }
        setSandboxId(sbId)
        const existingThreads: ThreadItem[] = await threadsRes.json()
        const savedThreadId = localStorage.getItem("agent_thread_id")
        let thId: string
        if (existingThreads.length > 0) {
          thId =
            existingThreads.find((t) => t.id === savedThreadId)?.id
            ?? existingThreads[0]!.id
        } else {
          const r = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Editor session" }),
          })
          if (!r.ok) throw new Error(`Failed to create thread: ${r.status}`)
          const t: ThreadItem = await r.json()
          thId = t.id
        }
        localStorage.setItem("agent_thread_id", thId)
        setThreadId(thId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize")
      }
    }
    init()
  }, [])

  useEffect(() => {
    if (!sandboxId || hydratedProjectRef.current) return
    hydratedProjectRef.current = true
    try {
      const stored = localStorage.getItem(projectStoreKey(sandboxId))
      if (stored) {
        const parsed = JSON.parse(stored) as Project
        if (parsed && Array.isArray(parsed.tracks) && Array.isArray(parsed.clips)) {
          setProject(parsed, false)
        }
      }
    } catch {}
  }, [sandboxId, setProject])

  useEffect(() => {
    if (!sandboxId) return
    try {
      localStorage.setItem(projectStoreKey(sandboxId), JSON.stringify(project))
    } catch {}
  }, [project, sandboxId])

  useEffect(() => {
    if (hydratedChatOpenRef.current) return
    hydratedChatOpenRef.current = true
    try {
      const stored = localStorage.getItem(chatOpenStoreKey)
      if (stored === "1") setChatOpen(true)
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(chatOpenStoreKey, chatOpen ? "1" : "0")
    } catch {}
  }, [chatOpen])

  // ───────────────── handlers ─────────────────

  const agentOnline = !!threadId && !!sandboxId

  const handleAddAsset = useCallback(
    (asset: Omit<Asset, "id"> & { id?: string }) => {
      const id = asset.id ?? newId("asset")
      applyOpsWithHistory([{ op: "add_asset", asset: { ...asset, id } }])
    },
    [applyOpsWithHistory],
  )

  const handleRemoveAsset = useCallback(
    (id: string) => {
      applyOpsWithHistory([{ op: "remove_asset", assetId: id }])
    },
    [applyOpsWithHistory],
  )

  const handleLoadSample = useCallback(() => {
    const ops: Op[] = SAMPLE_ASSETS.map((a) => ({
      op: "add_asset" as const,
      asset: { ...a, id: newId("asset") },
    }))
    applyOpsWithHistory(ops)
  }, [applyOpsWithHistory])

  const appendAssetToTrack = useCallback(
    (assetId: string) => {
      const p = projectRef.current
      const asset = getAsset(p, assetId)
      if (!asset) return
      const track =
        asset.kind === "audio"
          ? p.tracks.find((t) => t.kind === "audio") ?? p.tracks[0]!
          : p.tracks.find((t) => t.kind === "video") ?? p.tracks[0]!
      applyOpsWithHistory([{ op: "add_clip", trackId: track.id, assetId }])
    },
    [applyOpsWithHistory],
  )

  const handleDropAsset = useCallback(
    (assetId: string, trackId: UUID, startSeconds: number) => {
      applyOpsWithHistory([
        { op: "add_clip", trackId, assetId, start: startSeconds },
      ])
    },
    [applyOpsWithHistory],
  )

  const handleUpdateClipFromTimeline = useCallback(
    (
      clipId: UUID,
      patch: { start?: number; length?: number; trimIn?: number; trackId?: string },
    ) => {
      const ops: Op[] = []
      if (patch.trimIn !== undefined || patch.length !== undefined) {
        ops.push({ op: "trim_clip", clipId, trimIn: patch.trimIn, length: patch.length })
      }
      if (patch.start !== undefined || patch.trackId !== undefined) {
        ops.push({ op: "move_clip", clipId, start: patch.start, trackId: patch.trackId })
      }
      if (ops.length > 0) applyOpsWithHistory(ops)
    },
    [applyOpsWithHistory],
  )

  const handleUpdateClipFromInspector = useCallback(
    (
      clipId: UUID,
      patch: {
        trimIn?: number
        length?: number
        start?: number
        volume?: number
        textOverlay?: Clip["textOverlay"] | null
      },
    ) => {
      const ops: Op[] = []
      if (patch.trimIn !== undefined || patch.length !== undefined) {
        ops.push({ op: "trim_clip", clipId, trimIn: patch.trimIn, length: patch.length })
      }
      if (patch.start !== undefined) {
        ops.push({ op: "move_clip", clipId, start: patch.start })
      }
      if (patch.volume !== undefined) {
        ops.push({ op: "set_volume", clipId, volume: patch.volume })
      }
      if (patch.textOverlay !== undefined) {
        if (patch.textOverlay === null) {
          ops.push({ op: "set_text_overlay", clipId, text: null })
        } else {
          ops.push({
            op: "set_text_overlay",
            clipId,
            text: patch.textOverlay.text,
            position: patch.textOverlay.position,
            color: patch.textOverlay.color,
            fontSize: patch.textOverlay.fontSize,
          })
        }
      }
      if (ops.length > 0) applyOpsWithHistory(ops)
    },
    [applyOpsWithHistory],
  )

  const handleRemoveClip = useCallback(
    (clipId: UUID) => {
      applyOpsWithHistory([{ op: "remove_clip", clipId }])
      setSelectedClipId((sel) => (sel === clipId ? null : sel))
    },
    [applyOpsWithHistory],
  )

  const handleUpdateOutput = useCallback(
    (patch: Partial<ProjectOutput>) => {
      applyOpsWithHistory([{ op: "set_output", patch }])
    },
    [applyOpsWithHistory],
  )

  const handleAddTrack = useCallback(
    (kind: "video" | "audio") => {
      applyOpsWithHistory([{ op: "add_track", kind }])
    },
    [applyOpsWithHistory],
  )

  const handleRemoveTrack = useCallback(
    (trackId: UUID) => {
      applyOpsWithHistory([{ op: "remove_track", trackId }])
    },
    [applyOpsWithHistory],
  )

  const handleProbeResult = useCallback(
    (url: string, info: Partial<Asset>) => {
      const asset = projectRef.current.assets.find((a) => a.url === url)
      if (!asset) return
      applyOpsWithHistory([{ op: "update_asset", assetId: asset.id, patch: info }])
    },
    [applyOpsWithHistory],
  )

  const handleRender = useCallback(
    (preview: boolean) => {
      if (projectRef.current.clips.length === 0) {
        setRender({
          url: null,
          status: "error",
          errorMessage: "Timeline is empty.",
          upload: null,
        })
        return
      }
      // Send a silent UI-action message — hidden from chat, visible to the
      // agent. The agent will invoke render_project and its tool output flows
      // back through ChatPanel's effect.
      setPendingPrompt(
        `${SILENT_PREFIX} render ${
          preview ? "draft preview" : "final"
        } ${SILENT_SUFFIX} Render the current project using render_project({ preview: ${preview} }).`,
      )
    },
    [],
  )

  const handleResetSession = useCallback(() => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (
          key === "agent_sandbox_id" ||
          key === "agent_thread_id" ||
          key.startsWith("video-editor:")
        ) {
          localStorage.removeItem(key)
        }
      }
    } catch {}
    window.location.reload()
  }, [])

  const handleRenderPending = useCallback(() => {
    setRender({ url: null, status: "rendering", errorMessage: null, upload: null })
  }, [])

  const handlePromptConsumed = useCallback(() => setPendingPrompt(null), [])

  const handleToggleChat = useCallback(() => setChatOpen((o) => !o), [])

  // ───────────────── keyboard shortcuts ─────────────────

  const handleSplitAtPlayhead = useCallback(() => {
    if (!selectedClipId) {
      // No selection — find a clip under playhead.
      const candidate = project.clips.find(
        (c) => c.start <= playhead && c.start + c.length >= playhead,
      )
      if (!candidate) return
      applyOpsWithHistory([{ op: "split_clip", clipId: candidate.id, at: playhead }])
      return
    }
    const clip = getClip(project, selectedClipId)
    if (!clip) return
    if (playhead <= clip.start || playhead >= clip.start + clip.length) return
    applyOpsWithHistory([{ op: "split_clip", clipId: selectedClipId, at: playhead }])
  }, [project, playhead, selectedClipId, applyOpsWithHistory])

  const nudgePlayhead = useCallback(
    (delta: number) => {
      const next = Math.max(0, playhead + delta)
      setPlayhead(next)
      previewRef.current?.seek(next)
    },
    [playhead],
  )

  useShortcuts({
    Space: () => previewRef.current?.togglePlay(),
    ArrowLeft: () => nudgePlayhead(-0.1),
    ArrowRight: () => nudgePlayhead(0.1),
    "Shift+ArrowLeft": () => nudgePlayhead(-1),
    "Shift+ArrowRight": () => nudgePlayhead(1),
    Backspace: () => {
      if (selectedClipId) handleRemoveClip(selectedClipId)
    },
    Delete: () => {
      if (selectedClipId) handleRemoveClip(selectedClipId)
    },
    S: () => handleSplitAtPlayhead(),
    Escape: () => setSelectedClipId(null),
    "Cmd+K": () => setChatOpen((o) => !o),
    "Cmd+Z": () => undo(),
    "Cmd+Shift+Z": () => redo(),
    "Cmd+Enter": () => handleRender(false),
    "Cmd+P": () => handleRender(true),
    "+": () => setZoomIdx((i) => Math.min(MAX_ZOOM_IDX, i + 1)),
    "=": () => setZoomIdx((i) => Math.min(MAX_ZOOM_IDX, i + 1)),
    "-": () => setZoomIdx((i) => Math.max(MIN_ZOOM_IDX, i - 1)),
    "Cmd+=": () => setZoomIdx((i) => Math.min(MAX_ZOOM_IDX, i + 1)),
    "Cmd+-": () => setZoomIdx((i) => Math.max(MIN_ZOOM_IDX, i - 1)),
  })

  // ───────────────── render ─────────────────

  if (error) {
    return (
      <main className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="space-y-2 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => {
              setError(null)
              initRef.current = false
              window.location.reload()
            }}
            className="text-sm text-neutral-400 underline hover:text-white"
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  const themeClass = colorMode === "dark" ? "dark" : ""

  return (
    <div className={`flex h-screen flex-col bg-neutral-950 text-neutral-100 ${themeClass}`}>
      <TopBar
        output={project.output}
        duration={duration}
        onUpdateOutput={handleUpdateOutput}
        onToggleChat={handleToggleChat}
        chatOpen={chatOpen}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <AssetPanel
          assets={project.assets}
          onAdd={handleAddAsset}
          onRemove={handleRemoveAsset}
          onLoadSample={handleLoadSample}
          onQuickAdd={appendAssetToTrack}
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ResizableSplit
            initialTopPct={55}
            minTopPct={20}
            maxTopPct={80}
            storageKey="video-editor:split-top-pct"
            top={
              <LivePreview
                ref={previewRef}
                project={project}
                playhead={playhead}
                onPlayhead={setPlayhead}
                renderedUrl={render.url}
                renderStatus={render.status}
                renderError={render.errorMessage}
                lastUpload={render.upload}
                onRender={handleRender}
                renderBusy={render.status === "rendering"}
              />
            }
            bottom={
              <Timeline
                project={project}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
                onUpdateClip={handleUpdateClipFromTimeline}
                onDropAsset={handleDropAsset}
                playhead={playhead}
                onSeek={(s) => {
                  setPlayhead(s)
                  previewRef.current?.seek(s)
                }}
                zoomIdx={zoomIdx}
                onChangeZoomIdx={setZoomIdx}
                onAddTrack={handleAddTrack}
                onRemoveTrack={handleRemoveTrack}
              />
            }
          />

          <InspectorDrawer
            project={project}
            selectedClipId={selectedClipId}
            onUpdateClip={handleUpdateClipFromInspector}
            onRemoveClip={handleRemoveClip}
            onClose={() => setSelectedClipId(null)}
          />
        </section>

        {chatOpen && (
          <aside className="flex h-full w-[380px] shrink-0 min-w-0 flex-col border-l border-neutral-800 bg-neutral-950">
            <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-1.5 text-[11px] text-neutral-400">
              <span className="font-medium text-neutral-200">Agent</span>
              <span className="flex-1" />
              {project.assets.length > 0 && (
                <div className="flex gap-1">
                  {SAMPLE_PROMPTS.slice(0, 3).map((p) => (
                    <button
                      key={p.title}
                      type="button"
                      onClick={() => setPendingPrompt(p.prompt)}
                      className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white"
                      title={p.prompt}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={handleResetSession}
                className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-200"
                title="Clear sandbox + project"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded px-1.5 py-0.5 text-neutral-500 hover:text-neutral-100"
                title="Close (⌘K)"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {sandboxId && threadId ? (
                <ChatPanel
                  sandboxId={sandboxId}
                  threadId={threadId}
                  colorMode={colorMode}
                  project={project}
                  onApplyOps={applyOpsWithHistory}
                  onProbeResult={handleProbeResult}
                  onRenderResult={setRender}
                  onRenderPending={handleRenderPending}
                  pendingPrompt={pendingPrompt}
                  onPromptConsumed={handlePromptConsumed}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                  {agentOnline ? "" : "Loading…"}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
          Loading…
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  )
}
