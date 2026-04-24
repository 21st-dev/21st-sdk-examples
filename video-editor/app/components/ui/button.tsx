"use client"

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react"
import { Kbd, formatShortcut } from "./kbd"
import { Tooltip } from "./tooltip"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "xs" | "sm" | "md"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Leading icon (usually a lucide-react component at 13–16px). */
  icon?: ReactNode
  /** Trailing icon. */
  iconRight?: ReactNode
  /** Keyboard shortcut combo, e.g. "Cmd+Enter". Rendered as a <Kbd> chip. */
  shortcut?: string
  /** Full-width */
  block?: boolean
}

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-neutral-100 text-neutral-900 hover:bg-white disabled:bg-neutral-700 disabled:text-neutral-500",
  secondary:
    "border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800 disabled:text-neutral-600 disabled:border-neutral-800",
  ghost:
    "bg-transparent text-neutral-400 hover:bg-white/5 hover:text-white disabled:text-neutral-600",
  danger:
    "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-40",
}

const SIZE: Record<Size, string> = {
  xs: "h-6 px-1.5 text-[11px] gap-1",
  sm: "h-7 px-2.5 text-[12px] gap-1.5",
  md: "h-8 px-3 text-[13px] gap-2",
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "sm",
    icon,
    iconRight,
    shortcut,
    block,
    className = "",
    children,
    title,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  const combinedTitle = shortcut
    ? title
      ? `${title} (${formatShortcut(shortcut)})`
      : formatShortcut(shortcut)
    : title

  const button = (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      title={combinedTitle}
      aria-keyshortcuts={shortcut}
      className={[
        "inline-flex select-none items-center justify-center rounded-md font-medium",
        "transition-[background-color,border-color,color,opacity] duration-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950",
        "disabled:cursor-not-allowed",
        VARIANT[variant],
        SIZE[size],
        block ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {icon && <span className="flex shrink-0 items-center">{icon}</span>}
      {children && <span className="truncate">{children}</span>}
      {iconRight && <span className="flex shrink-0 items-center">{iconRight}</span>}
      {shortcut && (
        <Kbd
          variant={variant === "primary" ? "light" : "dark"}
          className="ml-1 opacity-70 group-hover:opacity-100"
        >
          {formatShortcut(shortcut)}
        </Kbd>
      )}
    </button>
  )

  // The shortcut is already visible as a chip on Buttons, so a tooltip only
  // earns its keep when `title` adds an explanation that won't fit on the
  // label itself.
  if (title) {
    return (
      <Tooltip label={title} shortcut={shortcut}>
        {button}
      </Tooltip>
    )
  }
  return button
})

/**
 * Square icon-only button. Accepts the same variant/size set as `Button`
 * but skips the text label.
 */
export const IconButton = forwardRef<HTMLButtonElement, ButtonProps>(function IconButton(
  { variant = "ghost", size = "sm", icon, shortcut, className = "", title, ...rest },
  ref,
) {
  const combinedTitle = shortcut
    ? title
      ? `${title} (${formatShortcut(shortcut)})`
      : formatShortcut(shortcut)
    : title

  const sizeCls =
    size === "xs"
      ? "h-6 w-6"
      : size === "md"
        ? "h-8 w-8"
        : "h-7 w-7"

  const button = (
    <button
      ref={ref}
      type="button"
      title={combinedTitle}
      aria-keyshortcuts={shortcut}
      className={[
        "inline-flex items-center justify-center rounded-md",
        "transition-[background-color,border-color,color,opacity] duration-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANT[variant],
        sizeCls,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {icon}
    </button>
  )

  // Icon-only buttons are nothing without their tooltip — always wrap when
  // the caller supplied a label or a shortcut so hover reveals both.
  if (title || shortcut) {
    return (
      <Tooltip label={title ?? formatShortcut(shortcut!)} shortcut={title ? shortcut : undefined}>
        {button}
      </Tooltip>
    )
  }
  return button
})
