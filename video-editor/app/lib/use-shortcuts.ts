"use client"

import { useEffect, useRef } from "react"

export type ShortcutHandler = (e: KeyboardEvent) => void | boolean

export interface ShortcutMap {
  [combo: string]: ShortcutHandler
}

/**
 * Keyboard-shortcut dispatcher.
 *
 * Combo syntax: `"Space"`, `"ArrowLeft"`, `"Shift+ArrowLeft"`, `"Cmd+K"`, `"Meta+K"`.
 * - Matches on `e.key` (case-insensitive for letters).
 * - `Cmd` and `Meta` are aliases; on Mac this is ⌘, on Windows/Linux this is Ctrl (we accept both).
 * - Handlers may return `true` to skip `preventDefault` (e.g. to still insert space into an input).
 * - Shortcuts are disabled while focus is inside `<input>`, `<textarea>`, `[contenteditable]`, or
 *   when the target has data-allow-typing="true".
 */
export function useShortcuts(map: ShortcutMap, enabled = true) {
  const mapRef = useRef(map)
  useEffect(() => {
    mapRef.current = map
  }, [map])

  useEffect(() => {
    if (!enabled) return

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable ||
          target.getAttribute?.("data-allow-typing") === "true"
        ) {
          return
        }
      }

      const parts: string[] = []
      if (e.metaKey || e.ctrlKey) parts.push("Cmd")
      if (e.shiftKey) parts.push("Shift")
      if (e.altKey) parts.push("Alt")
      let key = e.key
      // Normalise: space → "Space"
      if (key === " ") key = "Space"
      // Letters: upper-case so "k" and "K" match "K"
      if (key.length === 1) key = key.toUpperCase()
      parts.push(key)
      const combo = parts.join("+")

      const handler = mapRef.current[combo]
      if (!handler) return
      const skip = handler(e)
      if (!skip) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [enabled])
}
