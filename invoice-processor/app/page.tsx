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
import { InvoicePreview } from "@/app/_components/invoice-preview"
import { PO_DB, SAMPLE_INVOICES, getInvoice, type LineItem } from "@/lib/sample-data"

type ExtractedPayload = {
  invoiceId: string
  vendor: string
  amount: number
  currency: string
  invoiceDate: string
  poNumber?: string | null
  lineItems: LineItem[]
  vatAmount?: number
  vatRate?: number
}

type MatchPayload = {
  invoiceId: string
  poNumber: string | null
  status: "matched" | "mismatch" | "not_found"
  reasons: string[]
}

type PushPayload = {
  invoiceId: string
  system: "quickbooks" | "xero"
  pushedAt: string
  success: boolean
}

const SYSTEM_NOTE_PREFIX = "[[[SYSTEM NOTE:"
const SYSTEM_NOTE_SUFFIX = "]]]"

const TOOL_NAMES = ["extract_invoice", "match_po", "push_to_accounting"] as const
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
  if (typeof m.type !== "string") return null
  const name = detectToolName(m)
  if (!name) return null
  return {
    name,
    toolCallId: typeof m.toolCallId === "string" ? m.toolCallId : undefined,
    preliminary: typeof m.preliminary === "boolean" ? m.preliminary : false,
    output: m.output,
    result: m.result,
  }
}

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `invoice-processor:messages:${sandboxId}:${threadId}`
}

