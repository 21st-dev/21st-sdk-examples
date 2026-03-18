"use client"

import { useChat } from "@ai-sdk/react"
import { AgentChat, createAgentChat } from "@21st-sdk/nextjs"
import "@21st-sdk/react/styles.css"
import type { Chat } from "@ai-sdk/react"
import type { UIMessage } from "ai"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { AgentSidebar } from "./_components/agent-sidebar"
import { SetupChecklist } from "./_components/setup-checklist"

type FormId = "profile" | "order" | "support"

type ProfileForm = {
  fullName: string
  email: string
  age: string
  role: "designer" | "engineer" | "manager" | "other"
  newsletter: boolean
}

type OrderForm = {
  product: "starter" | "pro" | "enterprise"
  quantity: string
  deliveryDate: string
  giftWrap: boolean
  notes: string
}

type SupportForm = {
  topic: string
  priority: "low" | "medium" | "high"
  contactMethod: "email" | "phone" | "chat"
  allowFollowUp: boolean
  message: string
}

type FormValues = {
  profile: ProfileForm
  order: OrderForm
  support: SupportForm
}

type FillFormPayload = {
  formId: FormId
  patch: Record<string, unknown>
}

const DEFAULT_VALUES: FormValues = {
  profile: {
    fullName: "",
    email: "",
    age: "",
    role: "designer",
    newsletter: false,
  },
  order: {
    product: "starter",
    quantity: "1",
    deliveryDate: "",
    giftWrap: false,
    notes: "",
  },
  support: {
    topic: "",
    priority: "medium",
    contactMethod: "email",
    allowFollowUp: true,
    message: "",
  },
}

const FORM_IDS: FormId[] = ["profile", "order", "support"]

const ACTIVE_FORM_SCHEMAS: Record<FormId, Record<string, unknown>> = {
  profile: {
    fullName: "string",
    email: "string(email)",
    age: "number",
    role: ["designer", "engineer", "manager", "other"],
    newsletter: "boolean",
  },
  order: {
    product: ["starter", "pro", "enterprise"],
    quantity: "number",
    deliveryDate: "string(yyyy-mm-dd)",
    giftWrap: "boolean",
    notes: "string",
  },
  support: {
    topic: "string",
    priority: ["low", "medium", "high"],
    contactMethod: ["email", "phone", "chat"],
    allowFollowUp: "boolean",
    message: "string",
  },
}

const SYSTEM_NOTE_PREFIX = "[[[SYSTEM NOTE:"
const SYSTEM_NOTE_SUFFIX = "]]]"

function getMessagesStorageKey(sandboxId: string, threadId: string) {
  return `fill-form:messages:${sandboxId}:${threadId}`
}

function isFillFormToolType(type: string): boolean {
  return (
    type === "tool-fill_form" ||
    type.includes("fill_form") ||
    type.endsWith("-fill_form") ||
    type.endsWith("__fill_form")
  )
}

function isFillFormToolName(toolName: string): boolean {
  return (
    toolName === "fill_form" ||
    toolName.includes("fill_form") ||
    toolName.endsWith("-fill_form") ||
    toolName.endsWith("__fill_form")
  )
}

function isFillFormToolPart(part: unknown): boolean {
  if (!part || typeof part !== "object") return false

  const maybe = part as { type?: unknown; toolName?: unknown }

  if (typeof maybe.type === "string" && isFillFormToolType(maybe.type)) return true
  if (typeof maybe.toolName === "string" && isFillFormToolName(maybe.toolName)) return true

  return false
}

function stripSystemNotePrefix(text: string): string {
  if (!text.startsWith(SYSTEM_NOTE_PREFIX)) return text
  const suffixIndex = text.indexOf(SYSTEM_NOTE_SUFFIX)
  if (suffixIndex === -1) return text
  return text.slice(suffixIndex + SYSTEM_NOTE_SUFFIX.length).trimStart()
}

