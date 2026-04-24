"use client"

import { useEffect, useRef, useState } from "react"
import type { ThreadItem } from "../types"
import { removeStorage } from "./local-storage"

const SANDBOX_STORAGE_KEY = "agent_sandbox_id"
const THREAD_STORAGE_KEY = "agent_thread_id"

export interface AgentSession {
  sandboxId: string | null
  threadId: string | null
  error: string | null
}

/**
 * Boots (or reuses) a sandbox + thread for the `@21st-sdk` agent.
 *
 * Flow:
 *  1. Reuse `sandbox_id` from localStorage, or POST /api/agent/sandbox for a new one.
 *  2. GET /api/agent/threads. On failure, assume the sandbox is dead, recreate it.
 *  3. Reuse a previously-used thread id if still present; otherwise create one.
 *
 * Both ids are persisted so a page reload keeps the session stable.
 */
export function useAgentSession(options: { threadName?: string } = {}): AgentSession {
  const threadName = options.threadName ?? "Editor session"
  const [sandboxId, setSandboxId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    void boot().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to initialize")
    })

    async function boot() {
      let sbId = localStorage.getItem(SANDBOX_STORAGE_KEY) ?? (await createSandbox())
      let threadsRes = await fetch(`/api/agent/threads?sandboxId=${sbId}`)
      if (!threadsRes.ok) {
        // Sandbox likely garbage-collected on the backend; rebuild.
        removeStorage(THREAD_STORAGE_KEY)
        sbId = await createSandbox()
        threadsRes = await fetch(`/api/agent/threads?sandboxId=${sbId}`)
        if (!threadsRes.ok) {
          throw new Error(`Failed to fetch threads: ${threadsRes.status}`)
        }
      }
      setSandboxId(sbId)

      const existing: ThreadItem[] = await threadsRes.json()
      const savedId = localStorage.getItem(THREAD_STORAGE_KEY)
      const thId =
        existing.find((t) => t.id === savedId)?.id ??
        existing[0]?.id ??
        (await createThread(sbId, threadName))
      localStorage.setItem(THREAD_STORAGE_KEY, thId)
      setThreadId(thId)
    }
  }, [threadName])

  return { sandboxId, threadId, error }
}

async function createSandbox(): Promise<string> {
  const r = await fetch("/api/agent/sandbox", { method: "POST" })
  if (!r.ok) throw new Error(`Failed to create sandbox: ${r.status}`)
  const body = (await r.json()) as { sandboxId: string }
  localStorage.setItem(SANDBOX_STORAGE_KEY, body.sandboxId)
  return body.sandboxId
}

async function createThread(sandboxId: string, name: string): Promise<string> {
  const r = await fetch("/api/agent/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sandboxId, name }),
  })
  if (!r.ok) throw new Error(`Failed to create thread: ${r.status}`)
  const body = (await r.json()) as ThreadItem
  return body.id
}

/** Clear session ids + project state and reload. Use when the backend rejects
 * a known `thread_id` / `sandbox_id`. */
export function resetAgentSession(extraKeyPrefix = "video-editor:"): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (
        key === SANDBOX_STORAGE_KEY ||
        key === THREAD_STORAGE_KEY ||
        key.startsWith(extraKeyPrefix)
      ) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    /* storage access denied; nothing to do */
  }
  window.location.reload()
}
