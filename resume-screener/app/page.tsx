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
import { SAMPLE_CANDIDATES, SAMPLE_JD, type Candidate } from "@/lib/sample-data"

type Tier = "strong" | "maybe" | "weak"

type CandidateEval = {
  id: string
  score: number
  tier: Tier
  strengths: string[]
  concerns: string[]
  summary: string
}

const SYSTEM_NOTE_PREFIX = "[[[SYSTEM NOTE:"
const SYSTEM_NOTE_SUFFIX = "]]]"

const TIER_ORDER: Tier[] = ["strong", "maybe", "weak"]
const TIER_LABEL: Record<Tier, string> = {
  strong: "Strong",
  maybe: "Maybe",
  weak: "Weak",
}
const TIER_COLOR: Record<Tier, string> = {
  strong: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  maybe: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  weak: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
}

function isRankToolPart(part: unknown): boolean {
  if (!part || typeof part !== "object") return false
  const p = part as { type?: unknown; toolName?: unknown }
  const typ = typeof p.type === "string" ? p.type : ""
  const tn = typeof p.toolName === "string" ? p.toolName : ""
  return typ.includes("rank_candidates") || tn.includes("rank_candidates")
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
      if (p && typeof p === "object" && p.type === "text" && typeof p.text === "string") {
        return p.text
      }
    }
  }
  return null
}

type ToolPart = {
  type: string
  toolName?: string
  toolCallId?: string
  state?: string
  preliminary?: boolean
  output?: unknown
  result?: unknown
}

function asRankToolPart(part: unknown): ToolPart | null {
  if (!part || typeof part !== "object") return null
  const m = part as Record<string, unknown>
  if (typeof m.type !== "string" || !isRankToolPart(m)) return null
  return {
    type: m.type,
    toolName: typeof m.toolName === "string" ? m.toolName : undefined,
    toolCallId: typeof m.toolCallId === "string" ? m.toolCallId : undefined,
    state: typeof m.state === "string" ? m.state : undefined,
    preliminary: typeof m.preliminary === "boolean" ? m.preliminary : undefined,
    output: m.output,
    result: m.result,
  }
}

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `resume-screener:messages:${sandboxId}:${threadId}`
}