function extractJsonTextFromToolOutput(output: unknown): string | null {
  if (typeof output === "string") return output
  if (Array.isArray(output)) {
    const textParts: string[] = []
    for (const item of output) {
      if (typeof item === "string") {
        textParts.push(item)
        continue
      }
      if (!item || typeof item !== "object") continue
      const maybePart = item as { type?: unknown; text?: unknown }
      if (maybePart.type === "text" && typeof maybePart.text === "string") {
        textParts.push(maybePart.text)
      }
    }
    if (textParts.length > 0) return textParts.join("")
    return null
  }
  if (!output || typeof output !== "object") return null

  // Some transports normalize string output into an object with numeric keys.
  if (!Array.isArray(output)) {
    const numericEntries = Object.entries(output)
      .filter(([key, value]) => /^\d+$/.test(key) && typeof value === "string")
      .sort((a, b) => Number(a[0]) - Number(b[0]))
    if (numericEntries.length > 0) {
      return numericEntries.map(([, value]) => value).join("")
    }
  }

  const maybeOutput = output as { text?: unknown; content?: unknown }
  if (typeof maybeOutput.text === "string") return maybeOutput.text

  if (!Array.isArray(maybeOutput.content)) return null
  for (const item of maybeOutput.content) {
    if (!item || typeof item !== "object") continue
    const maybePart = item as { type?: unknown; text?: unknown }
    if (maybePart.type === "text" && typeof maybePart.text === "string") {
      return maybePart.text
    }
  }

  return null
}

function parseFillFormPayload(output: unknown): FillFormPayload | null {
  const jsonText = extractJsonTextFromToolOutput(output)
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText) as { formId?: unknown; patch?: unknown }
    if (!parsed || typeof parsed !== "object") return null
    if (typeof parsed.formId !== "string" || !FORM_IDS.includes(parsed.formId as FormId)) {
      return null
    }
    if (!parsed.patch || typeof parsed.patch !== "object" || Array.isArray(parsed.patch)) {
      return null
    }

    return {
      formId: parsed.formId as FormId,
      patch: parsed.patch as Record<string, unknown>,
    }
  } catch {
    return null
  }
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string") return value
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

function asFillFormPart(part: unknown): {
  type: string
  toolName?: string
  state?: string
  preliminary?: boolean
  toolCallId?: string
  output?: unknown
  result?: unknown
} | null {
  if (!part || typeof part !== "object") return null
  const maybe = part as {
    type?: unknown
    toolName?: unknown
    state?: unknown
    preliminary?: unknown
    toolCallId?: unknown
    output?: unknown
    result?: unknown
  }

  if (typeof maybe.type !== "string" || !isFillFormToolPart(maybe)) return null

  return {
    type: maybe.type,
    toolName: typeof maybe.toolName === "string" ? maybe.toolName : undefined,
    state: typeof maybe.state === "string" ? maybe.state : undefined,
    preliminary: typeof maybe.preliminary === "boolean" ? maybe.preliminary : undefined,
    toolCallId: typeof maybe.toolCallId === "string" ? maybe.toolCallId : undefined,
    output: maybe.output,
    result: maybe.result,
  }
}

