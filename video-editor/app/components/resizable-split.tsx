"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface ResizableSplitProps {
  /** Percent 0..100 for the top pane. */
  initialTopPct?: number
  minTopPct?: number
  maxTopPct?: number
  storageKey?: string
  top: React.ReactNode
  bottom: React.ReactNode
}

/**
 * Vertical 2-pane splitter with a draggable horizontal divider.
 *
 * Sizes are kept as a percentage of the outer container's height so the
 * split survives window resizes. Optionally persists the last ratio in
 * `localStorage[storageKey]`.
 */
export function ResizableSplit({
  initialTopPct = 55,
  minTopPct = 20,
  maxTopPct = 85,
  storageKey,
  top,
  bottom,
}: ResizableSplitProps) {
  const [topPct, setTopPct] = useState<number>(initialTopPct)
  const hydratedRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    originY: number
    originTopPct: number
    containerHeight: number
  } | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!storageKey || hydratedRef.current) return
    hydratedRef.current = true
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const v = Number.parseFloat(stored)
        if (Number.isFinite(v)) setTopPct(Math.min(maxTopPct, Math.max(minTopPct, v)))
      }
    } catch {}
  }, [storageKey, minTopPct, maxTopPct])

  useEffect(() => {
    if (!storageKey) return
    try {
      localStorage.setItem(storageKey, String(topPct))
    } catch {}
  }, [topPct, storageKey])

  useEffect(() => {
    if (!dragging) return

    function onMove(e: PointerEvent) {
      const d = dragRef.current
      if (!d) return
      const deltaY = e.clientY - d.originY
      const deltaPct = (deltaY / d.containerHeight) * 100
      setTopPct(Math.min(maxTopPct, Math.max(minTopPct, d.originTopPct + deltaPct)))
    }
    function onUp() {
      dragRef.current = null
      setDragging(false)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [dragging, minTopPct, maxTopPct])

  const handleDown = useCallback(
    (e: React.PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      dragRef.current = {
        originY: e.clientY,
        originTopPct: topPct,
        containerHeight: rect.height,
      }
      setDragging(true)
    },
    [topPct],
  )

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 overflow-hidden" style={{ height: `${topPct}%` }}>
        {top}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-valuenow={Math.round(topPct)}
        aria-valuemin={minTopPct}
        aria-valuemax={maxTopPct}
        tabIndex={0}
        onPointerDown={handleDown}
        onDoubleClick={() => setTopPct(initialTopPct)}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            setTopPct((v) => Math.max(minTopPct, v - 2))
            e.preventDefault()
          } else if (e.key === "ArrowDown") {
            setTopPct((v) => Math.min(maxTopPct, v + 2))
            e.preventDefault()
          }
        }}
        className={`relative h-1.5 shrink-0 cursor-row-resize bg-neutral-800 transition-colors ${
          dragging ? "bg-blue-500/60" : "hover:bg-neutral-700"
        }`}
        title="Drag to resize · double-click to reset"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-0.5 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-600" />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{bottom}</div>
    </div>
  )
}
