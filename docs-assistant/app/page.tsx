"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { createAgentChat, AgentChat } from "@21st-sdk/nextjs"
import { useSearchParams } from "next/navigation"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import "@21st-sdk/react/styles.css"

function DocsChat() {
  const searchParams = useSearchParams()
  const themeParam = searchParams.get("theme")
  const sidebarParam = searchParams.get("sidebar")
  const [colorMode, setColorMode] = useState<"light" | "dark">("dark")

  useEffect(() => {
    if (themeParam === "light") {
      setColorMode("light")
      return
    }
    if (themeParam === "dark") {
      setColorMode("dark")
      return
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setColorMode(mq.matches ? "dark" : "light")
    const handler = (e: MediaQueryListEvent) =>
      setColorMode(e.matches ? "dark" : "light")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [themeParam])

  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "docs-assistant",
        tokenUrl: "/api/agent/token",
      }),
    [],
  )

  const { messages, sendMessage, status, stop, error } = useChat({
    chat: chat as Chat<UIMessage>,
  })

  const themeClass = colorMode === "dark" ? "dark" : ""

  return (
    <div
      className={`flex h-screen bg-background text-foreground ${themeClass}`}
    >
      <main className="flex flex-1 min-w-0 bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="flex-1 h-full">
          <AgentChat
            messages={messages}
            onSend={(msg) => sendMessage({ text: msg.content })}
            status={status}
            onStop={stop}
            error={error ?? undefined}
            colorMode={colorMode}
          />
        </div>
      </main>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="h-screen flex items-center justify-center">
          Loading...
        </main>
      }
    >
      <DocsChat />
    </Suspense>
  )
}