function FormAgent({
  sandboxId,
  threadId,
  colorMode,
}: {
  sandboxId: string
  threadId: string
  colorMode: "light" | "dark"
}) {
  const [activeTab, setActiveTab] = useState<FormId>("profile")
  const lastAppliedToolCallId = useRef<string | null>(null)
  const chat = useMemo(
    () =>
      createAgentChat({
        agent: "form-agent",
        tokenUrl: "/api/agent/token",
        sandboxId,
        threadId,
      }),
    [sandboxId, threadId],
  )
  const didHydrateRef = useRef(false)
  const storageKey = getMessagesStorageKey(sandboxId, threadId)
  const { register, setValue, getValues } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  })

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    chat: chat as Chat<UIMessage>,
  })

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

  const displayMessages = useMemo<UIMessage[]>(() => {
    return messages.map((message) => {
      const parts = message.parts
        .filter((part) => {
          return !isFillFormToolPart(part)
        })
        .map((part) => {
          if (message.role !== "user" || part.type !== "text") return part
          return {
            ...part,
            text: stripSystemNotePrefix(part.text),
          }
        })

      return {
        ...message,
        parts,
      }
    })
  }, [messages])

  function applyPatchToForm(formId: FormId, patch: Record<string, unknown>) {
    if (formId === "profile") {
      if ("fullName" in patch) {
        const value = toStringValue(patch.fullName)
        if (value !== null) setValue("profile.fullName", value, { shouldDirty: true })
      }
      if ("email" in patch) {
        const value = toStringValue(patch.email)
        if (value !== null) setValue("profile.email", value, { shouldDirty: true })
      }
      if ("age" in patch) {
        const value = toStringValue(patch.age)
        if (value !== null) setValue("profile.age", value, { shouldDirty: true })
      }
      if ("role" in patch && typeof patch.role === "string") {
        if (["designer", "engineer", "manager", "other"].includes(patch.role)) {
          setValue("profile.role", patch.role as ProfileForm["role"], { shouldDirty: true })
        }
      }
      if ("newsletter" in patch && typeof patch.newsletter === "boolean") {
        setValue("profile.newsletter", patch.newsletter, { shouldDirty: true })
      }
      return
    }

    if (formId === "order") {
      if ("product" in patch && typeof patch.product === "string") {
        if (["starter", "pro", "enterprise"].includes(patch.product)) {
          setValue("order.product", patch.product as OrderForm["product"], { shouldDirty: true })
        }
      }
      if ("quantity" in patch) {
        const value = toStringValue(patch.quantity)
        if (value !== null) setValue("order.quantity", value, { shouldDirty: true })
      }
      if ("deliveryDate" in patch) {
        const value = toStringValue(patch.deliveryDate)
        if (value !== null) setValue("order.deliveryDate", value, { shouldDirty: true })
      }
      if ("giftWrap" in patch && typeof patch.giftWrap === "boolean") {
        setValue("order.giftWrap", patch.giftWrap, { shouldDirty: true })
      }
      if ("notes" in patch) {
        const value = toStringValue(patch.notes)
        if (value !== null) setValue("order.notes", value, { shouldDirty: true })
      }
      return
    }

    if ("topic" in patch) {
      const value = toStringValue(patch.topic)
      if (value !== null) setValue("support.topic", value, { shouldDirty: true })
    }
    if ("priority" in patch && typeof patch.priority === "string") {
      if (["low", "medium", "high"].includes(patch.priority)) {
        setValue("support.priority", patch.priority as SupportForm["priority"], { shouldDirty: true })
      }
    }
    if ("contactMethod" in patch && typeof patch.contactMethod === "string") {
      if (["email", "phone", "chat"].includes(patch.contactMethod)) {
        setValue("support.contactMethod", patch.contactMethod as SupportForm["contactMethod"], {
          shouldDirty: true,
        })
      }
    }
    if ("allowFollowUp" in patch && typeof patch.allowFollowUp === "boolean") {
      setValue("support.allowFollowUp", patch.allowFollowUp, { shouldDirty: true })
    }
    if ("message" in patch) {
      const value = toStringValue(patch.message)
      if (value !== null) setValue("support.message", value, { shouldDirty: true })
    }
  }

  useEffect(() => {
    const latestFillPart = [...messages]
      .reverse()
      .flatMap((message) => [...message.parts].reverse())
      .map(asFillFormPart)
      .find((part) => {
        if (!part || part.preliminary === true) return false
        const hasPayload = part.output !== undefined || part.result !== undefined
        if (!hasPayload) return false
        return part.state === "output-available" || part.state === undefined
      })

    if (!latestFillPart?.toolCallId) return
    if (lastAppliedToolCallId.current === latestFillPart.toolCallId) return

    const payload = parseFillFormPayload(latestFillPart.output ?? latestFillPart.result)

    if (!payload) return
    if (payload.formId !== activeTab) return

    applyPatchToForm(payload.formId, payload.patch)
    lastAppliedToolCallId.current = latestFillPart.toolCallId
  }, [activeTab, messages])

  function buildSystemContextPrefix() {
    const currentFormData = getValues(activeTab)
    const currentFormSchema = ACTIVE_FORM_SCHEMAS[activeTab]

    return `[[[SYSTEM NOTE: CURRENTLY USER IS WORKING WITH THE FORM "${activeTab}". YOU MUST PATCH THIS FORM ONLY. IF USER WANTS ANOTHER FORM, ASK THEM TO SWITCH TABS FIRST. CURRENT FORM DATA: ${JSON.stringify(currentFormData)}. FORM SCHEMA AGAIN: ${JSON.stringify(currentFormSchema)}. RETURN A fill_form TOOL CALL WITH MATCHING formId.]]]`
  }

  const agentOnline = !error && messages.length > 0

  return (
    <div className={`flex flex-col md:flex-row h-screen bg-background text-foreground${colorMode === "dark" ? " dark" : ""}`}>
      <AgentSidebar>
        <SetupChecklist agentOnline={agentOnline} />
      </AgentSidebar>
      <main className="flex-1 min-w-0 grid grid-cols-[282px_minmax(0,1fr)] overflow-hidden">
      <section className="p-4 overflow-y-auto border-r border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
        <div className="mb-5 rounded-full border p-1 border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`w-full rounded-full px-3 py-2 text-sm transition-colors duration-200 ${
              activeTab === "profile"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-none"
                : "bg-transparent text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("order")}
            className={`w-full rounded-full px-3 py-2 text-sm transition-colors duration-200 ${
              activeTab === "order"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-none"
                : "bg-transparent text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            Order
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("support")}
            className={`w-full rounded-full px-3 py-2 text-sm transition-colors duration-200 ${
              activeTab === "support"
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-100 dark:text-neutral-900 dark:shadow-none"
                : "bg-transparent text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            Support
          </button>
        </div>
        </div>

        {activeTab === "profile" && (
          <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Full name</span>
              <input {...register("profile.fullName")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Email</span>
              <input type="email" {...register("profile.email")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Age</span>
              <input type="number" {...register("profile.age")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Role</span>
              <select {...register("profile.role")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                <option value="designer">Designer</option>
                <option value="engineer">Engineer</option>
                <option value="manager">Manager</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("profile.newsletter")} />
              Subscribe to newsletter
            </label>
          </form>
        )}

        {activeTab === "order" && (
          <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Product</span>
              <select {...register("order.product")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Quantity</span>
              <input type="number" {...register("order.quantity")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Delivery date</span>
              <input type="date" {...register("order.deliveryDate")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("order.giftWrap")} />
              Gift wrap
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Notes</span>
              <textarea rows={3} {...register("order.notes")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
            </label>
          </form>
        )}

        {activeTab === "support" && (
          <form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Topic</span>
              <input {...register("support.topic")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
            </label>
            <fieldset>
              <legend className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Priority</legend>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" value="low" {...register("support.priority")} />
                  Low
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="medium" {...register("support.priority")} />
                  Medium
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" value="high" {...register("support.priority")} />
                  High
                </label>
              </div>
            </fieldset>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Preferred contact</span>
              <select {...register("support.contactMethod")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="chat">Chat</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...register("support.allowFollowUp")} />
              Allow follow-up
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-600 dark:text-neutral-400">Message</span>
              <textarea rows={4} {...register("support.message")} className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
            </label>
          </form>
        )}
      </section>

      <section className="h-full min-h-0">
        <AgentChat
          messages={displayMessages}
          onSend={(msg) => {
            // Prefix is sent only to the model context and stripped from the UI render.
            const contextPrefix = buildSystemContextPrefix()
            sendMessage({ text: `${contextPrefix}\n\n${msg.content}` })
          }}
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

  return <FormAgent sandboxId={sandboxId} threadId={threadId} colorMode={colorMode} />
}

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center">Loading...</main>}>
      <HomeContent />
    </Suspense>
  )
}
