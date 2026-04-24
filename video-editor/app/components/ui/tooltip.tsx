"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import * as React from "react"
import { cn } from "../../lib/utils"
import { Kbd, formatShortcut } from "./kbd"

// Re-exported Radix primitives so the rest of the app can compose custom
// layouts (multi-line tooltips, grouped shortcuts) without re-wiring the
// provider / positioning logic.
export const TooltipProvider = TooltipPrimitive.Provider
export const TooltipRoot = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & {
    showArrow?: boolean
  }
>(({ className, sideOffset = 4, showArrow = false, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      data-tooltip="true"
      className={cn(
        "relative z-50 max-w-[280px] flex flex-col items-start gap-0.5 rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark",
        className,
      )}
      {...props}
    >
      {props.children}
      {showArrow && (
        <TooltipPrimitive.Arrow className="-my-px fill-popover drop-shadow-[0_1px_0_hsl(var(--border))]" />
      )}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

interface TooltipProps {
  /** Text shown as the tooltip body. */
  label: React.ReactNode
  /** Optional combo string (e.g. `"Cmd+Z"`) rendered as a `<Kbd>` chip. */
  shortcut?: string
  side?: "top" | "right" | "bottom" | "left"
  /** Wait before the tooltip appears. Defaults to Radix' 700ms. */
  delayDuration?: number
  disabled?: boolean
  children: React.ReactNode
}

/**
 * Convenience wrapper matching the tooltip style used across 21st-private-1
 * and agents-web. Pass `shortcut` to auto-render the `<Kbd>` badge.
 *
 * For complex content (multi-line, inline icons) compose the primitives
 * directly: `<TooltipRoot>` + `<TooltipTrigger>` + `<TooltipContent>`.
 */
export function Tooltip({
  label,
  shortcut,
  side = "top",
  delayDuration,
  disabled,
  children,
}: TooltipProps) {
  if (disabled) return <>{children}</>
  return (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        <span className="text-popover-foreground">{label}</span>
        {shortcut && (
          <Kbd className="ml-0.5 border-border bg-muted text-muted-foreground">
            {formatShortcut(shortcut)}
          </Kbd>
        )}
      </TooltipContent>
    </TooltipRoot>
  )
}
