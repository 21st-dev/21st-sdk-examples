"use client"

import { Image, MonitorPlay, Square, Type, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ShapeBrief } from "./canvas/canvas"

function iconForType(type: string) {
  if (type === "variant") return MonitorPlay
  if (type === "reference-image") return Image
  if (type === "text") return Type
  return Square
}

export function ContextPills({
  selectedShapes,
  onFocus,
  onDismiss,
}: {
  selectedShapes: ShapeBrief[]
  onFocus: (id: string) => void
  onDismiss: (id: string) => void
}) {
  if (selectedShapes.length === 0) return null

  return (
    <div className="flex min-h-[36px] flex-wrap items-center gap-1 border-b border-border/80 bg-muted/30 px-2 py-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        context
      </span>
      {selectedShapes.map((s) => {
        const label =
          s.type === "variant"
            ? s.routePath === "/" || !s.routePath
              ? "app/page.tsx"
              : `app${s.routePath}`
            : s.type === "reference-image"
              ? s.imageAlt ?? "image"
              : (s.text ?? s.type)
        const Icon = iconForType(s.type)
        return (
          <div
            key={s.id}
            className="group inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 py-0.5 pl-1.5 pr-0.5 text-[11px] text-primary"
          >
            <button
              type="button"
              onClick={() => onFocus(s.id)}
              className="flex max-w-[160px] items-center gap-1 truncate"
              title={`Focus ${s.type}`}
            >
              <Icon className="!size-3" />
              <span className="truncate">{label}</span>
            </button>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={() => onDismiss(s.id)}
              className="h-4 w-4 rounded-full text-primary/70 hover:bg-primary/20 hover:text-primary"
              aria-label="Remove from context"
            >
              <X className="!size-2.5" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}
