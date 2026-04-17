"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { AgentChat, createAgentChat } from "@21st-sdk/nextjs"
import "@21st-sdk/react/styles.css"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { useSearchParams } from "next/navigation"
import {
  AgentSidebar,
  SidebarSection,
  SidebarPromptButton,
} from "@/app/_components/agent-sidebar"
import { SetupChecklist } from "@/app/_components/setup-checklist"
import { PreviewCard, type CopyBlock, type Voice } from "@/app/_components/preview-card"

type Brief = {
  productName: string
  audience: string
  pitch: string
  differentiators: string
}

const DEFAULT_BRIEF: Brief = {
  productName: "Relay",
  audience: "indie developers building production apps",
  pitch: "Ship background jobs without managing queues.",
  differentiators: "Zero infra to run. Idempotency + retries built in. TypeScript-native SDK.",
}

const VOICES: Voice[] = ["plain", "bold", "playful"]

const SYSTEM_NOTE_PREFIX = "[[[SYSTEM NOTE:"
const SYSTEM_NOTE_SUFFIX = "]]]"

function isUpdateCopyToolPart(part: unknown): boolean {
  if (!part || typeof part !== "object") return false
  const p = part as { type?: unknown; toolName?: unknown }
  const s = `${typeof p.type === "string" ? p.type : ""} ${typeof p.toolName === "string" ? p.toolName : ""}`
  return s.includes("update_copy")
}

function stripSystemNotePrefix(text: string): string {
  if (!text.startsWith(SYSTEM_NOTE_PREFIX)) return text
  const i = text.indexOf(SYSTEM_NOTE_SUFFIX)
  if (i === -1) return text
  return text.slice(i + SYSTEM_NOTE_SUFFIX.length).trimStart()
}

function extractJsonText(output: unknown): string | null {
  if (typeof output === "string") return output
  if (Array.isArray(output)) {
    const parts: string[] = []
    for (const item of output) {
      if (typeof item === "string") parts.push(item)
      else if (item && typeof item === "object") {
        const p = item as { type?: unknown; text?: unknown }
        if (p.type === "text" && typeof p.text === "string") parts.push(p.text)
      }
    }
    return parts.length ? parts.join("") : null
  }
  if (!output || typeof output !== "object") return null
  const numericEntries = Object.entries(output)
    .filter(([key, value]) => /^\d+$/.test(key) && typeof value === "string")
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  if (numericEntries.length > 0) {
    return numericEntries.map(([, value]) => value).join("")
  }
  const o = output as { text?: unknown; content?: unknown }
  if (typeof o.text === "string") return o.text
  if (Array.isArray(o.content)) {
    for (const item of o.content) {
      const p = item as { type?: unknown; text?: unknown }
      if (p && typeof p === "object" && p.type === "text" && typeof p.text === "string") return p.text
    }
  }
  return null
}

function asUpdateCopyToolPart(part: unknown) {
  if (!part || typeof part !== "object") return null
  const m = part as Record<string, unknown>
  if (typeof m.type !== "string" || !isUpdateCopyToolPart(m)) return null
  return {
    toolCallId: typeof m.toolCallId === "string" ? m.toolCallId : undefined,
    preliminary: typeof m.preliminary === "boolean" ? m.preliminary : false,
    output: m.output,
    result: m.result,
  }
}

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `landing-copywriter:messages:${sandboxId}:${threadId}`
}

