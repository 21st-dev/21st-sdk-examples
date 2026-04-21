"use client"

import type { ReactNode } from "react"

/**
 * Segmented pill group — used in the top bar for resolution / aspect / fps
 * toggles. Each pill is a real <button> so it participates in tab order
 * and has a focus ring.
 */
export function PillGroup<T extends string | number>({
  value,
  options,
  onChange,
  label,
  ariaLabel,
}: {
  value: T
  options: Array<{ value: T; label: ReactNode; title?: string }>
  onChange: (v: T) => void
  label?: ReactNode
  ariaLabel?: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
        className="flex rounded-md border border-neutral-800 bg-neutral-900 p-0.5"
      >
        {options.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              title={opt.title}
              onClick={() => onChange(opt.value)}
              className={[
                "rounded px-2 py-0.5 text-[11px] font-medium transition-colors duration-100",
                "outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950",
                selected
                  ? "bg-neutral-100 text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-100",
              ].join(" ")}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
