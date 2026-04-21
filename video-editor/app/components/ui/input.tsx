"use client"

import { forwardRef, type InputHTMLAttributes } from "react"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: "xs" | "sm" | "md"
}

const SIZE: Record<"xs" | "sm" | "md", string> = {
  xs: "h-6 px-2 text-[11px]",
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3 text-[13px]",
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { inputSize = "sm", className = "", type = "text", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={[
        "rounded-md border border-neutral-700 bg-neutral-900 text-neutral-100 placeholder:text-neutral-600",
        "transition-[background-color,border-color] duration-100",
        "outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950 focus:border-neutral-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        // number inputs get tabular-nums so values don't jiggle
        type === "number" ? "text-right tabular-nums" : "",
        SIZE[inputSize],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    />
  )
})
