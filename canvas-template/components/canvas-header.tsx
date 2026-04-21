"use client"

import { useAtom } from "jotai"
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/cn"
import { isHelpCenterOpenAtom, isSidebarOpenAtom } from "@/lib/ui-atoms"

/**
 * CanvasHeader — renders INSIDE the left sidebar at its top.
 * Two rows, compact:
 *   Row 1: Logo dropdown (left) + Close sidebar (right)
 *   Row 2: Project name (truncatable) + chevron for rename
 *
 * Mirrors the 21st canvas-header.tsx structure line-for-line visually.
 */
export function CanvasHeader({
  projectName,
  onReset,
}: {
  projectName: string
  onReset: () => void
}) {
  const [, setSidebarOpen] = useAtom(isSidebarOpenAtom)
  const [, setHelpOpen] = useAtom(isHelpCenterOpenAtom)

  return (
    <TooltipProvider delayDuration={200}>
      <header className="space-y-1">
        {/* Row 1: Logo dropdown + close */}
        <div className="mb-2 flex items-center justify-between text-sm">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex h-7 items-center gap-1.5 rounded-md px-2 hover:bg-foreground/10 data-[state=open]:bg-foreground/10"
              >
                <div
                  className="h-4 w-4 rounded-sm bg-gradient-to-br from-primary via-violet-500 to-fuchsia-500"
                  aria-hidden
                />
                <ChevronDown className="!size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={6}
              className="w-[180px]"
            >
              <DropdownMenuItem onSelect={() => setHelpOpen(true)}>
                <span className="flex-1">Help</span>
                <Kbd>⌘?</Kbd>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <span className="flex-1">Open</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent sideOffset={6} className="w-44">
                  <DropdownMenuItem asChild>
                    <a
                      href="https://21st.dev/agents/docs"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="flex-1">21st SDK docs</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href="https://github.com/21st-dev/21st-sdk-examples"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="flex-1">GitHub source</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href="https://tldraw.dev" target="_blank" rel="noreferrer">
                      <span className="flex-1">tldraw docs</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onReset}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                Reset session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setSidebarOpen(false)}
                className="h-7 w-7 p-0 hover:bg-foreground/10"
              >
                <PanelLeftClose className="!size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              Hide sidebar <Kbd>⌘\</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Row 2: Project name */}
        <div className="flex min-w-0 items-center text-sm">
          <div
            className={cn(
              "group/chat-buttons flex min-w-0 items-center",
              "rounded-md hover:bg-foreground/5",
            )}
          >
            <Button
              variant="ghost"
              className="h-7 min-w-0 max-w-full rounded-l-md rounded-r-none pl-1 pr-1.5 group-hover/chat-buttons:bg-foreground/5 hover:!bg-foreground/10"
            >
              <span className="block truncate">{projectName}</span>
            </Button>
            <Button
              variant="ghost"
              className="h-7 shrink-0 rounded-l-none rounded-r-md px-1 group-hover/chat-buttons:bg-foreground/5 hover:!bg-foreground/10"
              aria-label="File options"
            >
              <ChevronDown className="!size-3" />
            </Button>
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}

/**
 * LeftQuickActions — floating pill shown when sidebar is closed. Contains
 * the "Open sidebar" button + project name pill. Positioned by the parent
 * (absolute top-left over canvas).
 */
export function LeftQuickActions({
  projectName,
}: {
  projectName: string
}) {
  const [, setSidebarOpen] = useAtom(isSidebarOpenAtom)

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        {/* Open sidebar button */}
        <div
          className="flex items-center rounded-[10px] p-1 backdrop-blur"
          style={{ background: "hsl(var(--tl-background) / 0.9)" }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(true)}
                className="h-7 w-7 p-0 text-foreground hover:bg-foreground/10"
              >
                <PanelLeftOpen className="!size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Open sidebar <Kbd>⌘\</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Project name pill */}
        <div
          className="flex min-w-0 flex-1 items-center rounded-[10px] p-1 backdrop-blur"
          style={{ background: "hsl(var(--tl-background) / 0.9)" }}
        >
          <div className="group/chat-buttons flex min-w-0 flex-1 items-center text-sm">
            <Button
              variant="ghost"
              className="h-7 min-w-0 flex-1 rounded-l-md rounded-r-none pl-2 pr-1.5 group-hover/chat-buttons:bg-foreground/5 hover:!bg-foreground/10"
            >
              <span className="block w-full truncate">{projectName}</span>
            </Button>
            <Button
              variant="ghost"
              className="h-7 shrink-0 rounded-l-none rounded-r-md px-1 group-hover/chat-buttons:bg-foreground/5 hover:!bg-foreground/10"
              aria-label="File options"
            >
              <ChevronDown className="!size-3" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
