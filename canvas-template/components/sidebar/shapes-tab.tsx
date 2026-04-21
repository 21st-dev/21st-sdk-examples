"use client"

import { Image, MonitorPlay, Square, Type, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ShapeBrief } from "@/components/canvas/canvas"
import { cn } from "@/lib/cn"

function iconForType(type: string) {
  if (type === "variant") return MonitorPlay
  if (type === "reference-image") return Image
  if (type === "text") return Type
  return Square
}

export function ShapesTab({
  shapes,
  onFocusShape,
  onDeleteShape,
}: {
  shapes: ShapeBrief[]
  onFocusShape: (id: string) => void
  onDeleteShape: (id: string) => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border/60 px-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Shapes ({shapes.length})
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {shapes.length === 0 ? (
          <div className="px-2 py-3 text-[11px] leading-relaxed text-muted-foreground/70">
            No shapes yet. Draw on the canvas or ask the agent to build something.
          </div>
        ) : (
          shapes.map((s) => {
            const Icon = iconForType(s.type)
            const label =
              s.type === "variant"
                ? (s.routePath === "/" || !s.routePath
                    ? "app/page.tsx"
                    : `app${s.routePath}`)
                : s.type === "reference-image"
                  ? s.imageAlt ?? "image"
                  : (s.text ?? s.type)
            return (
              <div
                key={s.id}
                className={cn(
                  "group flex h-7 items-center rounded-md pr-0.5 transition-colors hover:bg-accent",
                  s.selected && "bg-accent/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => onFocusShape(s.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 text-left text-[12px] text-foreground/80"
                  title={`Focus ${s.type}`}
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{label}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/60">
                    {s.type}
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="iconSm"
                  onClick={() => onDeleteShape(s.id)}
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Delete shape"
                >
                  <X className="!size-3" />
                </Button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
