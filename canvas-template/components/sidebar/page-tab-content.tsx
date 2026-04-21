"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ShapeBrief } from "@/components/canvas/canvas"
import { PagesTab } from "./pages-tab"
import { ShapesTab } from "./shapes-tab"

/**
 * PageTabContent — default left-sidebar tab. Mirrors the original layout:
 *   - PagesList (file tree) at top
 *   - "Add prototype" button inside a tl-background pill
 *   - ShapesList at bottom
 */
export function PageTabContent({
  sandboxId,
  shapes,
  onFocusShape,
  onDeleteShape,
  onOpenFile,
  onNewVariant,
}: {
  sandboxId: string
  shapes: ShapeBrief[]
  onFocusShape: (id: string) => void
  onDeleteShape: (id: string) => void
  onOpenFile: (path: string) => void
  onNewVariant: () => void
}) {
  return (
    <div className="space-y-4 p-2 pb-[100px]">
      {/* File tree */}
      <div className="rounded-xl border border-border/50 bg-card/40">
        <PagesTab sandboxId={sandboxId} onFileClick={onOpenFile} />
      </div>

      {/* Add prototype */}
      <div
        className="flex items-center justify-center rounded-xl p-1 backdrop-blur"
        style={{ background: "hsl(var(--tl-background) / 0.9)" }}
      >
        <Button
          onClick={onNewVariant}
          variant="ghost"
          size="sm"
          className="h-7 w-full gap-1.5 rounded-lg px-2 text-foreground/80 hover:bg-foreground/10"
        >
          <Plus className="!size-3.5" />
          <span className="text-xs font-medium">Add prototype</span>
        </Button>
      </div>

      {/* Shape list */}
      <div className="rounded-xl border border-border/50 bg-card/40">
        <ShapesTab
          shapes={shapes}
          onFocusShape={onFocusShape}
          onDeleteShape={onDeleteShape}
        />
      </div>
    </div>
  )
}
