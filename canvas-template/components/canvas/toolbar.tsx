"use client"

import { useAtom } from "jotai"
import {
  Copy,
  ExternalLink,
  History,
  Link2,
  ListTodo,
  Maximize2,
  MousePointerClick,
  Package2,
  Palette,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { forwardRef, type ReactNode } from "react"
import { cn } from "@/lib/cn"
import { isPlanModeAtom } from "@/lib/ui-atoms"
import { Kbd } from "@/components/ui/kbd"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ShapeBrief } from "./canvas"

/**
 * ToolButton — matches the exact styling of the original canvas-toolbar
 * ToolButton. The toolbar assumes a dark surface (`bg-[#2C2C2C]`); buttons
 * use white/10 hovers + white/20 active.
 */
const ToolButton = forwardRef<
  HTMLButtonElement,
  {
    icon?: React.ElementType
    isActive?: boolean
    onClick?: () => void
    label: string
    buttonLabel?: string
    kbd?: string
    disabled?: boolean
    iconSize?: string
    variant?: "default" | "primary"
    children?: ReactNode
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">
>(function ToolButton(
  {
    icon: Icon,
    isActive = false,
    onClick,
    label,
    buttonLabel,
    kbd,
    disabled = false,
    iconSize = "size-4",
    variant = "default",
    children,
    ...rest
  },
  ref,
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors",
            "outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70",
            variant === "primary"
              ? "bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90 shadow-[0_0_0_0.5px_rgb(23,23,23),inset_0_0_0_1px_rgba(0,0,0,0.14)]"
              : isActive
                ? "bg-white/20 text-white"
                : "text-white/90 hover:bg-white/10",
            disabled && "cursor-not-allowed opacity-50",
          )}
          {...rest}
        >
          {Icon ? <Icon className={iconSize} /> : children}
          {buttonLabel && <span>{buttonLabel}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>
        {label}
        {kbd && <Kbd className="ml-1.5">{kbd}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
})

const Divider = () => <div className="mx-1 h-5 w-px bg-white/20" />

/**
 * CanvasToolbar — two modes:
 *   - Default (no variant selected):  [ Community | + New variant ]
 *   - Variant selected: [ Interactive | Full-screen | History | Plan | Design | Share (primary) ]
 *
 * Exact visual style of the 21st canvas-toolbar: dark `#2C2C2C` surface,
 * border-white/10, rounded-xl p-1 shadow-2xl, animated max-width expansion
 * when transitioning to variant mode.
 */
export function CanvasToolbar({
  selectedVariant,
  selectedInteractive,
  onToggleInteractive,
  onNewVariant,
  onRegenerate,
  onFullScreen,
  onHistory,
  onShare,
  onDeleteShape,
  onCopyUrl,
  onOpenInNewTab,
  onResetCanvas,
}: {
  selectedVariant: ShapeBrief | null
  selectedInteractive: boolean
  onToggleInteractive: () => void
  onNewVariant: () => void
  onRegenerate: () => void
  onFullScreen: () => void
  onHistory: () => void
  onShare: () => void
  onDeleteShape: () => void
  onCopyUrl: () => void
  onOpenInNewTab: () => void
  onResetCanvas: () => void
}) {
  const [planMode, setPlanMode] = useAtom(isPlanModeAtom)
  const isVariantSelected = !!selectedVariant

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "inline-flex items-center gap-0.5 overflow-hidden rounded-xl p-1 shadow-2xl backdrop-blur-lg transition-[max-width] duration-300 ease-in-out",
          "border border-white/10 bg-[#2C2C2C]",
          !isVariantSelected ? "max-w-[260px]" : "max-w-[720px]",
        )}
      >
        {!isVariantSelected ? (
          /* Default mode */
          <div className="flex items-center gap-1 whitespace-nowrap">
            <ToolButton
              icon={Package2}
              onClick={onResetCanvas}
              label="Clear the canvas (sandbox is kept)"
              buttonLabel="Clear"
              iconSize="size-4"
            />
            <Divider />
            <ToolButton
              icon={Plus}
              onClick={onNewVariant}
              label="Add a new prototype"
              buttonLabel="Add prototype"
              kbd="N"
              variant="primary"
              iconSize="size-4"
            />
          </div>
        ) : (
          /* Variant-selected mode */
          <div className="flex items-center gap-0.5 whitespace-nowrap">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (!target.closest('[role="switch"]')) onToggleInteractive()
                  }}
                  className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2"
                >
                  <MousePointerClick className="size-3.5 text-white/70" />
                  <Switch
                    checked={selectedInteractive}
                    onCheckedChange={onToggleInteractive}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>
                Interactive Mode <Kbd className="ml-1.5">I</Kbd>
              </TooltipContent>
            </Tooltip>

            <Divider />

            <ToolButton
              icon={Maximize2}
              onClick={onFullScreen}
              label="Full screen"
              buttonLabel="Full screen"
              kbd="O"
              iconSize="size-3.5"
            />
            <ToolButton
              icon={History}
              onClick={onHistory}
              label="Version History"
              buttonLabel="History"
              kbd="H"
              iconSize="size-3.5"
            />
            <ToolButton
              icon={RotateCcw}
              onClick={onRegenerate}
              label="Regenerate this page"
              buttonLabel="Regenerate"
              iconSize="size-3.5"
            />

            <Divider />

            <ToolButton
              icon={ListTodo}
              onClick={() => setPlanMode((v) => !v)}
              isActive={planMode}
              label="Plan mode: agent outlines before editing"
              buttonLabel="Plan"
              kbd="P"
              iconSize="size-3.5"
            />
            <ToolButton
              icon={Palette}
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("switch-tab", { detail: { tab: "design" } }),
                )
              }}
              label="Open design mode"
              buttonLabel="Design"
              kbd="D"
              iconSize="size-3.5"
            />

            <Divider />

            <ToolButton
              icon={Copy}
              onClick={onCopyUrl}
              label="Copy URL"
              iconSize="size-3.5"
            />
            <ToolButton
              icon={ExternalLink}
              onClick={onOpenInNewTab}
              label="Open in new tab"
              iconSize="size-3.5"
            />
            <ToolButton
              icon={Trash2}
              onClick={onDeleteShape}
              label="Delete shape"
              iconSize="size-3.5"
            />
            <ToolButton
              icon={Link2}
              onClick={onShare}
              label="Share"
              buttonLabel="Share"
              variant="primary"
              iconSize="size-3.5"
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
