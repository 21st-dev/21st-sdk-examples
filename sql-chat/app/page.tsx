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
import { SCHEMA, type QueryResult, type Value } from "@/lib/sql-engine"

const SYSTEM_NOTE_PREFIX = "[[[SYSTEM NOTE:"
const SYSTEM_NOTE_SUFFIX = "]]]"

const SCHEMA_PUBLIC = Object.fromEntries(
  Object.entries(SCHEMA).map(([k, v]) => [k, v.columns]),
)

function isSqlToolPart(part: unknown): boolean {
  if (!part || typeof part !== "object") return false
  const p = part as { type?: unknown; toolName?: unknown }
  const names = ["run_sql", "describe_schema"]
  if (typeof p.type === "string" && names.some((n) => p.type!.toString().includes(n))) return true
  if (typeof p.toolName === "string" && names.some((n) => p.toolName!.toString().includes(n)))
    return true
  return false
}

function stripSystemNotePrefix(text: string): string {
  if (!text.startsWith(SYSTEM_NOTE_PREFIX)) return text
  const suffixIndex = text.indexOf(SYSTEM_NOTE_SUFFIX)
  if (suffixIndex === -1) return text
  return text.slice(suffixIndex + SYSTEM_NOTE_SUFFIX.length).trimStart()
}

function extractJsonText(output: unknown): string | null {
  if (typeof output === "string") return output
  if (Array.isArray(output)) {
    const texts: string[] = []
    for (const item of output) {
      if (typeof item === "string") texts.push(item)
      else if (item && typeof item === "object") {
        const p = item as { type?: unknown; text?: unknown }
        if (p.type === "text" && typeof p.text === "string") texts.push(p.text)
      }
    }
    return texts.length ? texts.join("") : null
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

function asToolPart(part: unknown): ToolPart | null {
  if (!part || typeof part !== "object") return null
  const m = part as Record<string, unknown>
  if (typeof m.type !== "string" || !isSqlToolPart(m)) return null
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

function toolNameFrom(part: ToolPart): "run_sql" | "describe_schema" | null {
  const s = `${part.type} ${part.toolName ?? ""}`
  if (s.includes("run_sql")) return "run_sql"
  if (s.includes("describe_schema")) return "describe_schema"
  return null
}

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `sql-chat:messages:${sandboxId}:${threadId}`
}

function SqlLogo() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
  )
}

