"use client"

import { useEffect, useState, type Dispatch, type SetStateAction } from "react"

/** JSON-read a value from localStorage. Returns `undefined` on absence or parse failure. */
export function readStorage<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

/** JSON-write a value to localStorage; silently swallows quota / JSON errors. */
export function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota or cyclic structure; nothing we can do */
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/**
 * `useState` that mirrors to localStorage under `key`.
 *
 * - Initializes from `initial` on the server and the first client render so
 *   hydration stays deterministic.
 * - On mount, reads the stored value and swaps it in (if present).
 * - Any subsequent state change is written back.
 */
export function useLocalStorageState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readStorage<T>(key)
    if (stored !== undefined) setValue(stored)
    setHydrated(true)
  }, [key])

  useEffect(() => {
    if (!hydrated) return
    writeStorage(key, value)
  }, [key, value, hydrated])

  return [value, setValue]
}

/**
 * Mirror an externally-owned `value` to localStorage under `key`. Pass `null`
 * for `key` to pause mirroring (e.g. while a session id is still loading).
 */
export function useStorageMirror(key: string | null, value: unknown): void {
  useEffect(() => {
    if (!key) return
    writeStorage(key, value)
  }, [key, value])
}
