"use client"

import { useChat } from "@ai-sdk/react"
import { AgentChat, createAgentChat } from "@21st-sdk/nextjs"
import "@21st-sdk/react/styles.css"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AgentSidebar, SidebarPromptButton, SidebarSection } from "./_components/agent-sidebar"
import { SetupChecklist } from "./_components/setup-checklist"
import { LottieCanvas } from "./components/lottie-canvas"
import { RenderLottieRenderer } from "./components/lottie-tool-renderer"
import { ThinkingBanner, useHideDefaultPlanningRow } from "./components/thinking-banner"
import type { RenderLottiePayload } from "./types"

const AGENT_SLUG = "lottie-generator"
const TOOL_NAME = "render_lottie"

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `lottie-generator:messages:${sandboxId}:${threadId}`
}

function isRenderLottieType(type: string): boolean {
  return (
    type === `tool-${TOOL_NAME}` ||
    type.includes(TOOL_NAME) ||
    type.endsWith(`-${TOOL_NAME}`) ||
    type.endsWith(`__${TOOL_NAME}`)
  )
}

function isRenderLottieName(toolName: string): boolean {
  return (
    toolName === TOOL_NAME ||
    toolName.includes(TOOL_NAME) ||
    toolName.endsWith(`-${TOOL_NAME}`) ||
    toolName.endsWith(`__${TOOL_NAME}`)
  )
}

function isRenderLottiePart(part: unknown): boolean {
  if (!part || typeof part !== "object") return false
  const maybe = part as { type?: unknown; toolName?: unknown }
  if (typeof maybe.type === "string" && isRenderLottieType(maybe.type)) return true
  if (typeof maybe.toolName === "string" && isRenderLottieName(maybe.toolName)) return true
  return false
}

function extractJsonText(output: unknown): string | null {
  if (typeof output === "string") return output
  if (Array.isArray(output)) {
    const parts: string[] = []
    for (const item of output) {
      if (typeof item === "string") {
        parts.push(item)
        continue
      }
      if (!item || typeof item !== "object") continue
      const maybePart = item as { type?: unknown; text?: unknown }
      if (maybePart.type === "text" && typeof maybePart.text === "string") {
        parts.push(maybePart.text)
      }
    }
    return parts.length > 0 ? parts.join("") : null
  }
  if (!output || typeof output !== "object") return null

  const numericEntries = Object.entries(output)
    .filter(([key, value]) => /^\d+$/.test(key) && typeof value === "string")
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  if (numericEntries.length > 0) {
    return numericEntries.map(([, value]) => value).join("")
  }

  const maybe = output as { text?: unknown; content?: unknown }
  if (typeof maybe.text === "string") return maybe.text
  if (!Array.isArray(maybe.content)) return null
  for (const item of maybe.content) {
    if (!item || typeof item !== "object") continue
    const maybePart = item as { type?: unknown; text?: unknown }
    if (maybePart.type === "text" && typeof maybePart.text === "string") {
      return maybePart.text
    }
  }
  return null
}

function parseRenderLottiePayload(output: unknown): RenderLottiePayload | null {
  const jsonText = extractJsonText(output)
  if (!jsonText) return null
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>
    if (typeof parsed.error === "string") return null
    const anim = parsed.animation
    if (
      !anim ||
      typeof anim !== "object" ||
      Array.isArray(anim) ||
      typeof (anim as Record<string, unknown>).v !== "string" ||
      !Array.isArray((anim as Record<string, unknown>).layers)
    ) {
      return null
    }
    return {
      name: typeof parsed.name === "string" ? parsed.name : "Animation",
      description: typeof parsed.description === "string" ? parsed.description : null,
      width: typeof parsed.width === "number" ? parsed.width : 400,
      height: typeof parsed.height === "number" ? parsed.height : 400,
      frameRate: typeof parsed.frameRate === "number" ? parsed.frameRate : 30,
      durationSeconds: typeof parsed.durationSeconds === "number" ? parsed.durationSeconds : 2,
      layerCount: typeof parsed.layerCount === "number" ? parsed.layerCount : 1,
      animation: anim as RenderLottiePayload["animation"],
    }
  } catch {
    return null
  }
}