function CopywriterAgent({
  sandboxId,
  threadId,
  colorMode,
}: {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
}) {
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF)
  const [copy, setCopy] = useState<Record<Voice, CopyBlock | null>>({
    plain: null,
    bold: null,
    playful: null,
  })
  const appliedToolCallIds = useRef<Set<string>>(new Set())

  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "landing-copywriter-agent",
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
      if (parsed.length > 0) setMessages(parsed)
    } catch {}
  }, [messages.length, setMessages, storageKey])

  useEffect(() => {
    if (messages.length === 0) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages))
    } catch {}
  }, [messages, storageKey])

  const displayMessages = useMemo<UIMessage[]>(
    () =>
      messages.map((m) => ({
        ...m,
        parts: m.parts
          .filter((p) => !isUpdateCopyToolPart(p))
          .map((p) =>
            m.role === "user" && p.type === "text"
              ? { ...p, text: stripSystemNotePrefix(p.text) }
              : p,
          ),
      })),
    [messages],
  )

  useEffect(() => {
    for (const msg of messages) {
      for (const part of msg.parts) {
        const tp = asUpdateCopyToolPart(part)
        if (!tp || tp.preliminary) continue
        if (!tp.toolCallId || appliedToolCallIds.current.has(tp.toolCallId)) continue
        const payloadText = extractJsonText(tp.output ?? tp.result)
        if (!payloadText) continue
        try {
          const parsed = JSON.parse(payloadText) as { voice?: unknown; copy?: CopyBlock }
          if (
            typeof parsed.voice === "string" &&
            (VOICES as readonly string[]).includes(parsed.voice) &&
            parsed.copy
          ) {
            const v = parsed.voice as Voice
            const c = parsed.copy
            setCopy((prev) => ({ ...prev, [v]: c }))
            appliedToolCallIds.current.add(tp.toolCallId)
          }
        } catch {}
      }
    }
  }, [messages])

  function buildSystemNote(activeVoice: Voice | "all") {
    return `${SYSTEM_NOTE_PREFIX} BRIEF: ${JSON.stringify(brief)} | ACTIVE_VOICE: "${activeVoice}" | CURRENT_COPY: ${JSON.stringify(copy)} ${SYSTEM_NOTE_SUFFIX}`
  }

  function sendGenerateAll() {
    sendMessage({
      text: `${buildSystemNote("all")}\n\nGenerate all three voices from the brief.`,
    })
  }

  function regenerate(voice: Voice) {
    sendMessage({
      text: `${buildSystemNote(voice)}\n\nRegenerate the ${voice} voice based on the brief.`,
    })
  }

  function sendWithContext(text: string) {
    sendMessage({ text: `${buildSystemNote("all")}\n\n${text}` })
  }

  const agentOnline = !error && messages.length > 0
  const isStreaming = status === "streaming" || status === "submitted"

  return (
    <div className={`flex flex-col xs:flex-row h-screen bg-background text-foreground${colorMode === "dark" ? " dark" : ""}`}>
      <AgentSidebar partnerLogo={<span className="text-sm font-medium">Landing Copywriter</span>}>
        <SetupChecklist agentOnline={agentOnline} />
        <SidebarSection label="Try">
          <SidebarPromptButton onClick={sendGenerateAll}>
            Generate all three voices
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Make the bold voice punchier and shorter.")}>
            Punchier bold
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Rewrite only the playful features — less whimsy, more specificity.")}>
            Tweak playful
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Try a more enterprise-leaning plain voice.")}>
            Enterprise plain
          </SidebarPromptButton>
        </SidebarSection>
      </AgentSidebar>

      <main className="flex-1 min-w-0 grid grid-cols-1 xs:grid-cols-[minmax(0,360px)_minmax(0,1fr)] overflow-hidden">
        <section className="overflow-y-auto border-r border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 flex flex-col">
          <div className="p-4 space-y-3 border-b border-neutral-200 dark:border-neutral-800">
            <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">Brief</p>
            <label className="block">
              <span className="mb-1 block text-[11px] text-neutral-600 dark:text-neutral-400">Product name</span>
              <input
                value={brief.productName}
                onChange={(e) => setBrief({ ...brief, productName: e.target.value })}
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800 dark:bg-neutral-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-neutral-600 dark:text-neutral-400">Audience</span>
              <input
                value={brief.audience}
                onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800 dark:bg-neutral-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-neutral-600 dark:text-neutral-400">One-line pitch</span>
              <textarea
                rows={2}
                value={brief.pitch}
                onChange={(e) => setBrief({ ...brief, pitch: e.target.value })}
                className="w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800 dark:bg-neutral-900"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-neutral-600 dark:text-neutral-400">Differentiators (optional)</span>
              <textarea
                rows={3}
                value={brief.differentiators}
                onChange={(e) => setBrief({ ...brief, differentiators: e.target.value })}
                className="w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800 dark:bg-neutral-900"
              />
            </label>
            <button
              type="button"
              onClick={sendGenerateAll}
              disabled={isStreaming}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              {isStreaming ? "Working…" : "Generate all three voices"}
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <AgentChat
              messages={displayMessages}
              onSend={(msg) => sendWithContext(msg.content)}
              status={status}
              onStop={stop}
              error={error ?? undefined}
              colorMode={colorMode}
              className="h-full"
            />
          </div>
        </section>

        <section className="overflow-y-auto bg-neutral-50 p-4 dark:bg-neutral-900">
          <div className="space-y-3">
            {VOICES.map((voice) => (
              <PreviewCard
                key={voice}
                voice={voice}
                copy={copy[voice]}
                onRegenerate={() => regenerate(voice)}
                isLoading={isStreaming}
              />
            ))}
          </div>
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
  const [initError, setInitError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      try {
        let sbId = localStorage.getItem("landing_copy_sandbox_id")
        if (!sbId) {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem("landing_copy_sandbox_id", sbId!)
        }
        setSandboxId(sbId)

        let thId = localStorage.getItem("landing_copy_thread_id")
        if (!thId) {
          const thRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
          })
          if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
          const data = await thRes.json()
          thId = data.id
          localStorage.setItem("landing_copy_thread_id", thId!)
        }
        setThreadId(thId)
      } catch (err) {
        console.error("[client] Init failed:", err)
        setInitError(err instanceof Error ? err.message : "Failed to initialize")
      }
    }

    init()
  }, [])

  if (initError) {
    return (
      <main className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="text-center space-y-2">
          <p className="text-red-400">{initError}</p>
          <button
            onClick={() => {
              setInitError(null)
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

  return <CopywriterAgent sandboxId={sandboxId} threadId={threadId} colorMode={colorMode} />
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
