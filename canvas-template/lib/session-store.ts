"use client"

import { atom, useAtom } from "jotai"

/**
 * Client-side session state. Persisted to localStorage. This is the minimum
 * a canvas template needs to know between reloads — the rest lives in the
 * sandbox (files) and the thread (messages).
 */
export type Session = {
  sandboxId: string
  threadId: string
  e2bSandboxId: string | null
}

const SESSION_KEY = "canvas-template:session"

function loadSession(): Session | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Session
  } catch {
    return null
  }
}

export function saveSession(s: Session | null) {
  if (typeof window === "undefined") return
  if (s === null) {
    localStorage.removeItem(SESSION_KEY)
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  }
}

export const sessionAtom = atom<Session | null>(loadSession())

export function useSession() {
  return useAtom(sessionAtom)
}
