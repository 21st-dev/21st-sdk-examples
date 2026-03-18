"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { createAgentChat, AgentChat } from "@21st-sdk/nextjs"
import { useSearchParams } from "next/navigation"
import type { CustomToolRendererProps } from "@21st-sdk/react"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import type { ThreadItem } from "./types"
import { ThreadSidebar } from "./components/thread-sidebar"
import "@21st-sdk/react/styles.css"

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `nextjs-chat:messages:${sandboxId}:${threadId}`
}

function TestToolRenderer({ name, status, output }: CustomToolRendererProps) {
  return (
    <div style={{ padding: "8px 12px", background: "#1a1a2e", borderRadius: 8, fontSize: 13 }}>
      <div style={{ color: "#f59e0b", fontWeight: "bold", marginBottom: 4 }}>IT'S A TESTING TOOL</div>
      <strong>Custom Tool: {name}</strong>
      {status === "pending" && <span style={{ marginLeft: 8, color: "#facc15" }}>Running...</span>}
      {status === "success" && (
        <span style={{ marginLeft: 8, color: "#4ade80" }}>
          Result: {typeof output === "string" ? output : JSON.stringify(output)}
        </span>
      )}
      {status === "error" && <span style={{ marginLeft: 8, color: "#f87171" }}>Error</span>}
    </div>
  )
}

function ChatPanel({
  sandboxId,
  threadId,
  colorMode,
  isActive,
}: {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
  isActive: boolean
}) {
  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "my-agent",
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

  return (
    <div
      className={`${isActive ? "" : "hidden "}h-full${
        colorMode === "dark" ? " dark" : ""
      }`}
    >
      <AgentChat
        messages={messages}
        onSend={(msg) => sendMessage({ text: msg.content })}
        status={status}
        onStop={stop}
        error={error ?? undefined}
        colorMode={colorMode}
        toolRenderers={{ test: TestToolRenderer }}
      />
    </div>
  )
}

function HomeContent() {
  const searchParams = useSearchParams()
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)
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

  const themeClass = colorMode === "dark" ? "dark" : ""

  // Initialize: create sandbox, fetch threads, select or create first thread
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      try {
        console.log("[client] Initializing...")

        let sbId = localStorage.getItem("agent_sandbox_id")

        if (sbId) {
          console.log(`[client] Found sandboxId in localStorage: ${sbId}`)
        } else {
          console.log("[client] No sandboxId found, creating new sandbox...")
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          console.log(`[client] Got sandboxId: ${sbId}`)
          localStorage.setItem("agent_sandbox_id", sbId!)
        }

        setSandboxId(sbId)

        const threadsRes = await fetch(`/api/agent/threads?sandboxId=${sbId}`)
        if (!threadsRes.ok) throw new Error(`Failed to fetch threads: ${threadsRes.status}`)
        const existingThreads: ThreadItem[] = await threadsRes.json()
        console.log(`[client] Fetched ${existingThreads.length} existing threads:`, existingThreads)

        const savedThreadId = localStorage.getItem("agent_thread_id")

        if (existingThreads.length > 0) {
          setThreads(existingThreads)
          const threadId = existingThreads.find((t) => t.id === savedThreadId)
            ? savedThreadId!
            : existingThreads[0]!.id
          setActiveThreadId(threadId)
          localStorage.setItem("agent_thread_id", threadId)
        } else {
          console.log("[client] No existing threads, creating first one...")
          const newRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Thread 1" }),
          })
          if (!newRes.ok) throw new Error(`Failed to create thread: ${newRes.status}`)
          const newThread: ThreadItem = await newRes.json()
          console.log(`[client] Created thread: ${newThread.id}`)
          setThreads([newThread])
          setActiveThreadId(newThread.id)
          localStorage.setItem("agent_thread_id", newThread.id)
        }
      } catch (err) {
        console.error("[client] Init failed:", err)
        setError(err instanceof Error ? err.message : "Failed to initialize")
      }
    }

    init()
  }, [])

  const handleNewThread = useCallback(async () => {
    if (!sandboxId) return
    const name = `Thread ${threads.length + 1}`
    try {
      const res = await fetch("/api/agent/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, name }),
      })
      if (!res.ok) throw new Error(`Failed to create thread: ${res.status}`)
      const thread: ThreadItem = await res.json()
      setThreads((prev) => [thread, ...prev])
      setActiveThreadId(thread.id)
      localStorage.setItem("agent_thread_id", thread.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create thread")
    }
  }, [sandboxId, threads.length])

  const handleSelectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    localStorage.setItem("agent_thread_id", threadId)
  }, [])

  if (error) {
    return (
      <main className="h-screen flex items-center justify-center">
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

  return (
    <div className={`flex flex-col xs:flex-row h-screen bg-background text-foreground ${themeClass}`}>
      <main className="flex flex-1 min-w-0 bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
      />
      <div className="flex-1">
        {sandboxId && activeThreadId ? (
          threads.map((thread) => (
            <ChatPanel
              key={thread.id}
              sandboxId={sandboxId}
              threadId={thread.id}
              colorMode={colorMode}
              isActive={thread.id === activeThreadId}
            />
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-500">
            Loading...
          </div>
        )}
      </div>
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
