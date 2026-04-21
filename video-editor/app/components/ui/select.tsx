"use client"

import { forwardRef, type SelectHTMLAttributes } from "react"

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  size?: "xs" | "sm" | "md"
}

/**
 * Native <select> with a consistent chevron, focus ring, and dark-mode styling.
 *
 * Hides the browser's built-in arrow (`appearance: none`) and draws a
 * right-aligned chevron via inline SVG data-URL so we don't depend on a
 * pseudo-element wrapper.
 */
const CHEVRON_SVG = encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="rgb(163,163,163)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
)

const SIZE: Record<"xs" | "sm" | "md", string> = {
  xs: "h-6 pl-2 pr-6 text-[11px] bg-[length:10px_10px] bg-[position:right_6px_center]",
  sm: "h-7 pl-2.5 pr-7 text-[12px] bg-[length:12px_12px] bg-[position:right_8px_center]",
  md: "h-8 pl-3 pr-8 text-[13px] bg-[length:14px_14px] bg-[position:right_10px_center]",
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = "sm", className = "", style, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={[
        "appearance-none rounded-md border border-neutral-700 bg-neutral-900 text-neutral-100",
        "bg-no-repeat",
        "transition-[background-color,border-color] duration-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950 focus:border-neutral-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        SIZE[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,${CHEVRON_SVG}")`,
        ...style,
      }}
      {...rest}
    />
  )
})
