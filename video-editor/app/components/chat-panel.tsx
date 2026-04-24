"use client"

import { AgentChat, createAgentChat } from "@21st-sdk/nextjs"
import "@21st-sdk/react/styles.css"
import type { Chat } from "@ai-sdk/react"
import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { useEffect, useMemo, useRef } from "react"
import {
  formatSystemNote,
  isSilentMessage,
  stripSystemNotePrefix,
} from "../lib/chat-protocol"
import type { Asset, Project } from "../lib/project"
import type { Op } from "../lib/project-ops"
import type { RenderState } from "../lib/render"
import { resetAgentSession } from "../lib/use-agent-session"
import type { ColorMode } from "../lib/use-color-mode"
import { parseToolEvents } from "../lib/tool-events"

const AGENT_SLUG = "video-editor"

const messagesStoreKey = (sandboxId: string, threadId: string) =>
  `video-editor:messages:${sandboxId}:${threadId}`

export interface ChatPanelProps {
  sandboxId: string
  threadId: string
  colorMode: ColorMode
  project: Project
  onApplyOps: (ops: Op[]) => void
  onProbeResult: (url: string, info: Partial<Asset>) => void
  onRenderResult: (state: RenderState) => void
  onRenderPending: () => void
  pendingPrompt: string | null
  onPromptConsumed: () => void
}

