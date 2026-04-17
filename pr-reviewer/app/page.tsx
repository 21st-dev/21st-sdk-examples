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
import { DiffViewer } from "@/app/_components/diff-viewer"
import type { ReviewComment } from "@/app/_components/comment-card"
import { SAMPLE_PRS, getPr } from "@/lib/sample-data"

type PostedReview = {
  summary: string
  approval: "approve" | "request_changes" | "comment"
  postedAt: string
}

const SYSTEM_NOTE_PREFIX = "[[[SYSTEM NOTE:"
const SYSTEM_NOTE_SUFFIX = "]]]"

const TOOL_NAMES = ["add_review_comments", "post_review"] as const
type ToolName = (typeof TOOL_NAMES)[number]

function detectToolName(part: unknown): ToolName | null {
  if (!part || typeof part !== "object") return null
  const p = part as { type?: unknown; toolName?: unknown }
  const s = `${typeof p.type === "string" ? p.type : ""} ${typeof p.toolName === "string" ? p.toolName : ""}`
  for (const n of TOOL_NAMES) if (s.includes(n)) return n
  return null
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

function asToolPart(part: unknown) {
  if (!part || typeof part !== "object") return null
  const m = part as Record<string, unknown>
  const name = detectToolName(m)
  if (!name || typeof m.type !== "string") return null
  return {
    name,
    toolCallId: typeof m.toolCallId === "string" ? m.toolCallId : undefined,
    preliminary: typeof m.preliminary === "boolean" ? m.preliminary : false,
    output: m.output,
    result: m.result,
  }
}

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `pr-reviewer:messages:${sandboxId}:${threadId}`
}

function PrReviewerAgent({
  sandboxId,
  threadId,
  colorMode,
}: {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
}) {
  const [prId, setPrId] = useState<string>(SAMPLE_PRS[0].id)
  const [comments, setComments] = useState<ReviewComment[]>([])
  const [posted, setPosted] = useState<PostedReview | null>(null)
  const appliedToolCallIds = useRef<Set<string>>(new Set())

  const pr = useMemo(() => getPr(prId)!, [prId])

  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "pr-reviewer-agent",
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
          .filter((p) => !detectToolName(p))
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
        const tp = asToolPart(part)
        if (!tp || tp.preliminary) continue
        if (!tp.toolCallId || appliedToolCallIds.current.has(tp.toolCallId)) continue
        const payloadText = extractJsonText(tp.output ?? tp.result)
        if (!payloadText) continue
        try {
          const parsed = JSON.parse(payloadText)
          if (tp.name === "add_review_comments" && Array.isArray(parsed.comments)) {
            setComments(parsed.comments as ReviewComment[])
          } else if (tp.name === "post_review") {
            setPosted(parsed as PostedReview)
          }
          appliedToolCallIds.current.add(tp.toolCallId)
        } catch {}
      }
    }
  }, [messages])

  const commentsByFileLine = useMemo(() => {
    const map = new Map<string, ReviewComment[]>()
    for (const c of comments) {
      const key = `${c.file}:${c.line}`
      const arr = map.get(key) ?? []
      arr.push(c)
      map.set(key, arr)
    }
    return map
  }, [comments])

  function buildSystemNote(id: string) {
    const current = getPr(id)!
    const payload = {
      PR_TITLE: current.title,
      PR_DESCRIPTION: current.description,
      FILES: current.files,
    }
    return `${SYSTEM_NOTE_PREFIX} ${JSON.stringify(payload)} ${SYSTEM_NOTE_SUFFIX}`
  }

  function sendWithContext(text: string) {
    sendMessage({ text: `${buildSystemNote(prId)}\n\n${text}` })
  }

  function switchPr(id: string) {
    if (id === prId) return
    setPrId(id)
    setComments([])
    setPosted(null)
    appliedToolCallIds.current.clear()
  }

  const agentOnline = !error && messages.length > 0
  const counts = comments.reduce(
    (acc, c) => {
      acc[c.severity]++
      return acc
    },
    { critical: 0, warning: 0, nit: 0 } as Record<"critical" | "warning" | "nit", number>,
  )

  return (
    <div className={`flex flex-col xs:flex-row h-screen bg-background text-foreground${colorMode === "dark" ? " dark" : ""}`}>
      <AgentSidebar partnerLogo={<span className="text-sm font-medium">PR Reviewer</span>}>
        <SetupChecklist agentOnline={agentOnline} />
        <SidebarSection label="Try">
          <SidebarPromptButton onClick={() => sendWithContext("Review this PR end-to-end.")}>
            Review this PR
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Focus only on security issues.")}>
            Security-only pass
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Are there any performance concerns?")}>
            Performance pass
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Post approval with a short summary.")}>
            Post approval
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Post request_changes with a summary of the blockers.")}>
            Request changes
          </SidebarPromptButton>
        </SidebarSection>
      </AgentSidebar>

      <main className="flex-1 min-w-0 grid grid-cols-1 xs:grid-cols-[minmax(0,1fr)_minmax(0,380px)] overflow-hidden">
        <section className="overflow-y-auto border-r border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {SAMPLE_PRS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => switchPr(p.id)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  p.id === prId
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700"
                }`}
              >
                {p.id}
              </button>
            ))}
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-sm font-semibold">{pr.title}</h2>
            <p className="mt-0.5 text-xs text-neutral-500">{pr.description}</p>
            <div className="mt-2 flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-red-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                {counts.critical} critical
              </span>
              <span className="flex items-center gap-1 text-amber-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
                {counts.warning} warnings
              </span>
              <span className="flex items-center gap-1 text-zinc-400">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-400" />
                {counts.nit} nits
              </span>
              <span className="ml-auto">
                {posted ? (
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                    Review posted · {posted.approval.replace("_", " ")}
                  </span>
                ) : (
                  <span className="text-neutral-400">No review posted</span>
                )}
              </span>
            </div>
          </div>

          <DiffViewer files={pr.files} commentsByFileLine={commentsByFileLine} />
        </section>

        <section className="h-full min-h-0 hidden xs:block">
          <AgentChat
            messages={displayMessages}
            onSend={(msg) => sendWithContext(msg.content)}
            status={status}
            onStop={stop}
            error={error ?? undefined}
            colorMode={colorMode}
            className="h-full"
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
  const [initError, setInitError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      try {
        let sbId = localStorage.getItem("pr_reviewer_sandbox_id")
        if (!sbId) {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem("pr_reviewer_sandbox_id", sbId!)
        }
        setSandboxId(sbId)

        let thId = localStorage.getItem("pr_reviewer_thread_id")
        if (!thId) {
          const thRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
          })
          if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
          const data = await thRes.json()
          thId = data.id
          localStorage.setItem("pr_reviewer_thread_id", thId!)
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

  return <PrReviewerAgent sandboxId={sandboxId} threadId={threadId} colorMode={colorMode} />
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
