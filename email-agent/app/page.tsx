"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { AgentChat, createAgentChat } from "@21st-sdk/nextjs"
import { useSearchParams } from "next/navigation"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import "@21st-sdk/react/styles.css"

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `email-agent:messages:${sandboxId}:${threadId}`
}

function ChatPanel({
  sandboxId,
  threadId,
}: {
  sandboxId: string
  threadId: string
}) {
  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "email-agent",
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
  const themeClass = colorMode === "light" ? "" : "dark"

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

  const starterPrompts = useMemo(
    () => [
      "Send intro email to founder@acme.com about our AI QA tool.",
      "Check the latest 5 inbox messages and summarize replies.",
      "Auto-reply to the latest inbound with a friendly meeting follow-up.",
    ],
    [],
  )

  return (
    <main className={`h-screen min-h-0 grid grid-cols-[340px_minmax(0,1fr)] bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100 ${themeClass}`}>
      <aside className="min-h-0 p-4 overflow-y-auto border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <h1 className="text-lg font-semibold">Email Agent Boilerplate</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Hackathon template for outbound + inbox workflows with 21st SDK + AgentMail.
        </p>

        <section className="mt-6 space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-neutral-500">Quick prompts</h2>
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage({ text: prompt })}
              className="w-full text-left rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
            >
              {prompt}
            </button>
          ))}
        </section>

        <section className="mt-6 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-xs uppercase tracking-wide text-neutral-500">Capabilities</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
            <li>- Draft and send intro emails</li>
            <li>- Read recent inbox messages</li>
            <li>- Auto-reply to inbound threads</li>
          </ul>
        </section>
      </aside>

      <section
        className={`min-h-0 overflow-hidden${
          colorMode === "dark" ? " dark" : ""
        }`}
      >
        <AgentChat
          messages={messages}
          onSend={(msg) => sendMessage({ text: msg.content })}
          status={status}
          onStop={stop}
          error={error ?? undefined}
          className="h-full min-h-0"
        />
      </section>
    </main>
  )
}

export default function Home() {
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      try {
        let sbId = localStorage.getItem("agent_sandbox_id")

        if (!sbId) {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem("agent_sandbox_id", sbId!)
        }

        setSandboxId(sbId)

        let thId = localStorage.getItem("agent_thread_id")

        if (!thId) {
          const thRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
          })
          if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
          const data = await thRes.json()
          thId = data.id
          localStorage.setItem("agent_thread_id", thId!)
        }

        setThreadId(thId)
      } catch (err) {
        console.error("[client] Init failed:", err)
        setError(err instanceof Error ? err.message : "Failed to initialize")
      }
    }

    init()
  }, [])

  if (error) {
    return (
      <main className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
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

  if (!sandboxId || !threadId) {
    return (
      <main className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-500">
        Loading...
      </main>
    )
  }

  return <ChatPanel sandboxId={sandboxId} threadId={threadId} />
}