function asRenderLottiePart(part: unknown): {
  type: string
  state?: string
  preliminary?: boolean
  toolCallId?: string
  output?: unknown
  result?: unknown
} | null {
  if (!part || typeof part !== "object") return null
  const maybe = part as {
    type?: unknown
    state?: unknown
    preliminary?: unknown
    toolCallId?: unknown
    output?: unknown
    result?: unknown
  }
  if (typeof maybe.type !== "string" || !isRenderLottiePart(maybe)) return null
  return {
    type: maybe.type,
    state: typeof maybe.state === "string" ? maybe.state : undefined,
    preliminary: typeof maybe.preliminary === "boolean" ? maybe.preliminary : undefined,
    toolCallId: typeof maybe.toolCallId === "string" ? maybe.toolCallId : undefined,
    output: maybe.output,
    result: maybe.result,
  }
}

function LottieAgent({
  sandboxId,
  threadId,
  colorMode,
  onThreadChange,
}: {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
  onThreadChange: (nextThreadId: string) => void
}) {
  const [current, setCurrent] = useState<RenderLottiePayload | null>(null)
  const lastAppliedToolCallId = useRef<string | null>(null)

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
  const storageKey = getMessagesStorageKey(sandboxId, threadId)

  useEffect(() => {
    if (didHydrateRef.current) return
    didHydrateRef.current = true
    if (messages.length > 0) return

    try {
      const stored = localStorage.getItem(storageKey)
      if (!stored) return
      const parsed = JSON.parse(stored) as UIMessage[]
      if (parsed.length > 0) {
        setMessages(parsed)
      }
    } catch {}
  }, [messages.length, setMessages, storageKey])

  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {}
  }, [messages, storageKey])

  useEffect(() => {
    const latest = [...messages]
      .reverse()
      .flatMap((message) => [...message.parts].reverse())
      .map(asRenderLottiePart)
      .find((part) => {
        if (!part || part.preliminary === true) return false
        const hasPayload = part.output !== undefined || part.result !== undefined
        if (!hasPayload) return false
        return part.state === "output-available" || part.state === undefined
      })

    if (!latest?.toolCallId) return
    if (lastAppliedToolCallId.current === latest.toolCallId) return

    const payload = parseRenderLottiePayload(latest.output ?? latest.result)
    if (!payload) return

    lastAppliedToolCallId.current = latest.toolCallId
    setCurrent(payload)
  }, [messages])

  const agentOnline = !error && messages.length > 0

  const [resetting, setResetting] = useState(false)

  const handleNewProject = useCallback(async () => {
    if (!sandboxId || resetting) return
    setResetting(true)
    try {
      // Clear current animation + chat messages immediately for snappy UX.
      setCurrent(null)
      lastAppliedToolCallId.current = null
      setMessages([])
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith("lottie-generator:messages:")) {
            localStorage.removeItem(key)
          }
        }
      } catch {}

      // Create a fresh thread on the same sandbox so the agent has empty context.
      const thRes = await fetch("/api/agent/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, name: "Chat" }),
      })
      if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
      const data = await thRes.json()
      const freshId = data.id as string
      try { localStorage.setItem("agent_thread_id", freshId) } catch {}
      onThreadChange(freshId)
    } catch (err) {
      console.error("[client] New project failed:", err)
      // Fall back to reload only if soft reset failed.
      window.location.reload()
    } finally {
      setResetting(false)
    }
  }, [sandboxId, resetting, setMessages, onThreadChange])

  // Track when the user's latest prompt went out, for the thinking-banner timer.
  // We key off the last user message id + the assistant's content-emptiness so the
  // banner hides the moment the agent emits anything renderable.
  const lastUserMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i]
    }
    return null
  }, [messages])

  const lastAssistantHasContent = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
    if (!lastAssistant) return false
    return (lastAssistant.parts ?? []).some((p) => {
      const t = typeof (p as { type?: unknown }).type === "string" ? (p as { type: string }).type : ""
      if (t === "text") {
        const text = (p as { text?: unknown }).text
        return typeof text === "string" && text.trim().length > 0
      }
      return t.startsWith("tool-") || t === "dynamic-tool" || t === "tool-invocation"
    })
  }, [messages])

  const bannerPrompt = useMemo(() => {
    const parts = lastUserMsg?.parts ?? []
    for (const p of parts) {
      const t = typeof (p as { type?: unknown }).type === "string" ? (p as { type: string }).type : ""
      if (t === "text") {
        const text = (p as { text?: unknown }).text
        if (typeof text === "string" && text.trim()) return text.trim()
      }
    }
    return ""
  }, [lastUserMsg])

  const bannerActive =
    (status === "submitted" || status === "streaming") && !lastAssistantHasContent && bannerPrompt.length > 0

  // Reset the banner's elapsed clock whenever the user id changes (i.e. a fresh send).
  const [bannerStartedAt, setBannerStartedAt] = useState<number | null>(null)
  const bannerUserIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (!bannerActive) {
      bannerUserIdRef.current = null
      setBannerStartedAt(null)
      return
    }
    const currentId = lastUserMsg?.id ?? null
    if (currentId && bannerUserIdRef.current !== currentId) {
      bannerUserIdRef.current = currentId
      setBannerStartedAt(Date.now())
    }
  }, [bannerActive, lastUserMsg])

  useHideDefaultPlanningRow(bannerActive)

  // Chat shows tool calls + the agent's intro line (text BEFORE the first tool call).
  // Follow-up text AFTER the tool is dropped — the chip + canvas already convey the result.
  const toolOnlyMessages = useMemo(() => {
    return messages
      .map((m) => {
        if (m.role !== "assistant") return m
        const parts = m.parts ?? []
        const firstToolIdx = parts.findIndex((p) => {
          const t = typeof (p as { type?: unknown }).type === "string" ? (p as { type: string }).type : ""
          return t.startsWith("tool-")
        })
        // Pre-tool text + all tool parts. If no tool yet, keep text so the user sees the intro streaming.
        const sliceEnd = firstToolIdx === -1 ? parts.length : parts.length
        const kept = parts.slice(0, sliceEnd).filter((p, idx) => {
          const t = typeof (p as { type?: unknown }).type === "string" ? (p as { type: string }).type : ""
          if (t.startsWith("tool-")) return true
          if (t === "text") return firstToolIdx === -1 || idx < firstToolIdx
          return false
        })
        return { ...m, parts: kept }
      })
      .filter((m) => {
        if (m.role !== "assistant") return true
        return (m.parts?.length ?? 0) > 0
      })
  }, [messages])

  const starterPrompts = [
    "Bouncing ball loader, blue, 2s loop",
    "8-dot rotating spinner, dots fade in sequence",
    "Pulsing heart, red, 1s loop",
    "Morphing square → circle, 60fps",
    "Success checkmark draw-in, green",
  ]

  return (
    <div className={`flex flex-col xs:flex-row h-screen bg-background text-foreground${colorMode === "dark" ? " dark" : ""}`}>
      <AgentSidebar
        partnerLogo={<span className="text-sm font-medium">Lottie</span>}
        partnerDocsUrl="https://lottiefiles.com/what-is-lottie"
        partnerDocsLabel="Lottie format docs"
      >
        <SetupChecklist agentOnline={agentOnline} />
        <SidebarSection label="Quick prompts">
          {starterPrompts.map((prompt) => (
            <SidebarPromptButton
              key={prompt}
              onClick={() => sendMessage({ text: prompt })}
            >
              {prompt}
            </SidebarPromptButton>
          ))}
        </SidebarSection>
      </AgentSidebar>
      <main className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_420px] overflow-hidden">
        <section className="min-h-0 border-b border-black/[0.06] md:border-b-0 md:border-r dark:border-white/[0.06]">
          <LottieCanvas payload={current} />
        </section>
        <section className="relative flex h-full min-h-0 flex-col">
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-black/[0.06] px-4 dark:border-white/[0.06]">
            <span className="text-[10px] font-medium uppercase tracking-widest text-black/35 dark:text-white/35">
              Chat
            </span>
            <span className="min-w-0 truncate text-sm font-medium">Lottie Generator</span>
            <button
              type="button"
              onClick={handleNewProject}
              className="ml-auto flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs text-black/50 transition-colors hover:bg-black/[0.05] hover:text-black/90 dark:text-white/50 dark:hover:bg-white/[0.05] dark:hover:text-white/90"
              title="Start a new project — clears the conversation and creates a fresh sandbox"
              aria-label="New project"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New
            </button>
            <span
              className={`inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[10px] font-medium ${
                agentOnline
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                  : "bg-black/[0.05] text-black/40 dark:bg-white/[0.05] dark:text-white/40"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${agentOnline ? "bg-emerald-500" : "bg-black/20 dark:bg-white/20"}`} />
              {agentOnline ? "Online" : "Idle"}
            </span>
          </div>
          {bannerActive && bannerStartedAt !== null && (
            <ThinkingBanner prompt={bannerPrompt} startedAt={bannerStartedAt} />
          )}
          <AgentChat
            messages={toolOnlyMessages}
            onSend={(msg) => sendMessage({ text: msg.content })}
            status={status}
            onStop={stop}
            error={error ?? undefined}
            colorMode={colorMode}
            toolRenderers={{
              render_lottie: RenderLottieRenderer,
            }}
            className="min-h-0 flex-1"
          />
        </section>
      </main>
    </div>
  )
}

