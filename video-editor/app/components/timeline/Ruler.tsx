"use client"

import {
  type TimelineGeom,
  formatTimestamp,
  secondsToPx,
  tickInterval,
} from "../../lib/timeline-geom"

interface RulerProps {
  duration: number
  geom: TimelineGeom
  playhead: number
  onSeek?: (seconds: number) => void
}

export function Ruler({ duration, geom, playhead, onSeek }: RulerProps) {
  const visibleEnd = Math.max(duration, playhead, 5)
  const step = tickInterval(geom)
  const ticks: number[] = []
  for (let s = 0; s <= visibleEnd + step; s += step) ticks.push(Number(s.toFixed(3)))

  return (
    <div
      className="relative h-7 shrink-0 border-b border-neutral-800 bg-neutral-900 text-[10px] text-neutral-400"
      style={{ minWidth: `${secondsToPx(visibleEnd, geom) + 24}px` }}
      onClick={(e) => {
        if (!onSeek) return
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
        const x = e.clientX - rect.left
        onSeek(Math.max(0, x / geom.pxPerSec))
      }}
    >
      {ticks.map((t) => {
        const major = Math.abs(t - Math.round(t / step) * step) < 0.001
        return (
          <div
            key={t}
            className="absolute top-0 bottom-0 border-l border-neutral-700/70"
            style={{ left: `${secondsToPx(t, geom)}px` }}
          >
            {major && (
              <span className="absolute left-1 top-0.5 select-none">
                {formatTimestamp(t).replace(/\.\d{2}$/, "")}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
