"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { createAgentChat, AgentChat } from "@21st-sdk/nextjs"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import type { ThreadItem } from "./types"
import { ThreadSidebar } from "./components/thread-sidebar"
import {
  SaveNoteRenderer,
  SearchNotesRenderer,
  ListNotesRenderer,
  UpdateNoteRenderer,
  DeleteNoteRenderer,
  TagFilterRenderer,
} from "./components/note-tool-renderers"
import "@21st-sdk/react/styles.css"

const SANDBOX_STORAGE_KEY = "agent_sandbox_id_v2"
const THREAD_STORAGE_KEY = "agent_thread_id_v2"

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `note-taker:messages:${sandboxId}:${threadId}`
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
        agent: "note-taker",
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
    <div className={isActive ? "h-full" : "hidden h-full"}>
      <AgentChat
        messages={messages}
        onSend={(msg) => sendMessage({ text: msg.content })}
        status={status}
        onStop={stop}
        error={error ?? undefined}
        toolRenderers={{
          save_note: SaveNoteRenderer,
          search_notes: SearchNotesRenderer,
          list_notes: ListNotesRenderer,
          get_notes_by_tag: TagFilterRenderer,
          update_note: UpdateNoteRenderer,
          delete_note: DeleteNoteRenderer,
        }}
      />
    </div>
  )
}

export default function Home() {
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ThreadItem[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [sidebarView, setSidebarView] = useState<"threads" | "notes">("notes")
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      try {
        let sbId = localStorage.getItem(SANDBOX_STORAGE_KEY)

        if (!sbId) {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem(SANDBOX_STORAGE_KEY, sbId!)
        }

        setSandboxId(sbId)

        const threadsRes = await fetch(`/api/agent/threads?sandboxId=${sbId}`)
        if (!threadsRes.ok) throw new Error(`Failed to fetch threads: ${threadsRes.status}`)
        const existingThreads: ThreadItem[] = await threadsRes.json()

        const savedThreadId = localStorage.getItem(THREAD_STORAGE_KEY)

        if (existingThreads.length > 0) {
          setThreads(existingThreads)
          const threadId = existingThreads.find((t) => t.id === savedThreadId)
            ? savedThreadId!
            : existingThreads[0]!.id
          setActiveThreadId(threadId)
          localStorage.setItem(THREAD_STORAGE_KEY, threadId)
        } else {
          const newRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Notebook" }),
          })
          if (!newRes.ok) throw new Error(`Failed to create thread: ${newRes.status}`)
          const newThread: ThreadItem = await newRes.json()
          setThreads([newThread])
          setActiveThreadId(newThread.id)
          localStorage.setItem(THREAD_STORAGE_KEY, newThread.id)
        }
      } catch (err) {
        console.error("[note-taker] Init failed:", err)
        setError(err instanceof Error ? err.message : "Failed to initialize")
      }
    }

    init()
  }, [])

  const handleNewThread = useCallback(async () => {
    if (!sandboxId) return
    const name = `Notebook ${threads.length + 1}`
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
      localStorage.setItem(THREAD_STORAGE_KEY, thread.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create thread")
    }
  }, [sandboxId, threads.length])

  const handleSelectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    localStorage.setItem(THREAD_STORAGE_KEY, threadId)
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
        view={sidebarView}
        onViewChange={setSidebarView}
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
