"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useChat } from "@ai-sdk/react"
import { createAgentChat, AgentChat } from "@21st-sdk/nextjs"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { NOTION_AGENT_NAME } from "./constants"
import type { ChatSession } from "./types"
import { ThreadSidebar } from "./components/thread-sidebar"
import "@21st-sdk/react/styles.css"

const NOTION_KEY_STORAGE_KEY = `${NOTION_AGENT_NAME}:notion-api-key`
const SESSIONS_STORAGE_KEY = `${NOTION_AGENT_NAME}:sessions`
const ACTIVE_SESSION_STORAGE_KEY = `${NOTION_AGENT_NAME}:active-session`

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `${NOTION_AGENT_NAME}:messages:${sandboxId}:${threadId}`
}

// ---------------------------------------------------------------------------
// IntegrationKeyPicker
// ---------------------------------------------------------------------------

function IntegrationKeyPicker({
  keyInput,
  onKeyInputChange,
  onSubmit,
  error,
  isConnecting,
}: {
  keyInput: string
  onKeyInputChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  error: string | null
  isConnecting: boolean
}) {
  return (
    <div className="w-full max-w-lg px-4">
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-[hsl(var(--border)/0.8)] bg-[hsl(var(--background))] p-4 shadow-sm"
      >
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[hsl(var(--muted-foreground))]">
            Connect
          </p>
          <h1 className="text-lg font-medium text-[hsl(var(--foreground))]">
            Notion Workspace
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Enter your Notion integration key to start chatting with your workspace.
          </p>
        </div>
        <div className="space-y-3">
          <input
            type="password"
            value={keyInput}
            onChange={(event) => onKeyInputChange(event.target.value)}
            placeholder="ntn_..."
            className="an-focus-input h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.7)]"
          />
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={isConnecting}
            className="an-focus-btn h-8 w-full rounded-lg bg-[hsl(var(--foreground))] px-3 text-sm font-medium text-[hsl(var(--background))] disabled:cursor-default disabled:opacity-50 hover:opacity-95 active:scale-[0.97]"
          >
            {isConnecting ? "Connecting..." : "Connect & Start Chat"}
          </button>
        </div>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------
// InitialLoader
// ---------------------------------------------------------------------------

function InitialLoader() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-sm text-[hsl(var(--muted-foreground))]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[hsl(var(--border))] border-t-[hsl(var(--foreground))]" />
        <p>Loading chats...</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MenuIcon
// ---------------------------------------------------------------------------

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M2.75 4.25h10.5" />
      <path d="M2.75 8h10.5" />
      <path d="M2.75 11.75h10.5" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// ChatPanel
// ---------------------------------------------------------------------------

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
        agent: NOTION_AGENT_NAME,
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
      className={`h-full min-h-0 min-w-0 w-full overflow-hidden${
        colorMode === "dark" ? " dark" : ""
      }`}
    >
      <AgentChat
        messages={messages}
        onSend={(msg) => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
          sendMessage({ text: msg.content })
        }}
        status={status}
        onStop={stop}
        error={error ?? undefined}
        className="h-full min-h-0 w-full"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// HomeContent
// ---------------------------------------------------------------------------

function HomeContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [keyInput, setKeyInput] = useState("")
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isStorageReady, setIsStorageReady] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentTheme = searchParams.get("theme") === "light" ? "light" : "dark"
  const themeClass = currentTheme === "light" ? "" : "dark"
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  )

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const storedKey = localStorage.getItem(NOTION_KEY_STORAGE_KEY)
      const storedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY)
      const storedActiveSessionId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)

      if (storedKey) {
        setKeyInput(storedKey)
      }

      if (storedSessions) {
        const parsedSessions = JSON.parse(storedSessions) as ChatSession[]
        setSessions(parsedSessions)

        if (storedActiveSessionId && parsedSessions.some((session) => session.id === storedActiveSessionId)) {
          setActiveSessionId(storedActiveSessionId)
        } else if (parsedSessions[0]) {
          setActiveSessionId(parsedSessions[0].id)
        }
      }
    } catch {}

    setIsStorageReady(true)
  }, [])

  // Close sidebar when no sessions
  useEffect(() => {
    if (sessions.length === 0) {
      setIsSidebarOpen(false)
    }
  }, [sessions.length])

  // Persist sessions and active session
  useEffect(() => {
    if (!isStorageReady) return

    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions))

      if (activeSessionId) {
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId)
      } else {
        localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
      }
    } catch {}
  }, [activeSessionId, sessions, isStorageReady])

  const handleNewThread = useCallback(() => {
    setError(null)
    setActiveSessionId(null)
    setIsSidebarOpen(false)

    // Pre-fill with saved key
    try {
      const storedKey = localStorage.getItem(NOTION_KEY_STORAGE_KEY)
      setKeyInput(storedKey ?? "")
    } catch {
      setKeyInput("")
    }
  }, [])

  const handleSelectThread = useCallback((threadId: string) => {
    setError(null)
    setActiveSessionId(threadId)
    setIsSidebarOpen(false)
  }, [])

  const handleDeleteThread = useCallback((threadId: string) => {
    const session = sessions.find((item) => item.id === threadId)
    if (!session) return

    setError(null)

    try {
      localStorage.removeItem(
        getMessagesStorageKey(session.sandboxId, session.threadId),
      )
    } catch {}

    const nextSessions = sessions.filter((item) => item.id !== threadId)
    setSessions(nextSessions)

    if (activeSessionId === threadId) {
      setActiveSessionId(nextSessions[0]?.id ?? null)
    }

    if (nextSessions.length === 0) {
      setIsSidebarOpen(false)
    }
  }, [activeSessionId, sessions])

  const handleToggleTheme = useCallback(() => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark"
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set("theme", nextTheme)
    router.replace(`${pathname}?${nextParams.toString()}`)
  }, [currentTheme, pathname, router, searchParams])

  const handleConnect = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const notionApiKey = keyInput.trim()
      if (!notionApiKey) {
        setError("Integration key is required")
        return
      }

      setIsConnecting(true)
      setError(null)

      try {
        // Save key to localStorage
        localStorage.setItem(NOTION_KEY_STORAGE_KEY, notionApiKey)

        const sandboxRes = await fetch("/api/agent/sandbox", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notionApiKey }),
        })
        const sandboxData = (await sandboxRes.json()) as {
          sandboxId?: string
          threadId?: string
          createdAt?: string
          error?: string
        }
        if (!sandboxRes.ok || !sandboxData.sandboxId || !sandboxData.threadId) {
          throw new Error(sandboxData.error ?? "Failed to create chat session")
        }

        const session: ChatSession = {
          id: `${sandboxData.sandboxId}:${sandboxData.threadId}`,
          name: "Notion Chat",
          sandboxId: sandboxData.sandboxId,
          threadId: sandboxData.threadId,
          createdAt: sandboxData.createdAt ?? new Date().toISOString(),
        }

        const nextSessions = [session, ...sessions]
        setSessions(nextSessions)
        setActiveSessionId(session.id)
        setIsSidebarOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect")
      } finally {
        setIsConnecting(false)
      }
    },
    [keyInput, sessions],
  )

  if (!isStorageReady) {
    return (
      <div className={themeClass}>
        <main className="flex h-[100svh] max-h-[100svh] w-full min-h-0 max-w-full overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
          <InitialLoader />
        </main>
      </div>
    )
  }

  return (
    <div className={themeClass}>
      <main className="flex h-[100svh] max-h-[100svh] w-full min-h-0 max-w-full overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
        {sessions.length > 0 ? (
          <>
            <ThreadSidebar
              threads={sessions}
              activeThreadId={activeSessionId}
              currentTheme={currentTheme}
              onSelectThread={handleSelectThread}
              onNewThread={handleNewThread}
              onDeleteThread={handleDeleteThread}
              onToggleTheme={handleToggleTheme}
              className="hidden shrink-0 md:flex"
            />
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[hsl(var(--background))]">
              <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] px-3 py-2 md:hidden">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="an-focus-btn flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--foreground))] hover:bg-[hsl(var(--foreground)/0.08)] active:scale-[0.97]"
                  aria-label="Open threads"
                >
                  <MenuIcon className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {activeSession?.name ?? "New Thread"}
                  </p>
                </div>
                <button
                  onClick={handleNewThread}
                  className="an-focus-btn flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--foreground))] hover:bg-[hsl(var(--foreground)/0.08)] active:scale-[0.97]"
                  aria-label="New thread"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M8 3.25v9.5" />
                    <path d="M3.25 8h9.5" />
                  </svg>
                </button>
              </div>
              {error && activeSession ? (
                <div className="border-b border-[hsl(var(--border))] px-4 py-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              ) : null}
              <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`h-full min-h-0 min-w-0 w-full overflow-hidden ${
                      session.id === activeSessionId ? "block" : "hidden"
                    }`}
                    aria-hidden={session.id === activeSessionId ? undefined : true}
                  >
                    <ChatPanel
                      sandboxId={session.sandboxId}
                      threadId={session.threadId}
                    />
                  </div>
                ))}
                {!activeSession ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[hsl(var(--muted)/0.35)] p-6">
                    <IntegrationKeyPicker
                      keyInput={keyInput}
                      onKeyInputChange={setKeyInput}
                      onSubmit={handleConnect}
                      error={error}
                      isConnecting={isConnecting}
                    />
                  </div>
                ) : null}
              </div>
            </div>
            {isSidebarOpen ? (
              <div className="fixed inset-0 z-40 md:hidden">
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="absolute inset-0 bg-black/45"
                  aria-label="Close threads"
                />
                <div className="absolute inset-y-0 left-0 w-full max-w-[18rem]">
                  <ThreadSidebar
                    threads={sessions}
                    activeThreadId={activeSessionId}
                    currentTheme={currentTheme}
                    onSelectThread={handleSelectThread}
                    onNewThread={handleNewThread}
                    onDeleteThread={handleDeleteThread}
                    onToggleTheme={handleToggleTheme}
                    className="relative z-10 h-full shadow-2xl"
                    showHeader={false}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[hsl(var(--muted)/0.35)] p-6">
            <IntegrationKeyPicker
              keyInput={keyInput}
              onKeyInputChange={setKeyInput}
              onSubmit={handleConnect}
              error={error}
              isConnecting={isConnecting}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex h-[100svh] max-h-[100svh] w-full items-center justify-center overflow-hidden bg-[hsl(240_10%_3.9%)] text-[hsl(240_4.8%_95.9%)]">
          Loading...
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  )
}
