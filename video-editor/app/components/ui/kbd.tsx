"use client"

import type { ReactNode } from "react"

/**
 * Inline keyboard-shortcut chip. Meant to live inside a Button next to its
 * label so the shortcut is always visible, not hidden in tooltip.
 *
 * `variant` adapts to the parent surface: use "light" when the chip sits on
 * a bright background (e.g. a primary button), otherwise keep "dark".
 */
export function Kbd({
  children,
  className = "",
  variant = "dark",
}: {
  children: ReactNode
  className?: string
  variant?: "dark" | "light"
}) {
  const variantCls =
    variant === "light"
      ? "border-neutral-900/15 bg-neutral-900/5 text-neutral-600"
      : "border-neutral-700 bg-neutral-900/80 text-neutral-400 shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]"
  return (
    <kbd
      className={`inline-flex select-none items-center justify-center rounded border px-1 py-[1px] font-sans text-[10px] leading-none ${variantCls} ${className}`}
    >
      {children}
    </kbd>
  )
}

/**
 * Normalise a keyboard combo string (e.g. "Cmd+K", "Shift+ArrowLeft") into
 * the Mac-style visual form ("⌘ K", "⇧ ←").
 *
 * Used so we can author shortcuts with plain names in `useShortcuts({...})`
 * and then show the same key visually as a `<Kbd>` chip on the button.
 */
export function formatShortcut(combo: string): string {
  const parts = combo.split("+").map((p) => p.trim())
  return parts
    .map((p) => {
      switch (p) {
        case "Cmd":
        case "Meta":
          return "⌘"
        case "Ctrl":
          return "⌃"
        case "Shift":
          return "⇧"
        case "Alt":
        case "Option":
          return "⌥"
        case "ArrowUp":
          return "↑"
        case "ArrowDown":
          return "↓"
        case "ArrowLeft":
          return "←"
        case "ArrowRight":
          return "→"
        case "Enter":
          return "↵"
        case "Escape":
          return "Esc"
        case "Backspace":
          return "⌫"
        case "Delete":
          return "⌦"
        case "Space":
          return "␣"
        case "Tab":
          return "⇥"
        default:
          return p.length === 1 ? p.toUpperCase() : p
      }
    })
    .join("")
}
