"use client"

import { AgentChat, createAgentChat } from "@21st-sdk/nextjs"
import "@21st-sdk/react/styles.css"
import type { Chat } from "@ai-sdk/react"
import { useChat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  BrowserUseExtractRenderer,
  SubmitExtractionRenderer,
} from "./components/extraction-tool-renderers"
import { ThreadSidebar } from "./components/thread-sidebar"
import type { ThreadItem } from "./types"

const AGENT_SLUG = "web-scraper"

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `web-scraper:messages:${sandboxId}:${threadId}`
}

function ChatPanel({
  sandboxId,
  threadId,
  isActive,
}: {
  sandboxId: string
  threadId: string
  isActive: boolean
}) {
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
  const searchParams = useSearchParams()
  const didHydrateRef = useRef(false)
  const storageKey = getMessagesStorageKey(sandboxId, threadId)
  const colorMode =
    searchParams.get("theme") === "dark"
      ? "dark"
      : searchParams.get("theme") === "light"
        ? "light"
        : "auto"

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
        toolRenderers={{
          browser_use_extract: BrowserUseExtractRenderer,
          submit_extraction: SubmitExtractionRenderer,
        }}
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
  const themeClass = searchParams.get("theme") === "light" ? "" : "dark"

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      try {
        async function createFreshSandbox() {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          const freshSandboxId = data.sandboxId as string
          localStorage.setItem("agent_sandbox_id", freshSandboxId)
          return freshSandboxId
        }

        let sbId = localStorage.getItem("agent_sandbox_id")
        if (!sbId) {
          sbId = await createFreshSandbox()
        }

        let threadsRes = await fetch(`/api/agent/threads?sandboxId=${sbId}`)
        if (!threadsRes.ok) {
          // Common recovery path after redeploys or stale sandbox/thread ids.
          localStorage.removeItem("agent_thread_id")
          sbId = await createFreshSandbox()
          threadsRes = await fetch(`/api/agent/threads?sandboxId=${sbId}`)
          if (!threadsRes.ok) {
            throw new Error(`Failed to fetch threads: ${threadsRes.status}`)
          }
        }

        setSandboxId(sbId)
        const existingThreads: ThreadItem[] = await threadsRes.json()
        const savedThreadId = localStorage.getItem("agent_thread_id")

        if (existingThreads.length > 0) {
          setThreads(existingThreads)
          const selected = existingThreads.find((t) => t.id === savedThreadId)
            ? savedThreadId!
            : existingThreads[0]!.id
          setActiveThreadId(selected)
          localStorage.setItem("agent_thread_id", selected)
        } else {
          const newRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Scraping Thread 1" }),
          })
          if (!newRes.ok) throw new Error(`Failed to create thread: ${newRes.status}`)
          const newThread: ThreadItem = await newRes.json()
          setThreads([newThread])
          setActiveThreadId(newThread.id)
          localStorage.setItem("agent_thread_id", newThread.id)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to initialize")
      }
    }

    init()
  }, [])

  const handleNewThread = useCallback(async () => {
    if (!sandboxId) return
    const name = `Scraping Thread ${threads.length + 1}`
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
    <main className={`h-screen flex bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 ${themeClass}`}>
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
  )
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
