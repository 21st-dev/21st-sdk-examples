"use client"

import {
  Image as ImageIcon,
  Lightbulb,
  Palette,
  Rocket,
} from "lucide-react"

const HINTS = [
  {
    icon: Rocket,
    label: "Try: build a feature grid",
    prompt:
      "Replace app/page.tsx with a 6-card feature grid (icon + title + 1-line description). Tailwind. Then call start_dev_server.",
  },
  {
    icon: Palette,
    label: "Try: apply a theme",
    prompt:
      "Use the Design tab at the left to pick a color and radius, then click Apply. The agent will restyle the app.",
    isInfo: true,
  },
  {
    icon: ImageIcon,
    label: "Drag an image",
    prompt:
      "Drag any image into the canvas. Then select it and ask the agent to match its style.",
    isInfo: true,
  },
] as const

/**
 * A one-row carousel of suggestion chips shown above the chat input when
 * the conversation is empty. Disappears after the user sends anything.
 */
export function ChatContextHints({
  onPick,
  visible,
}: {
  onPick: (prompt: string) => void
  visible: boolean
}) {
  if (!visible) return null

  return (
    <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-border/60 px-2 py-1.5">
      <Lightbulb className="size-3 shrink-0 text-muted-foreground" />
      {HINTS.map((h, i) => {
        const Icon = h.icon
        const clickable = !("isInfo" in h && h.isInfo)
        return (
          <button
            key={i}
            type="button"
            onClick={() => clickable && onPick(h.prompt)}
            disabled={!clickable}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background px-2.5 py-0.5 text-[11px] text-foreground/80 transition-colors hover:border-primary/40 hover:bg-accent disabled:cursor-default disabled:opacity-70 disabled:hover:border-border/60 disabled:hover:bg-background"
          >
            <Icon className="!size-3" />
            <span>{h.label}</span>
          </button>
        )
      })}
    </div>
  )
}
