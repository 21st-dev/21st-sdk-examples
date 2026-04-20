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
import { TweetCard, type Tweet } from "@/app/_components/tweet-card"
import {
  VoiceReference,
  sanitizeAuthorStyle,
  type AuthorStyle,
} from "@/app/_components/voice-reference"
import {
  CODE_THEMES,
  DEFAULT_CODE_THEME_ID,
  resolveCodeTheme,
} from "@/app/_components/code-themes"
import {
  DEFAULT_CODE_SETTINGS,
  type CodeSettings,
} from "@/app/_components/code-frame"
import { CodeSettingsControl } from "@/app/_components/code-settings"
import {
  asToolPart,
  extractJsonText,
  isToolPartNamed,
  stripSystemNotePrefix,
  SYSTEM_NOTE_PREFIX,
  SYSTEM_NOTE_SUFFIX,
} from "@/lib/tool-parts"
import { usePersistentState } from "@/app/_hooks/use-persistent-state"
import { useDismissible } from "@/app/_hooks/use-dismissible"

type Style = "punchy" | "thoughtful" | "meme"
const STYLES: Style[] = ["punchy", "thoughtful", "meme"]

// Rendered when no thread exists yet, so a first-time visitor immediately
// sees what the output looks like (text + code + video + link + file).
const PLACEHOLDER_TWEETS: Tweet[] = [
  {
    text: "built a background job library for TypeScript in a weekend.\n\nhere's what took me 5 years to figure out:",
  },
  {
    text: "the API is 5 lines:",
    codeBlock: {
      lang: "ts",
      filename: "relay.ts",
      code: `const sendEmail = relay.job('send-email', async (payload) => {
  await mailer.send(payload)
})

await sendEmail.enqueue({ to: 'ada@example.com' })`,
    },
  },
  {
    text: "4-minute walkthrough showing the whole flow from `npm install` to production:",
    attachment: {
      kind: "video",
      title: "Building Relay from scratch — a TypeScript background job library",
      domain: "youtube.com",
      duration: "4:32",
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    },
  },
  {
    text: "full architecture writeup, including the queue model and retry semantics:",
    attachment: {
      kind: "link",
      title: "How Relay handles 10M jobs/day on a single Postgres",
      description:
        "The queue is a table. The worker is a loop. Everything else is retries, cron, and priority.",
      domain: "relay.dev/blog",
    },
  },
  {
    text: "retries, cron, dead-letter queues — built in.\nno redis, no kafka, no brokers.\n\ntry it: npm i @relay/core",
  },
]

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `x-thread:messages:${sandboxId}:${threadId}`
}

