"use client"

import { useEffect, useState } from "react"

export type ColorMode = "light" | "dark"

/**
 * Reactive color scheme.
 *
 * Pass `override` to force a mode (e.g. from a `?theme=` URL param); otherwise
 * the hook follows the user's OS `prefers-color-scheme` and updates on change.
 *
 * SSR-safe: defaults to `"dark"` until `useEffect` reads the media query on
 * the client, keeping Next.js hydration deterministic.
 */
export function useColorMode(override?: ColorMode): ColorMode {
  const [mode, setMode] = useState<ColorMode>(override ?? "dark")

  useEffect(() => {
    if (override) {
      setMode(override)
      return
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    setMode(mq.matches ? "dark" : "light")
    const handler = (e: MediaQueryListEvent) => setMode(e.matches ? "dark" : "light")
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [override])

  return mode
}
