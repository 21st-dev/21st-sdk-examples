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

const ICON_SEARCH = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
)
const ICON_CHART = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" /><path d="M7 16V9" /><path d="M12 16v-5" /><path d="M17 16V5" />
  </svg>
)
const ICON_HASH = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="15" y2="15" /><line x1="10" x2="8" y1="3" y2="21" /><line x1="16" x2="14" y1="3" y2="21" />
  </svg>
)
const ICON_BOOK = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)
const ICON_PLUS = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
)
const ICON_PENCIL = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" />
  </svg>
)
const ICON_TRASH = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)
const ICON_DOLLAR = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="2" y2="22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

function inferColumnType(rows: Value[][], colIdx: number): string {
  for (const r of rows) {
    const v = r[colIdx]
    if (v == null) continue
    if (typeof v === "number") return Number.isInteger(v) ? "int8" : "float8"
    if (typeof v === "boolean") return "bool"
    if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) return "date"
      return "text"
    }
  }
  return "text"
}

function TableEditor({
  result,
  activeTable,
  onSelectTable,
}: {
  result: QueryResult | null
  activeTable: string | null
  onSelectTable: (name: string) => void
}) {
  const [filter, setFilter] = useState("")
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [tab, setTab] = useState<"definition" | "data">("data")
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set())
  const prevIdsRef = useRef<Set<string>>(new Set())
  const prevTableRef = useRef<string | null>(null)

  useEffect(() => {
    setPage(1)
    setFilter("")
    setSortCol(null)
  }, [result])

  useEffect(() => {
    if (!result || !result.ok) {
      prevIdsRef.current = new Set()
      prevTableRef.current = null
      return
    }
    const idCol = result.columns.indexOf("id")
    if (idCol === -1) {
      prevIdsRef.current = new Set()
      prevTableRef.current = activeTable
      return
    }
    const currentIds = new Set(result.rows.map((r) => String(r[idCol])))
    const sameTable = prevTableRef.current === activeTable
    if (sameTable && prevIdsRef.current.size > 0) {
      const fresh: string[] = []
      for (const id of currentIds) if (!prevIdsRef.current.has(id)) fresh.push(id)
      if (fresh.length > 0 && fresh.length < currentIds.size) {
        setFlashIds(new Set(fresh))
        const t = window.setTimeout(() => setFlashIds(new Set()), 2400)
        prevIdsRef.current = currentIds
        prevTableRef.current = activeTable
        return () => window.clearTimeout(t)
      }
    }
    prevIdsRef.current = currentIds
    prevTableRef.current = activeTable
  }, [result, activeTable])

  const tableTabs = (
    <div className="flex shrink-0 items-center gap-0 overflow-x-auto border-b border-neutral-200 bg-neutral-50 px-2 dark:border-neutral-800 dark:bg-neutral-900/50">
      {Object.keys(SCHEMA).map((name) => {
        const isActive = activeTable === name
        return (
          <button
            key={name}
            type="button"
            onClick={() => onSelectTable(name)}
            className={`flex h-9 items-center gap-1.5 border-b-2 px-3 text-xs font-mono transition-colors ${
              isActive
                ? "border-emerald-500 text-neutral-900 dark:text-white"
                : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {name}
            <span className="text-[10px] text-neutral-400">{SCHEMA[name].rows.length}</span>
          </button>
        )
      })}
    </div>
  )

  if (!result) {
    return (
      <div className="h-full flex flex-col min-h-0">
        {tableTabs}
        <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">
          Pick a table or ask the assistant.
        </div>
      </div>
    )
  }

  if (!result.ok) {
    return (
      <div className="h-full flex flex-col min-h-0">
        {tableTabs}
        <Toolbar filter={filter} onFilter={setFilter} disabled />
        <div className="flex-1 p-4">
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-400">
            {result.error}
          </div>
        </div>
      </div>
    )
  }

  const columns = result.columns
  const types = columns.map((_, i) => inferColumnType(result.rows, i))

  const filtered = filter
    ? result.rows.filter((r) =>
        r.some((v) => String(v ?? "").toLowerCase().includes(filter.toLowerCase())),
      )
    : result.rows

  const sorted = sortCol != null
    ? [...filtered].sort((a, b) => {
        const av = a[sortCol]
        const bv = b[sortCol]
        const dir = sortDir === "asc" ? 1 : -1
        if (av === bv) return 0
        if (av == null) return 1
        if (bv == null) return -1
        return av < bv ? -1 * dir : 1 * dir
      })
    : filtered

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function toggleSort(idx: number) {
    if (sortCol === idx) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortCol(idx)
      setSortDir("asc")
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {tableTabs}
      <Toolbar filter={filter} onFilter={setFilter} />

      {tab === "data" ? (
        <div className="flex-1 overflow-auto min-h-0">
          <table className="border-separate border-spacing-0 text-xs font-mono min-w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={c}
                    className="border-b border-r border-neutral-200 bg-neutral-100 px-3 py-1.5 text-left font-normal dark:border-neutral-800 dark:bg-neutral-900"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(i)}
                      className="flex items-center gap-1.5 hover:text-neutral-900 dark:hover:text-white"
                    >
                      {c === "id" && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                          <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
                          <path d="m21 2-9.6 9.6" />
                          <circle cx="7.5" cy="15.5" r="5.5" />
                        </svg>
                      )}
                      <span className="text-neutral-800 dark:text-neutral-200">{c}</span>
                      <span className="text-[10px] text-neutral-400">{types[i]}</span>
                      {sortCol === i && (
                        <span className="text-neutral-500">{sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center text-neutral-400">
                    No rows
                  </td>
                </tr>
              )}
              {pageRows.map((row, i) => {
                const absoluteIdx = (currentPage - 1) * pageSize + i
                const idColIdx = columns.indexOf("id")
                const rowId = idColIdx !== -1 ? String(row[idColIdx]) : null
                const isFlashing = rowId != null && flashIds.has(rowId)
                return (
                  <tr
                    key={rowId ?? absoluteIdx}
                    className={`${isFlashing ? "row-flash" : "even:bg-neutral-50 dark:even:bg-neutral-900/40"}`}
                  >
                    {row.map((v, j) => (
                      <td
                        key={j}
                        className="border-b border-r border-neutral-100 px-3 py-1.5 text-neutral-800 dark:border-neutral-900 dark:text-neutral-200 whitespace-nowrap"
                      >
                        {v === null ? (
                          <span className="text-neutral-400">null</span>
                        ) : v === "" ? (
                          <span className="text-neutral-400">empty</span>
                        ) : (
                          String(v)
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 overflow-auto min-h-0 p-4">
          <pre className="rounded-md border border-neutral-200 bg-neutral-50 p-3 font-mono text-xs text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 whitespace-pre-wrap break-all">
            {result.sql}
          </pre>
        </div>
      )}

      <div className="flex min-h-9 items-center gap-4 border-t border-neutral-200 px-3 text-xs dark:border-neutral-800">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-6 w-6 items-center justify-center rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="text-neutral-500">Page</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={currentPage}
            onChange={(e) => setPage(Math.max(1, Math.min(totalPages, Number(e.target.value) || 1)))}
            className="h-6 w-10 rounded border border-neutral-300 bg-transparent px-1.5 text-center dark:border-neutral-700"
          />
          <span className="text-neutral-500">of {totalPages}</span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-6 w-6 items-center justify-center rounded border border-neutral-300 text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            aria-label="Next page"
          >
            ›
          </button>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            className="h-6 rounded border border-neutral-300 bg-transparent px-1.5 dark:border-neutral-700"
          >
            {[25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n} rows</option>
            ))}
          </select>
        </div>
        <span className="text-neutral-500">
          {sorted.length.toLocaleString()} record{sorted.length === 1 ? "" : "s"}
        </span>

        <div className="ml-auto relative flex h-7 items-center rounded-md border border-neutral-300 p-[1px] dark:border-neutral-700">
          <span
            className="absolute inset-y-[1px] rounded bg-neutral-200 shadow-sm transition-transform dark:bg-neutral-800"
            style={{ width: "76px", transform: `translateX(${tab === "definition" ? "0" : "76px"})` }}
          />
          {(["definition", "data"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative z-10 w-[76px] text-center capitalize ${tab === t ? "text-neutral-900 dark:text-white" : "text-neutral-500"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Toolbar({ filter, onFilter, disabled }: { filter: string; onFilter: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="shrink-0 flex items-center gap-2 border-b border-neutral-200 px-2 py-1.5 dark:border-neutral-800">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-400">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={filter}
        onChange={(e) => onFilter(e.target.value)}
        placeholder="Filter rows"
        disabled={disabled}
        className="w-full bg-transparent text-xs outline-none placeholder:text-neutral-400 disabled:opacity-50"
      />
    </div>
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
  const DEFAULT_TABLE = "customers"
  const defaultTable = SCHEMA[DEFAULT_TABLE]
  const [result, setResult] = useState<QueryResult | null>({
    ok: true,
    sql: `SELECT * FROM ${DEFAULT_TABLE}`,
    columns: defaultTable.columns,
    rows: defaultTable.rows.slice(),
    rowCount: defaultTable.rows.length,
  })
  const [activeTable, setActiveTable] = useState<string | null>(DEFAULT_TABLE)
  const [writeMode, setWriteMode] = useState(false)
  const appliedToolCallIds = useRef<Set<string>>(new Set())

  function selectTable(name: string) {
    const t = SCHEMA[name]
    if (!t) return
    setActiveTable(name)
    setResult({
      ok: true,
      sql: `SELECT * FROM ${name}`,
      columns: t.columns,
      rows: t.rows.slice(),
      rowCount: t.rows.length,
    })
  }

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
              setResult(parsed)
              const tableMatch = parsed.sql.match(/FROM\s+(\w+)/i)
              if (tableMatch && SCHEMA[tableMatch[1].toLowerCase()]) {
                setActiveTable(tableMatch[1].toLowerCase())
              }
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
    return `${SYSTEM_NOTE_PREFIX} CURRENT_SCHEMA: ${JSON.stringify(SCHEMA_PUBLIC)} WRITE_MODE: ${writeMode ? "enabled" : "disabled"} ${SYSTEM_NOTE_SUFFIX}`
  }

  function sendWithContext(text: string) {
    sendMessage({ text: `${buildSystemContextPrefix()}\n\n${text}` })
  }

  const agentOnline = !error && messages.length > 0

  return (
    <div className={`flex flex-col xs:flex-row h-screen bg-background text-foreground${colorMode === "dark" ? " dark" : ""}`}>
      <AgentSidebar partnerLogo={<span className="flex items-center gap-1.5 text-sm font-medium"><SqlLogo /> SQL Chat</span>}>
        <SetupChecklist agentOnline={agentOnline} />
        <SidebarSection label="Read examples">
          <SidebarPromptButton icon={ICON_CHART} onClick={() => sendWithContext("Show me the top 5 orders by total_cents, highest first.")}>
            Top 5 orders by revenue
          </SidebarPromptButton>
          <SidebarPromptButton icon={ICON_SEARCH} onClick={() => sendWithContext("Which products are in the 'plan' category?")}>
            Plan products
          </SidebarPromptButton>
          <SidebarPromptButton icon={ICON_SEARCH} onClick={() => sendWithContext("Find orders where notes LIKE '%rush%'.")}>
            Rush orders
          </SidebarPromptButton>
          <SidebarPromptButton icon={ICON_HASH} onClick={() => sendWithContext("How many customers do we have?")}>
            Count customers
          </SidebarPromptButton>
          <SidebarPromptButton icon={ICON_BOOK} onClick={() => sendWithContext("Describe all tables.")}>
            Describe schema
          </SidebarPromptButton>
        </SidebarSection>

        <SidebarSection label="Write examples">
          {!writeMode && (
            <p className="px-1 pb-1 text-[11px] text-amber-600 dark:text-amber-400/80">
              Switch to <span className="font-medium">Read &amp; Write</span> in the chat input to run these.
            </p>
          )}
          <SidebarPromptButton icon={ICON_PLUS} onClick={() => sendWithContext("Add a new customer: name 'Mira Okafor', email 'mira@example.com', country 'NG', signup_month '2025-05'.")}>
            Add a customer
          </SidebarPromptButton>
          <SidebarPromptButton icon={ICON_PENCIL} onClick={() => sendWithContext("Update order 5006: set status to 'paid'.")}>
            Mark order 5006 as paid
          </SidebarPromptButton>
          <SidebarPromptButton icon={ICON_TRASH} onClick={() => sendWithContext("Delete all orders where status = 'refunded'.")}>
            Delete refunded orders
          </SidebarPromptButton>
          <SidebarPromptButton icon={ICON_DOLLAR} onClick={() => sendWithContext("Raise Pro Plan price to 3900 cents.")}>
            Bump Pro Plan price
          </SidebarPromptButton>
        </SidebarSection>
      </AgentSidebar>

      <main className="flex-1 min-w-0 grid grid-cols-1 xs:grid-cols-[minmax(0,1fr)_minmax(0,380px)] overflow-hidden">
        <section className="border-r border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 overflow-hidden min-h-0">
          <TableEditor result={result} activeTable={activeTable} onSelectTable={selectTable} />
        </section>

        <section className="h-full min-h-0 hidden xs:block">
          <AgentChat
            messages={displayMessages}
            onSend={(msg) => sendWithContext(msg.content)}
            status={status}
            onStop={stop}
            error={error ?? undefined}
            colorMode={colorMode}
            theme={{
              theme: { "--an-mode-selector-position": "inline" },
              light: {},
              dark: {},
            }}
            modeSelector={{
              modes: [
                { id: "read", label: "Read-only" },
                { id: "write", label: "Read & Write" },
              ],
              activeMode: writeMode ? "write" : "read",
              onModeChange: (id) => setWriteMode(id === "write"),
            }}
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
        let sbId = localStorage.getItem("sql_chat_sandbox_id_v4")
        if (!sbId) {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem("sql_chat_sandbox_id_v4", sbId!)
        }
        setSandboxId(sbId)

        let thId = localStorage.getItem("sql_chat_thread_id_v4")
        if (!thId) {
          const thRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
          })
          if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
          const data = await thRes.json()
          thId = data.id
          localStorage.setItem("sql_chat_thread_id_v4", thId!)
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
