"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { createAnChat, AnAgentChat } from "@21st-sdk/nextjs"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import type { ThreadItem } from "./types"
import { ThreadSidebar } from "./components/thread-sidebar"
import {
  BrowserUseExtractRenderer,
  SubmitExtractionRenderer,
} from "./components/extraction-tool-renderers"
import "@21st-sdk/react/styles.css"

const AGENT_SLUG = process.env.NEXT_PUBLIC_AN_AGENT_SLUG || "web-scraper"

function ChatPanel({ chat }: { chat: Chat<UIMessage> }) {
  const { messages, sendMessage, status, stop, error } = useChat({ chat })

  return (
    <AnAgentChat
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
  )
}

export default function Home() {
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  const chat = useMemo(() => {
    if (!sandboxId || !activeThreadId) return null
    return createAnChat({
      agent: AGENT_SLUG,
      tokenUrl: "/api/an/token",
      sandboxId,
      threadId: activeThreadId,
    })
  }, [sandboxId, activeThreadId])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      try {
        async function createFreshSandbox() {
          const sbRes = await fetch("/api/an/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          const freshSandboxId = data.sandboxId as string
          localStorage.setItem("an_sandbox_id", freshSandboxId)
          return freshSandboxId
        }

        let sbId = localStorage.getItem("an_sandbox_id")
        if (!sbId) {
          sbId = await createFreshSandbox()
        }

        let threadsRes = await fetch(`/api/an/threads?sandboxId=${sbId}`)
        if (!threadsRes.ok) {
          // Common recovery path after redeploys or stale sandbox/thread ids.
          localStorage.removeItem("an_thread_id")
          sbId = await createFreshSandbox()
          threadsRes = await fetch(`/api/an/threads?sandboxId=${sbId}`)
          if (!threadsRes.ok) {
            throw new Error(`Failed to fetch threads: ${threadsRes.status}`)
          }
        }

        setSandboxId(sbId)
        const existingThreads: ThreadItem[] = await threadsRes.json()
        const savedThreadId = localStorage.getItem("an_thread_id")

        if (existingThreads.length > 0) {
          setThreads(existingThreads)
          const selected = existingThreads.find((t) => t.id === savedThreadId)
            ? savedThreadId!
            : existingThreads[0]!.id
          setActiveThreadId(selected)
          localStorage.setItem("an_thread_id", selected)
        } else {
          const newRes = await fetch("/api/an/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Scraping Thread 1" }),
          })
          if (!newRes.ok) throw new Error(`Failed to create thread: ${newRes.status}`)
          const newThread: ThreadItem = await newRes.json()
          setThreads([newThread])
          setActiveThreadId(newThread.id)
          localStorage.setItem("an_thread_id", newThread.id)
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
      const res = await fetch("/api/an/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, name }),
      })
      if (!res.ok) throw new Error(`Failed to create thread: ${res.status}`)
      const thread: ThreadItem = await res.json()
      setThreads((prev) => [thread, ...prev])
      setActiveThreadId(thread.id)
      localStorage.setItem("an_thread_id", thread.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create thread")
    }
  }, [sandboxId, threads.length])

  const handleSelectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    localStorage.setItem("an_thread_id", threadId)
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
    <main className="h-screen flex">
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
      />
      <div className="flex-1">
        {chat ? (
          <ChatPanel key={activeThreadId} chat={chat} />
        ) : (
          <div className="flex items-center justify-center h-full text-neutral-500">
            Loading...
          </div>
        )}
      </div>
    </main>
  )
}
