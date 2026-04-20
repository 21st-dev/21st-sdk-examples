"use client"

// A tiny replacement for the repeated `useState + useEffect(load) + setter
// wrapper that writes to localStorage` pattern. Reads once on mount (SSR-safe
// via useEffect), silently no-ops on failure.

import { useCallback, useEffect, useState } from "react"

export function usePersistentState<T>(
  key: string,
  initial: T,
  deserialize?: (raw: unknown) => T | null,
): [T, (next: T) => void, () => void] {
  const [value, setValueRaw] = useState<T>(initial)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) return
      const parsed = JSON.parse(raw)
      const next = deserialize ? deserialize(parsed) : (parsed as T)
      if (next != null) setValueRaw(next)
    } catch {}
    // deserialize intentionally omitted: callers typically pass a stable fn
    // inline; re-reading on change would wipe valid state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setValue = useCallback(
    (next: T) => {
      setValueRaw(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {}
    },
    [key],
  )

  const clear = useCallback(() => {
    setValueRaw(initial)
    try {
      localStorage.removeItem(key)
    } catch {}
    // initial is a stable reference from the caller's perspective.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return [value, setValue, clear]
}
