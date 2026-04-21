"use client"

import { useAtom } from "jotai"
import { useEffect } from "react"
import { HelpCircle } from "lucide-react"
import type { ShapeBrief } from "@/components/canvas/canvas"
import { CanvasHeader } from "@/components/canvas-header"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  activeSidebarTabAtom,
  isHelpCenterOpenAtom,
  isSidebarOpenAtom,
  type SidebarTab,
} from "@/lib/ui-atoms"
import { PageTabContent } from "./page-tab-content"
import { DesignTab } from "./design-tab"
import { HelpTab } from "./help-tab"

/**
 * Left sidebar. Mirrors the 21st LeftSidebar structure:
 *   - No visible tab bar — tabs are switched via `switch-tab` custom event
 *     or by programmatic setActiveTab calls (from the canvas toolbar / hotkeys).
 *   - CanvasHeader at the top (hidden in design mode — matches original).
 *   - Active tab content fills the remaining space.
 *   - Footer: Help popover + Feedback button.
 */
export function Sidebar({
  sandboxId,
  projectName,
  shapes,
  onFocusShape,
  onDeleteShape,
  onOpenFile,
  onApplyTheme,
  onNewVariant,
  onReset,
}: {
  sandboxId: string
  projectName: string
  shapes: ShapeBrief[]
  onFocusShape: (id: string) => void
  onDeleteShape: (id: string) => void
  onOpenFile: (path: string) => void
  onApplyTheme: (desc: string) => void
  onNewVariant: () => void
  onReset: () => void
}) {
  const [open] = useAtom(isSidebarOpenAtom)
  const [activeTab, setActiveTab] = useAtom(activeSidebarTabAtom)
  const [, setHelpOpen] = useAtom(isHelpCenterOpenAtom)

  // Listen for `switch-tab` custom event (dispatched from toolbar/command menu).
  useEffect(() => {
    const handler = (e: Event) => {
      const tab = (e as CustomEvent).detail?.tab as SidebarTab | null | undefined
      if (!tab) setActiveTab("pages")
      else setActiveTab(tab)
    }
    window.addEventListener("switch-tab", handler as EventListener)
    return () =>
      window.removeEventListener("switch-tab", handler as EventListener)
  }, [setActiveTab])

  if (!open) return null

  // Header is hidden when we're in "design" mode (the design tab takes the
  // whole sidebar height) — mirrors the original behaviour.
  const showHeader = activeTab !== "design"

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className="flex h-full flex-col overflow-hidden bg-background"
        style={{ width: "var(--sidebar-width, 240px)" }}
      >
        {showHeader && (
          <div className="p-2 pt-3">
            <CanvasHeader projectName={projectName} onReset={onReset} />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "pages" && (
            <PageTabContent
              sandboxId={sandboxId}
              shapes={shapes}
              onFocusShape={onFocusShape}
              onDeleteShape={onDeleteShape}
              onOpenFile={onOpenFile}
              onNewVariant={onNewVariant}
            />
          )}
          {activeTab === "design" && <DesignTab onApply={onApplyTheme} />}
          {activeTab === "help" && <HelpTab />}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 p-2 pt-2">
          <div className="flex items-center justify-between gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-offset-2 transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70"
                >
                  <HelpCircle className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Help</TooltipContent>
            </Tooltip>
            <div className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              OSS template
            </div>
          </div>

          <div
            className="flex items-center justify-center rounded-xl p-1 backdrop-blur"
            style={{ background: "hsl(var(--tl-background) / 0.9)" }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                window.open(
                  "https://github.com/21st-dev/21st-sdk-examples",
                  "_blank",
                )
              }}
              className="h-7 w-full rounded-lg px-2 text-foreground/80 hover:bg-foreground/10"
            >
              <span className="text-xs font-medium">View on GitHub</span>
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  )
}