const XLogo = () => (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

// Data-driven sidebar prompts. Each section is a { label, sections } block;
// each section is { heading, prompts: [{ label, prompt }] }. The runtime just
// .map()s them.
type SidebarPrompt = { label: string; prompt: string }
type SidebarPromptSection = { heading: string; prompts: SidebarPrompt[] }

const SIDEBAR_PROMPTS: SidebarPromptSection[] = [
  {
    heading: "Quick drafts",
    prompts: [
      {
        label: "My first SaaS lessons",
        prompt:
          "Write a thread about what I learned shipping my first SaaS. Make it concrete, 8 tweets.",
      },
      {
        label: "Prompting tips",
        prompt:
          "Write a thread sharing 5 non-obvious tips for prompting Claude in production.",
      },
      {
        label: "Thread from a paragraph",
        prompt:
          "Turn this into a thread: 'Fly.io isn't cheaper than AWS, it's faster to reason about. You get a deploy URL in 60 seconds, ports just work, regions are a CLI flag, and logs stream into your terminal. The win is cognitive load.'",
      },
    ],
  },
  {
    heading: "Dev launches (with code)",
    prompts: [
      {
        label: "Launch an OSS library",
        prompt:
          "Draft a launch thread for Relay — an open-source background job library for TypeScript. Include a codeBlock snippet on tweet 2 showing the 5-line API (lang: ts). Then one more codeBlock later showing cron scheduling (lang: ts). 8 tweets.",
      },
      {
        label: "TypeScript trick thread",
        prompt:
          "Write a thread showing 3 non-obvious TypeScript type tricks. Each trick: one hook tweet + one tweet with a codeBlock (lang: ts) showing the pattern. 7 tweets total.",
      },
      {
        label: "Launch a CLI tool",
        prompt:
          "Announce a new CLI tool: `npx 21st-sdk deploy`. One codeBlock on tweet 2 (lang: bash) with install + deploy commands; another codeBlock later (lang: ts) showing the agent definition. 8 tweets.",
      },
      {
        label: "Gnarly SQL pattern",
        prompt:
          "Build-in-public update: I found a gnarly SQL window-function pattern today. One codeBlock (lang: sql) showing the non-obvious query, then tweets explaining why it's fast. 6 tweets.",
      },
      {
        label: "Ship a React hook",
        prompt:
          "Draft a thread introducing a React hook: `useAgentChat`. Include a codeBlock (lang: tsx) on tweet 2 showing 6-line usage, and another codeBlock (lang: ts) showing the return type on tweet 4. 7 tweets.",
      },
      {
        label: "Python one-liner",
        prompt:
          "Write a thread about a one-line Python trick that replaces a 20-line loop. One codeBlock (lang: python) with the before/after. 6 tweets, sharp hook.",
      },
    ],
  },
  {
    heading: "Refine",
    prompts: [
      {
        label: "Tighten everything",
        prompt: "Tighten every tweet — cut anything that isn't concrete. Same structure.",
      },
      { label: "Stronger hook", prompt: "Rewrite tweet 1 — stronger hook, more specific." },
      {
        label: "Sharper CTA",
        prompt:
          "End the thread with a bold CTA to follow me for more builder-style threads.",
      },
      { label: "Shorten to 6", prompt: "Shorten to 6 tweets without losing the punchline." },
    ],
  },
]

function ThreadAgent({
  sandboxId,
  threadId,
  colorMode,
}: {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
}) {
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [style, setStyle] = useState<Style>("punchy")
  const [authorStyle, setAuthorStyle] = usePersistentState<AuthorStyle | null>(
    "x_thread_author_style",
    null,
    (raw) => sanitizeAuthorStyle(raw),
  )
  const [codeThemeId, setCodeThemeId] = usePersistentState<string>(
    "x_thread_code_theme",
    DEFAULT_CODE_THEME_ID,
    (raw) => (typeof raw === "string" ? raw : null),
  )
  const [codeSettings, setCodeSettings] = usePersistentState<CodeSettings>(
    "x_thread_code_settings",
    DEFAULT_CODE_SETTINGS,
    (raw) =>
      raw && typeof raw === "object"
        ? { ...DEFAULT_CODE_SETTINGS, ...(raw as Partial<CodeSettings>) }
        : null,
  )
  const [themeMenuOpen, setThemeMenuOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement | null>(null)
  useDismissible(themeMenuOpen, () => setThemeMenuOpen(false), themeMenuRef)
  const appliedToolCallIds = useRef<Set<string>>(new Set())
  const codeTheme = resolveCodeTheme(codeThemeId)

  function scrollSidebarToVoice() {
    document
      .getElementById("voice-reference")
      ?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "thread-agent",
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
          .filter((p) => !isToolPartNamed(p, "update_thread"))
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
        const tp = asToolPart(part, "update_thread")
        if (!tp || tp.preliminary) continue
        if (!tp.toolCallId || appliedToolCallIds.current.has(tp.toolCallId)) continue
        const payloadText = extractJsonText(tp.output ?? tp.result)
        if (!payloadText) continue
        try {
          const parsed = JSON.parse(payloadText) as { tweets?: Tweet[] }
          if (Array.isArray(parsed.tweets)) {
            const clean: Tweet[] = parsed.tweets
              .filter((t): t is Tweet => !!t && typeof t.text === "string")
              .map((t) => {
                const out: Tweet = { text: t.text }
                const cb = (t as Tweet).codeBlock
                if (
                  cb &&
                  typeof cb === "object" &&
                  typeof cb.lang === "string" &&
                  typeof cb.code === "string" &&
                  cb.code.trim().length > 0
                ) {
                  out.codeBlock = {
                    lang: cb.lang,
                    code: cb.code,
                    filename: typeof cb.filename === "string" ? cb.filename : undefined,
                  }
                }
                if (t.attachment && typeof t.attachment === "object") {
                  out.attachment = t.attachment
                }
                return out
              })
            if (clean.length > 0) {
              setTweets(clean)
              appliedToolCallIds.current.add(tp.toolCallId)
            }
          }
        } catch {}
      }
    }
  }, [messages])

  function buildSystemNote() {
    const parts = [
      `CURRENT_THREAD: ${JSON.stringify(tweets)}`,
      `STYLE: "${style}"`,
    ]
    if (authorStyle && authorStyle.active && authorStyle.samples.length >= 3) {
      // Re-sanitize samples in-place so any "]]]" inside can't close the note.
      const safeSamples = authorStyle.samples.map((s) => s.replace(/]]]/g, "]]_]"))
      const payload = JSON.stringify({
        handle: authorStyle.handle,
        samples: safeSamples,
      })
      parts.push(`AUTHOR_STYLE: ${payload}`)
    }
    return `${SYSTEM_NOTE_PREFIX} ${parts.join(" | ")} ${SYSTEM_NOTE_SUFFIX}`
  }

  function sendWithContext(text: string) {
    sendMessage({ text: `${buildSystemNote()}\n\n${text}` })
  }

  async function copyAll() {
    const text = tweets.map((t, i) => `${i + 1}/${tweets.length}\n${t.text}`).join("\n\n")
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }

  const agentOnline = !error && messages.length > 0

  return (
    <div className={`flex flex-col xs:flex-row h-screen bg-background text-foreground${colorMode === "dark" ? " dark" : ""}`}>
      <AgentSidebar partnerLogo={<span className="flex items-center gap-1.5 text-sm font-medium"><XLogo /> Thread generator</span>}>
        <SetupChecklist agentOnline={agentOnline} />

        <div id="voice-reference">
          <SidebarSection label="Voice reference">
            <VoiceReference style={authorStyle} onChange={setAuthorStyle} />
          </SidebarSection>
        </div>

        {SIDEBAR_PROMPTS.map((section) => (
          <SidebarSection key={section.heading} label={section.heading}>
            {section.prompts.map((p) => (
              <SidebarPromptButton key={p.label} onClick={() => sendWithContext(p.prompt)}>
                {p.label}
              </SidebarPromptButton>
            ))}
          </SidebarSection>
        ))}
      </AgentSidebar>

      <main className="flex-1 min-w-0 grid grid-cols-1 xs:grid-cols-[minmax(0,1fr)_minmax(0,380px)] overflow-hidden">
        <section className="flex flex-col min-h-0 border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950 overflow-hidden">
          <div className="shrink-0 flex items-center gap-3 border-b border-neutral-200 px-4 py-2 dark:border-neutral-800">
            <XLogo />
            <span className="text-[13px] font-medium text-neutral-800 dark:text-neutral-100">Thread preview</span>
            <span className="text-[11px] text-neutral-400">
              {tweets.length > 0 ? `${tweets.length} tweet${tweets.length === 1 ? "" : "s"}` : "empty"}
            </span>

            {authorStyle && authorStyle.active && authorStyle.samples.length >= 3 && (
              <button
                type="button"
                onClick={scrollSidebarToVoice}
                className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
                title="Voice reference is active"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                voice{authorStyle.handle ? `: @${authorStyle.handle}` : ""}
              </button>
            )}

            <div className="ml-auto flex items-center gap-1 rounded-md border border-neutral-200 p-0.5 dark:border-neutral-800">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`rounded px-2 py-0.5 text-[11px] capitalize transition-colors ${
                    style === s
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="relative" ref={themeMenuRef}>
              <button
                type="button"
                onClick={() => setThemeMenuOpen((v) => !v)}
                className="h-7 flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 text-[11px] text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
                title="Code theme"
              >
                <span
                  className="inline-block h-3 w-3 rounded-sm ring-1 ring-black/10 dark:ring-white/10"
                  style={{ background: codeTheme.frame }}
                />
                <span>{codeTheme.name}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {themeMenuOpen && (
                <div
                  className="absolute right-0 top-9 z-30 w-[220px] rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-950 p-1 max-h-[360px] overflow-auto"
                >
                  <div className="grid grid-cols-2 gap-1">
                    {CODE_THEMES.map((t) => {
                      const active = t.id === codeThemeId
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setCodeThemeId(t.id)
                            setThemeMenuOpen(false)
                          }}
                          className={`flex items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors ${
                            active
                              ? "bg-neutral-100 dark:bg-neutral-900"
                              : "hover:bg-neutral-100 dark:hover:bg-neutral-900"
                          }`}
                        >
                          <span
                            className="inline-block h-4 w-4 shrink-0 rounded ring-1 ring-black/10 dark:ring-white/10"
                            style={{ background: t.frame }}
                          />
                          <span className="flex-1 truncate text-neutral-800 dark:text-neutral-200">
                            {t.name}
                          </span>
                          {active && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <CodeSettingsControl value={codeSettings} onChange={setCodeSettings} />

            <button
              type="button"
              onClick={copyAll}
              disabled={tweets.length === 0}
              className="h-7 rounded-md border border-neutral-200 px-2.5 text-[11px] text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              Copy thread
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {tweets.length === 0 ? (
              <div className="relative mx-auto max-w-[640px] px-4 py-6">
                <div className="pointer-events-none select-none opacity-60">
                  <div className="mb-3 flex items-center gap-2 px-4 text-[11px] uppercase tracking-wider text-neutral-400">
                    <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                    example preview
                    <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                  </div>
                  {PLACEHOLDER_TWEETS.map((t, i) => (
                    <TweetCard
                      key={i}
                      index={i}
                      total={PLACEHOLDER_TWEETS.length}
                      tweet={t}
                      isLast={i === PLACEHOLDER_TWEETS.length - 1}
                      codeTheme={codeTheme}
                      codeSettings={codeSettings}
                    />
                  ))}
                </div>
                <p className="mt-4 text-center text-[12px] text-neutral-500">
                  Pick a prompt on the left or write to the agent on the right → thread lands here.
                </p>
              </div>
            ) : (
              <div className="mx-auto max-w-[640px] px-4 py-6">
                {tweets.map((t, i) => (
                  <TweetCard
                    key={i}
                    index={i}
                    total={tweets.length}
                    tweet={t}
                    isLast={i === tweets.length - 1}
                    codeTheme={codeTheme}
                    codeSettings={codeSettings}
                  />
                ))}
              </div>
            )}
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
        let sbId = localStorage.getItem("x_thread_sandbox_id_v5")
        if (!sbId) {
          const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
          if (!sbRes.ok) throw new Error(`Failed to create sandbox: ${sbRes.status}`)
          const data = await sbRes.json()
          sbId = data.sandboxId
          localStorage.setItem("x_thread_sandbox_id_v5", sbId!)
        }
        setSandboxId(sbId)

        let thId = localStorage.getItem("x_thread_thread_id_v5")
        if (!thId) {
          const thRes = await fetch("/api/agent/threads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sandboxId: sbId, name: "Chat" }),
          })
          if (!thRes.ok) throw new Error(`Failed to create thread: ${thRes.status}`)
          const data = await thRes.json()
          thId = data.id
          localStorage.setItem("x_thread_thread_id_v5", thId!)
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

  return <ThreadAgent sandboxId={sandboxId} threadId={threadId} colorMode={colorMode} />
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