function ScreenerAgent({
  sandboxId,
  threadId,
  colorMode,
}: {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
}) {
  const [jd, setJd] = useState(SAMPLE_JD)
  const [evals, setEvals] = useState<CandidateEval[]>([])
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const appliedToolCallIds = useRef<Set<string>>(new Set())

  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "resume-screener-agent",
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
          .filter((p) => !isRankToolPart(p))
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
        const tp = asRankToolPart(part)
        if (!tp || tp.preliminary) continue
        if (!tp.toolCallId || appliedToolCallIds.current.has(tp.toolCallId)) continue
        const payloadText = extractJsonText(tp.output ?? tp.result)
        if (!payloadText) continue
        try {
          const parsed = JSON.parse(payloadText) as { ranked?: CandidateEval[] }
          if (Array.isArray(parsed.ranked)) {
            setEvals(parsed.ranked)
            appliedToolCallIds.current.add(tp.toolCallId)
          }
        } catch {}
      }
    }
  }, [messages])

  function buildSystemNote() {
    const candidatesPayload = SAMPLE_CANDIDATES.map((c) => ({ id: c.id, name: c.name, text: c.text }))
    return `${SYSTEM_NOTE_PREFIX} JOB_DESCRIPTION: ${JSON.stringify(jd)} | CANDIDATES: ${JSON.stringify(candidatesPayload)} ${SYSTEM_NOTE_SUFFIX}`
  }

  function sendWithContext(text: string) {
    sendMessage({ text: `${buildSystemNote()}\n\n${text}` })
  }

  const evalsById = useMemo(() => {
    const map = new Map<string, CandidateEval>()
    for (const e of evals) map.set(e.id, e)
    return map
  }, [evals])

  const grouped: Record<Tier, (CandidateEval & Candidate)[]> = {
    strong: [],
    maybe: [],
    weak: [],
  }
  for (const e of evals) {
    const c = SAMPLE_CANDIDATES.find((x) => x.id === e.id)
    if (!c) continue
    grouped[e.tier].push({ ...c, ...e })
  }

  const drawerCandidate = drawerId ? SAMPLE_CANDIDATES.find((c) => c.id === drawerId) : null
  const drawerEval = drawerId ? evalsById.get(drawerId) : null
  const agentOnline = !error && messages.length > 0

  return (
    <div className={`flex flex-col xs:flex-row h-screen bg-background text-foreground${colorMode === "dark" ? " dark" : ""}`}>
      <AgentSidebar partnerLogo={<span className="text-sm font-medium">Resume Screener</span>}>
        <SetupChecklist agentOnline={agentOnline} />
        <SidebarSection label="Try">
          <SidebarPromptButton onClick={() => sendWithContext("Screen all candidates against the JD.")}>
            Screen all candidates
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Rescore assuming this role is remote-only, distributed team.")}>
            Rescore (remote-only)
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Which candidates have startup or 0-to-1 experience?")}>
            Startup experience?
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Who has the strongest TypeScript background? Rerank for TS-heavy work.")}>
            Strongest TypeScript
          </SidebarPromptButton>
        </SidebarSection>
      </AgentSidebar>

      <main className="flex-1 min-w-0 grid grid-cols-1 xs:grid-cols-[minmax(0,1fr)_minmax(0,380px)] overflow-hidden relative">
        <section className="overflow-y-auto border-r border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">Job description</p>
              <button
                type="button"
                onClick={() => sendWithContext("Screen all candidates against this JD.")}
                className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                Screen
              </button>
            </div>
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 mb-2">
              Candidates · {SAMPLE_CANDIDATES.length} bundled
            </p>
            <ul className="space-y-1.5">
              {SAMPLE_CANDIDATES.map((c) => {
                const e = evalsById.get(c.id)
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setDrawerId(c.id)}
                      className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium">{c.name}</span>
                        {e && (
                          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TIER_COLOR[e.tier]}`}>
                            {e.score}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-500 line-clamp-1">{c.headline}</p>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 mb-2">
              Ranked {evals.length > 0 ? `· ${evals.length}` : ""}
            </p>
            {evals.length === 0 && (
              <p className="text-xs text-neutral-400">
                Click <span className="font-medium text-neutral-600 dark:text-neutral-300">Screen</span> or ask the agent to rank candidates.
              </p>
            )}
            {evals.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {TIER_ORDER.map((tier) => (
                  <div key={tier} className="space-y-1.5">
                    <p className={`text-[10px] font-medium uppercase tracking-widest rounded-full border px-2 py-0.5 inline-block ${TIER_COLOR[tier]}`}>
                      {TIER_LABEL[tier]} · {grouped[tier].length}
                    </p>
                    {grouped[tier].map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setDrawerId(c.id)}
                        className="w-full rounded-md border border-neutral-200 bg-white p-2.5 text-left hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{c.name}</span>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TIER_COLOR[c.tier]}`}>
                            {c.score}
                          </span>
                        </div>
                        {c.strengths.slice(0, 2).map((s, i) => (
                          <p key={i} className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">+ {s}</p>
                        ))}
                        {c.concerns.slice(0, 2).map((s, i) => (
                          <p key={i} className="mt-0.5 text-[11px] text-red-700 dark:text-red-400">! {s}</p>
                        ))}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
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

        {drawerCandidate && (
          <>
            <div
              className="absolute inset-0 z-10 bg-black/30 backdrop-blur-sm"
              onClick={() => setDrawerId(null)}
            />
            <aside className="absolute right-0 top-0 bottom-0 z-20 w-full xs:w-[420px] border-l border-neutral-200 bg-white p-4 shadow-xl overflow-y-auto dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <h3 className="text-sm font-semibold">{drawerCandidate.name}</h3>
                  <p className="text-[11px] text-neutral-500">{drawerCandidate.headline}</p>
                </div>
                {drawerEval && (
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TIER_COLOR[drawerEval.tier]}`}>
                    {drawerEval.score} · {TIER_LABEL[drawerEval.tier]}
                  </span>
                )}
              </div>
              {drawerEval && (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 mb-1">Strengths</p>
                    <ul className="space-y-0.5">
                      {drawerEval.strengths.map((s, i) => (
                        <li key={i} className="text-xs text-emerald-700 dark:text-emerald-400">+ {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 mb-1">Concerns</p>
                    <ul className="space-y-0.5">
                      {drawerEval.concerns.map((s, i) => (
                        <li key={i} className="text-xs text-red-700 dark:text-red-400">! {s}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 mb-1">Summary</p>
                    <p className="text-xs text-neutral-700 dark:text-neutral-300">{drawerEval.summary}</p>
                  </div>
                </div>
              )}
              <div className="mt-4">
                <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 mb-1">Resume</p>
                <p className="whitespace-pre-wrap text-xs text-neutral-700 dark:text-neutral-300">{drawerCandidate.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerId(null)}
                className="mt-5 w-full rounded-md bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                Close
              </button>
            </aside>
          </>
        )}
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
        let sbId = localStorage.getItem("resume_screener_sandbox_id")
        if (!sbId) {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem("resume_screener_sandbox_id", sbId!)
        }
        setSandboxId(sbId)

        let thId = localStorage.getItem("resume_screener_thread_id")
        if (!thId) {
          const thRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
          })
          if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
          const data = await thRes.json()
          thId = data.id
          localStorage.setItem("resume_screener_thread_id", thId!)
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

  return <ScreenerAgent sandboxId={sandboxId} threadId={threadId} colorMode={colorMode} />
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