export function ChatPanel({
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
  const storageKey = messagesStoreKey(sandboxId, threadId)

  useHydrateMessages({ sandboxId, threadId, storageKey, setMessages })
  usePersistMessages(storageKey, messages)
  useApplyToolEvents({
    messages,
    onApplyOps,
    onProbeResult,
    onRenderPending,
    onRenderResult,
  })
  useResetOnStaleSession(error)

  // Keep the latest project snapshot in a ref so `onSend` doesn't need to
  // depend on `project` (which would re-wire the AgentChat every edit).
  const projectRef = useRef(project)
  projectRef.current = project

  useEffect(() => {
    if (!pendingPrompt) return
    const prefix = formatSystemNote(`PROJECT: ${JSON.stringify(projectRef.current)}`)
    sendMessage({ text: `${prefix}\n\n${pendingPrompt}` })
    onPromptConsumed()
  }, [pendingPrompt, sendMessage, onPromptConsumed])

  const displayMessages = useMemo<UIMessage[]>(
    () =>
      messages
        .filter((m) => {
          // Hide UI-initiated commands (silent plumbing for render/probe).
          if (m.role !== "user") return true
          const textPart = m.parts.find(
            (p): p is { type: "text"; text: string } =>
              p.type === "text" && typeof (p as { text?: unknown }).text === "string",
          )
          return !textPart || !isSilentMessage(textPart.text)
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
          const prefix = formatSystemNote(`PROJECT: ${JSON.stringify(projectRef.current)}`)
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

// ───────────────── effects ─────────────────

/** Hydrate chat messages from the server (truth), falling back to
 * localStorage if the server has none, so a crash doesn't lose drafts. */
function useHydrateMessages({
  sandboxId,
  threadId,
  storageKey,
  setMessages,
}: {
  sandboxId: string
  threadId: string
  storageKey: string
  setMessages: (messages: UIMessage[]) => void
}) {
  const didHydrateRef = useRef(false)

  useEffect(() => {
    if (didHydrateRef.current) return
    didHydrateRef.current = true
    let cancelled = false

    async function hydrate() {
      try {
        const res = await fetch(
          `/api/agent/threads/${encodeURIComponent(threadId)}?sandboxId=${encodeURIComponent(sandboxId)}`,
        )
        if (cancelled) return
        if (res.ok) {
          const thread = (await res.json()) as { messages?: UIMessage[] | unknown }
          if (Array.isArray(thread.messages) && thread.messages.length > 0) {
            setMessages(thread.messages as UIMessage[])
            return
          }
        }
      } catch {
        /* fall through to local */
      }
      if (cancelled) return
      try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) return
        const parsed = JSON.parse(raw) as UIMessage[]
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed)
      } catch {
        /* ignore malformed cache */
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [sandboxId, threadId, storageKey, setMessages])
}

function usePersistMessages(storageKey: string, messages: UIMessage[]): void {
  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {
      /* quota exceeded; drop */
    }
  }, [messages, storageKey])
}

/**
 * Walk newly-arrived messages, parse tool events, and dispatch them to the
 * editor. A `Set` of already-applied `callId`s guarantees idempotency, since
 * the agent SDK replays completed parts across re-renders.
 */
function useApplyToolEvents({
  messages,
  onApplyOps,
  onProbeResult,
  onRenderPending,
  onRenderResult,
}: {
  messages: UIMessage[]
  onApplyOps: (ops: Op[]) => void
  onProbeResult: (url: string, info: Partial<Asset>) => void
  onRenderPending: () => void
  onRenderResult: (state: RenderState) => void
}) {
  const appliedRef = useRef<Set<string>>(new Set())
  // Per-`callId` highest phase we have already fired. We deliberately keep
  // phases monotonic: once a render reports `done` or `error`, a later
  // `pending` for the same call is ignored. That kills the flicker caused by
  // the agent SDK replaying in-flight parts after a render completes, and
  // prevents a stale hydrated message from putting a fresh session back into
  // "rendering" state on load.
  const renderPhaseRef = useRef<Map<string, "pending" | "done" | "error">>(new Map())
  // First parse after mount sees the full hydrated message history; any
  // "pending" render we see here is necessarily stale (the actual ffmpeg
  // job long since finished or died with the previous session). Skip it,
  // otherwise the Export button gets stuck disabled on every reload.
  const hydratedFirstPassRef = useRef(false)

  useEffect(() => {
    const isFirstPass = !hydratedFirstPassRef.current
    hydratedFirstPassRef.current = true
    const events = parseToolEvents(messages)
    const pendingOps: Op[] = []
    const latestRender = new Map<
      string,
      { phase: "pending" | "done" | "error"; state: RenderState | null }
    >()

    for (const event of events) {
      switch (event.kind) {
        case "render_pending": {
          // Don't let a late-arriving `pending` part override a `done` we've
          // already observed earlier in the same message list.
          const current = latestRender.get(event.callId)
          if (!current) {
            latestRender.set(event.callId, { phase: "pending", state: null })
          }
          break
        }
        case "render_done": {
          latestRender.set(event.callId, {
            phase: "done",
            state: {
              url: event.url,
              status: "done",
              errorMessage: null,
              upload: {
                backend: event.backend,
                bytes: event.bytes,
                elapsedMs: event.elapsedMs,
              },
            },
          })
          break
        }
        case "render_error": {
          latestRender.set(event.callId, {
            phase: "error",
            state: { url: null, status: "error", errorMessage: event.error, upload: null },
          })
          break
        }
        case "update_timeline": {
          if (!appliedRef.current.has(event.callId)) {
            pendingOps.push(...event.ops)
            appliedRef.current.add(event.callId)
          }
          break
        }
        case "probe_asset": {
          if (!appliedRef.current.has(event.callId)) {
            onProbeResult(event.url, event.info)
            appliedRef.current.add(event.callId)
          }
          break
        }
        case "probe_error": {
          appliedRef.current.add(event.callId)
          break
        }
      }
    }

    if (pendingOps.length > 0) onApplyOps(pendingOps)

    // Reconcile render phases: fire once per (callId, forward transition).
    for (const [callId, latest] of latestRender) {
      const seen = renderPhaseRef.current.get(callId)
      // `done` / `error` are terminal — never regress back to `pending`.
      if (seen === "done" || seen === "error") continue
      if (seen === latest.phase) continue
      // Suppress `pending` replayed from hydrated history — that job isn't
      // actually in flight anymore.
      if (isFirstPass && latest.phase === "pending") continue
      renderPhaseRef.current.set(callId, latest.phase)
      if (latest.phase === "pending") onRenderPending()
      else if (latest.state) onRenderResult(latest.state)
    }
  }, [messages, onApplyOps, onProbeResult, onRenderPending, onRenderResult])
}

/** If the chat surfaces a `thread_not_found` / `sandbox_not_found` error,
 * the backend forgot our session; wipe local ids and reload. */
function useResetOnStaleSession(error: unknown): void {
  useEffect(() => {
    if (!error) return
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes("thread_not_found") || msg.includes("sandbox_not_found")) {
      resetAgentSession()
    }
  }, [error])
}