function SqlAgent({
  sandboxId,
  threadId,
  colorMode,
}: {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
}) {
  const [expandedTable, setExpandedTable] = useState<string | null>("orders")
  const [editorSql, setEditorSql] = useState("SELECT * FROM orders ORDER BY total_cents DESC LIMIT 5")
  const [result, setResult] = useState<QueryResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const appliedToolCallIds = useRef<Set<string>>(new Set())

  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "sql-agent",
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
          .filter((p) => !isSqlToolPart(p))
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
        const payloadText = extractJsonText(tp.output ?? tp.result)
        if (!payloadText) continue
        if (!tp.toolCallId || appliedToolCallIds.current.has(tp.toolCallId)) continue

        const name = toolNameFrom(tp)
        if (name === "run_sql") {
          try {
            const parsed = JSON.parse(payloadText) as QueryResult
            if (parsed && typeof parsed === "object" && "sql" in parsed) {
              setEditorSql(parsed.sql)
              setResult(parsed)
              appliedToolCallIds.current.add(tp.toolCallId)
            }
          } catch {}
        } else if (name === "describe_schema") {
          appliedToolCallIds.current.add(tp.toolCallId)
        }
      }
    }
  }, [messages])

  function buildSystemContextPrefix() {
    return `${SYSTEM_NOTE_PREFIX} CURRENT_SCHEMA: ${JSON.stringify(SCHEMA_PUBLIC)} ${SYSTEM_NOTE_SUFFIX}`
  }

  function sendWithContext(text: string) {
    sendMessage({ text: `${buildSystemContextPrefix()}\n\n${text}` })
  }

  async function runEditor() {
    setIsRunning(true)
    try {
      const res = await fetch("/api/run-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: editorSql }),
      })
      const data = (await res.json()) as QueryResult
      setResult(data)
    } catch (err) {
      setResult({ ok: false, sql: editorSql, error: err instanceof Error ? err.message : "Run failed" })
    } finally {
      setIsRunning(false)
    }
  }

  const agentOnline = !error && messages.length > 0

  return (
    <div className={`flex flex-col xs:flex-row h-screen bg-background text-foreground${colorMode === "dark" ? " dark" : ""}`}>
      <AgentSidebar partnerLogo={<span className="flex items-center gap-1.5 text-sm font-medium"><SqlLogo /> SQL Chat</span>}>
        <SetupChecklist agentOnline={agentOnline} />
        <SidebarSection label="Try">
          <SidebarPromptButton onClick={() => sendWithContext("Show me the top 5 orders by total_cents, highest first.")}>
            Top 5 orders by revenue
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Which products are in the 'plan' category?")}>
            Plan products
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Find orders where notes LIKE '%rush%'.")}>
            Rush orders
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("How many customers do we have?")}>
            Count customers
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Describe all tables.")}>
            Describe schema
          </SidebarPromptButton>
        </SidebarSection>
      </AgentSidebar>

      <main className="flex-1 min-w-0 grid grid-cols-1 xs:grid-cols-[minmax(0,1fr)_minmax(0,380px)] overflow-hidden">
        <section className="grid grid-rows-[auto_auto_minmax(0,1fr)] border-r border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 overflow-hidden">
          <div className="border-b border-neutral-200 dark:border-neutral-800 p-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 mb-2">Schema</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SCHEMA).map(([name, t]) => {
                const open = expandedTable === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      if (open) {
                        setExpandedTable(null)
                      } else {
                        setExpandedTable(name)
                        sendWithContext(`Describe the ${name} table.`)
                      }
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-mono transition-colors ${
                      open
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700"
                    }`}
                  >
                    {name}
                    <span className="ml-1.5 text-neutral-400">{t.columns.length}</span>
                  </button>
                )
              })}
            </div>
            {expandedTable && SCHEMA[expandedTable] && (
              <div className="mt-2 flex flex-wrap gap-1 font-mono text-[11px] text-neutral-500">
                {SCHEMA[expandedTable].columns.map((c) => (
                  <span key={c} className="rounded bg-neutral-100 px-1.5 py-0.5 dark:bg-neutral-900">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="border-b border-neutral-200 dark:border-neutral-800 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">SQL</p>
              <button
                type="button"
                onClick={runEditor}
                disabled={isRunning}
                className="rounded-md bg-neutral-900 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
              >
                {isRunning ? "Running…" : "Run"}
              </button>
            </div>
            <textarea
              value={editorSql}
              onChange={(e) => setEditorSql(e.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[13px] text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>

          <div className="min-h-0 overflow-auto p-3">
            <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 mb-2">
              Results {result?.ok ? `· ${result.rowCount} row${result.rowCount === 1 ? "" : "s"}` : ""}
            </p>
            {!result && (
              <p className="text-xs text-neutral-400">Run a query or ask the assistant.</p>
            )}
            {result && !result.ok && (
              <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-400">
                {result.error}
              </div>
            )}
            {result?.ok && (
              <table className="w-full border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    {result.columns.map((c) => (
                      <th key={c} className="px-2 py-1.5 text-left font-medium text-neutral-500">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-900">
                      {row.map((v: Value, j) => (
                        <td key={j} className="px-2 py-1.5 text-neutral-800 dark:text-neutral-200">
                          {v === null ? <span className="text-neutral-400">null</span> : String(v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
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
        let sbId = localStorage.getItem("sql_chat_sandbox_id")
        if (!sbId) {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem("sql_chat_sandbox_id", sbId!)
        }
        setSandboxId(sbId)

        let thId = localStorage.getItem("sql_chat_thread_id")
        if (!thId) {
          const thRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
          })
          if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
          const data = await thRes.json()
          thId = data.id
          localStorage.setItem("sql_chat_thread_id", thId!)
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

  return <SqlAgent sandboxId={sandboxId} threadId={threadId} colorMode={colorMode} />
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
