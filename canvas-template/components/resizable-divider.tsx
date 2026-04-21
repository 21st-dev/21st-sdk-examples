"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"

/**
 * A minimal vertical drag-handle for resizing an adjacent right-side panel.
 * Emits width changes via onChange (in px). Keeps width within [min, max].
 */
export function ResizableDivider({
  value,
  min = 280,
  max = 720,
  onChange,
  className,
}: {
  value: number
  min?: number
  max?: number
  onChange: (w: number) => void
  className?: string
}) {
  const [dragging, setDragging] = useState(false)
  const startXRef = useRef(0)
  const startWRef = useRef(value)

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      const dx = startXRef.current - e.clientX
      const next = Math.max(min, Math.min(max, startWRef.current + dx))
      onChange(next)
    },
    [min, max, onChange],
  )

  const stop = useCallback(() => {
    setDragging(false)
    document.removeEventListener("mousemove", onMouseMove)
    document.removeEventListener("mouseup", stop)
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [onMouseMove])

  useEffect(() => () => stop(), [stop])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={(e) => {
        startXRef.current = e.clientX
        startWRef.current = value
        setDragging(true)
        document.addEventListener("mousemove", onMouseMove)
        document.addEventListener("mouseup", stop)
        document.body.style.cursor = "col-resize"
        document.body.style.userSelect = "none"
      }}
      className={cn(
        "group relative w-1 shrink-0 cursor-col-resize",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors",
          dragging ? "bg-primary" : "group-hover:bg-primary/60",
        )}
      />
    </div>
  )
}
