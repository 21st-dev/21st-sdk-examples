"use client"

// Close any menu/popover on outside-click or Escape. Pass the container ref;
// while `open`, global listeners fire `onClose` when the event doesn't fall
// inside the container.

import { useEffect, type RefObject } from "react"

export function useDismissible(
  open: boolean,
  onClose: () => void,
  ref: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("mousedown", onMouseDown)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose, ref])
}
