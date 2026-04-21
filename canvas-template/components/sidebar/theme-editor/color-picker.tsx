"use client"

import { useEffect, useRef, useState } from "react"
import { Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PRIMARY_PRESETS } from "@/lib/theme-store"
import { cn } from "@/lib/cn"

/** Validate a hex color. */
function isHex(v: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)
}

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const [raw, setRaw] = useState(value)
  const sync = useRef(false)
  useEffect(() => {
    if (!sync.current) setRaw(value)
    sync.current = false
  }, [value])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <label
          htmlFor="theme-primary-picker"
          className="relative inline-block h-7 w-7 cursor-pointer overflow-hidden rounded-md border border-border"
          style={{ background: value }}
        >
          <input
            id="theme-primary-picker"
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          value={raw}
          onChange={(e) => {
            sync.current = true
            setRaw(e.target.value)
            if (isHex(e.target.value)) onChange(e.target.value)
          }}
          className="h-7 font-mono text-[11px]"
          placeholder="#000000"
        />
      </div>

      <div className="grid grid-cols-8 gap-1">
        {PRIMARY_PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "relative h-6 w-6 overflow-hidden rounded-md border border-border/60 transition-transform hover:scale-110",
              value.toLowerCase() === c.toLowerCase() &&
                "ring-2 ring-offset-2 ring-offset-background",
            )}
            style={{
              background: c,
              boxShadow:
                value.toLowerCase() === c.toLowerCase()
                  ? `0 0 0 2px ${c}80`
                  : undefined,
            }}
            aria-label={`Pick ${c}`}
          >
            {value.toLowerCase() === c.toLowerCase() && (
              <Check className="absolute inset-0 m-auto !size-3 text-white drop-shadow" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