function HomeContent() {
  const searchParams = useSearchParams()
  const themeParam = searchParams.get("theme")
  const [colorMode, setColorMode] = useState<"light" | "dark">("dark")

  useEffect(() => {
    if (themeParam === "light") { setColorMode("light"); return }
    if (themeParam === "dark") { setColorMode("dark"); return }
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setColorMode(mq.matches ? "dark" : "light")
    const handler = (e: MediaQueryListEvent) => setColorMode(e.matches ? "dark" : "light")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [themeParam])

  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function createFreshSandbox() {
      const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
      if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
      const data = await sbRes.json()
      const freshId = data.sandboxId as string
      localStorage.setItem("agent_sandbox_id", freshId)
      localStorage.removeItem("agent_thread_id")
      return freshId
    }

    async function ensureThread(sbId: string) {
      const cached = localStorage.getItem("agent_thread_id")
      if (cached) {
        const listRes = await fetch(`/api/agent/threads?sandboxId=${sbId}`)
        if (listRes.ok) {
          const threads = (await listRes.json()) as Array<{ id: string }>
          if (threads.some((t) => t.id === cached)) return cached
        }
      }

      const thRes = await fetch("/api/agent/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
      })
      if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
      const data = await thRes.json()
      const freshId = data.id as string
      localStorage.setItem("agent_thread_id", freshId)
      return freshId
    }

    async function init() {
      try {
        let sbId = localStorage.getItem("agent_sandbox_id")
        if (!sbId) sbId = await createFreshSandbox()

        let thId: string
        try {
          thId = await ensureThread(sbId)
        } catch {
          sbId = await createFreshSandbox()
          thId = await ensureThread(sbId)
        }

        setSandboxId(sbId)
        setThreadId(thId)
      } catch (err) {
        console.error("[client] Init failed:", err)
        setError(err instanceof Error ? err.message : "Failed to initialize")
      }
    }

    init()
  }, [])

  if (error) {
    return (
      <main className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="text-center space-y-2">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => {
              setError(null)
              initRef.current = false
              window.location.reload()
            }}
            className="text-sm text-neutral-400 hover:text-white underline"
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  if (!sandboxId || !threadId) {
    return (
      <main className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-500">
        Loading...
      </main>
    )
  }

  return <LottieAgent sandboxId={sandboxId} threadId={threadId} colorMode={colorMode} onThreadChange={setThreadId} />
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
