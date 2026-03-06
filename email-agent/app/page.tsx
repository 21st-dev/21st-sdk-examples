"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { AnAgentChat, createAnChat } from "@21st-sdk/nextjs"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import "@21st-sdk/react/styles.css"

function ChatPanel({ chat }: { chat: Chat<UIMessage> }) {
  const { messages, sendMessage, status, stop, error } = useChat({ chat })
  const starterPrompts = useMemo(
    () => [
      "Send intro email to founder@acme.com about our AI QA tool.",
      "Check the latest 5 inbox messages and summarize replies.",
      "Auto-reply to the latest inbound with a friendly meeting follow-up.",
    ],
    [],
  )

  return (
    <main className="h-screen grid grid-cols-[340px_minmax(0,1fr)] bg-neutral-950 text-neutral-100">
      <aside className="border-r border-neutral-800 p-4 overflow-y-auto">
        <h1 className="text-lg font-semibold">Email Agent Boilerplate</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Hackathon template for outbound + inbox workflows with 21st SDK + AgentMail.
        </p>

        <section className="mt-6 space-y-2">
          <h2 className="text-xs uppercase tracking-wide text-neutral-500">Quick prompts</h2>
          {starterPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendMessage({ text: prompt })}
              className="w-full text-left rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm hover:border-neutral-700"
            >
              {prompt}
            </button>
          ))}
        </section>

        <section className="mt-6 rounded-md border border-neutral-800 bg-neutral-900 p-3">
          <h2 className="text-xs uppercase tracking-wide text-neutral-500">Capabilities</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            <li>- Draft and send intro emails</li>
            <li>- Read recent inbox messages</li>
            <li>- Auto-reply to inbound threads</li>
          </ul>
        </section>
      </aside>

      <AnAgentChat
        messages={messages}
        onSend={(msg) => sendMessage({ text: msg.content })}
        status={status}
        onStop={stop}
        error={error ?? undefined}
        colorMode="dark"
        className="h-full"
      />
    </main>
  )
}

export default function Home() {
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  const chat = useMemo(() => {
    if (!sandboxId || !threadId) return null
    return createAnChat({
      agent: "email-agent",
      tokenUrl: "/api/an/token",
      sandboxId,
      threadId,
    })
  }, [sandboxId, threadId])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      try {
        let sbId = localStorage.getItem("an_sandbox_id")

        if (!sbId) {
          const sbRes = await fetch("/api/an/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem("an_sandbox_id", sbId!)
        }

        setSandboxId(sbId)

        let thId = localStorage.getItem("an_thread_id")

        if (!thId) {
          const thRes = await fetch("/api/an/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
          })
          if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
          const data = await thRes.json()
          thId = data.id
          localStorage.setItem("an_thread_id", thId!)
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

  if (!chat) {
    return (
      <main className="h-screen flex items-center justify-center bg-neutral-950 text-neutral-500">
        Loading...
      </main>
    )
  }

  return <ChatPanel chat={chat} />
}