function InvoiceAgent({
  sandboxId,
  threadId,
  colorMode,
}: {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
}) {
  const [invoiceId, setInvoiceId] = useState<string>(SAMPLE_INVOICES[0].id)
  const [extracted, setExtracted] = useState<ExtractedPayload | null>(null)
  const [match, setMatch] = useState<MatchPayload | null>(null)
  const [pushed, setPushed] = useState<PushPayload | null>(null)
  const appliedToolCallIds = useRef<Set<string>>(new Set())

  const invoice = useMemo(() => getInvoice(invoiceId)!, [invoiceId])

  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "invoice-agent",
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
          if (tp.name === "extract_invoice") setExtracted(parsed as ExtractedPayload)
          else if (tp.name === "match_po") setMatch(parsed as MatchPayload)
          else if (tp.name === "push_to_accounting") setPushed(parsed as PushPayload)
          appliedToolCallIds.current.add(tp.toolCallId)
        } catch {}
      }
    }
  }, [messages])

  function buildSystemNote(id: string) {
    const inv = getInvoice(id)!
    return `${SYSTEM_NOTE_PREFIX} CURRENT_INVOICE_ID: "${inv.id}" | RAW_TEXT: ${JSON.stringify(inv.rawText)} | PO_DB: ${JSON.stringify(PO_DB)} ${SYSTEM_NOTE_SUFFIX}`
  }

  function sendWithContext(text: string) {
    sendMessage({ text: `${buildSystemNote(invoiceId)}\n\n${text}` })
  }

  function switchInvoice(id: string) {
    if (id === invoiceId) return
    setInvoiceId(id)
    setExtracted(null)
    setMatch(null)
    setPushed(null)
    appliedToolCallIds.current.clear()
    const note = `${SYSTEM_NOTE_PREFIX} CURRENT_INVOICE_ID: "${id}" | RAW_TEXT: ${JSON.stringify(
      getInvoice(id)!.rawText,
    )} | PO_DB: ${JSON.stringify(PO_DB)} ${SYSTEM_NOTE_SUFFIX}`
    sendMessage({ text: `${note}\n\nExtract this invoice and match the PO.` })
  }

  const banner = (() => {
    if (!match) return null
    if (match.status === "matched") {
      return { tone: "ok" as const, text: `Matched ${match.poNumber}${match.reasons[0] ? " — " + match.reasons[0] : ""}` }
    }
    if (match.status === "mismatch") {
      return { tone: "warn" as const, text: `Mismatch vs ${match.poNumber}${match.reasons[0] ? ": " + match.reasons[0] : ""}` }
    }
    return { tone: "err" as const, text: `PO not found${match.reasons[0] ? " — " + match.reasons[0] : ""}` }
  })()

  const bannerClass =
    banner?.tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : banner?.tone === "warn"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"

  const agentOnline = !error && messages.length > 0

  return (
    <div className={`flex flex-col xs:flex-row h-screen bg-background text-foreground${colorMode === "dark" ? " dark" : ""}`}>
      <AgentSidebar partnerLogo={<span className="text-sm font-medium">Invoice Processor</span>}>
        <SetupChecklist agentOnline={agentOnline} />
        <SidebarSection label="Try">
          <SidebarPromptButton onClick={() => sendWithContext("Extract this invoice.")}>
            Extract this invoice
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Match it against the PO database.")}>
            Match the PO
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("Approve and push to QuickBooks.")}>
            Approve &amp; push (QB)
          </SidebarPromptButton>
          <SidebarPromptButton onClick={() => sendWithContext("What's the discrepancy vs the PO here?")}>
            Explain discrepancy
          </SidebarPromptButton>
        </SidebarSection>
      </AgentSidebar>

      <main className="flex-1 min-w-0 grid grid-cols-1 xs:grid-cols-[minmax(0,1fr)_minmax(0,380px)] overflow-hidden">
        <section className="overflow-y-auto border-r border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 p-4 space-y-4">
          <div className="flex gap-2">
            {SAMPLE_INVOICES.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => switchInvoice(inv.id)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  inv.id === invoiceId
                    ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                    : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-700"
                }`}
              >
                {inv.id}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InvoicePreview invoice={invoice} />

            <div className="space-y-3">
              {banner && (
                <div className={`rounded-md border px-3 py-2 text-xs ${bannerClass}`}>{banner.text}</div>
              )}

              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500 mb-2">
                  Extracted fields
                </p>
                {!extracted && <p className="text-xs text-neutral-400">Ask the agent to extract.</p>}
                {extracted && (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <dt className="text-neutral-500">Vendor</dt>
                    <dd className="text-neutral-900 dark:text-neutral-100">{extracted.vendor}</dd>
                    <dt className="text-neutral-500">Amount</dt>
                    <dd className="font-mono text-neutral-900 dark:text-neutral-100">
                      {extracted.amount.toFixed(2)} {extracted.currency}
                    </dd>
                    <dt className="text-neutral-500">Date</dt>
                    <dd className="font-mono text-neutral-900 dark:text-neutral-100">{extracted.invoiceDate}</dd>
                    <dt className="text-neutral-500">PO #</dt>
                    <dd className="font-mono text-neutral-900 dark:text-neutral-100">
                      {extracted.poNumber ?? <span className="text-neutral-400">—</span>}
                    </dd>
                    {typeof extracted.vatAmount === "number" && extracted.vatAmount > 0 && (
                      <>
                        <dt className="text-neutral-500">VAT</dt>
                        <dd className="font-mono text-neutral-900 dark:text-neutral-100">
                          {extracted.vatAmount.toFixed(2)} ({(extracted.vatRate ?? 0) * 100}%)
                        </dd>
                      </>
                    )}
                    <dt className="text-neutral-500 col-span-2 mt-2">Line items</dt>
                    <dd className="col-span-2">
                      <ul className="space-y-0.5 font-mono text-[11px]">
                        {extracted.lineItems.map((li, i) => (
                          <li key={i} className="flex justify-between">
                            <span className="text-neutral-700 dark:text-neutral-300">
                              {li.qty} × {li.description}
                            </span>
                            <span className="text-neutral-900 dark:text-neutral-100">{li.total.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </dl>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => sendWithContext("I have a question about these extracted fields — ")}
                  className="flex-1 rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-700"
                >
                  Request changes
                </button>
                <button
                  type="button"
                  disabled={!extracted || !match || pushed?.success}
                  onClick={() => sendWithContext("Approve and push to QuickBooks.")}
                  className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {pushed?.success ? "Pushed ✓" : "Approve & push"}
                </button>
              </div>

              {pushed?.success && (
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
                  Pushed to {pushed.system} at {new Date(pushed.pushedAt).toLocaleTimeString()}.
                </div>
              )}
            </div>
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
        let sbId = localStorage.getItem("invoice_sandbox_id")
        if (!sbId) {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem("invoice_sandbox_id", sbId!)
        }
        setSandboxId(sbId)

        let thId = localStorage.getItem("invoice_thread_id")
        if (!thId) {
          const thRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
          })
          if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
          const data = await thRes.json()
          thId = data.id
          localStorage.setItem("invoice_thread_id", thId!)
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

  return <InvoiceAgent sandboxId={sandboxId} threadId={threadId} colorMode={colorMode} />
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
