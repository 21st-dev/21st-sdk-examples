"use client"

import { type TimelineGeom, secondsToPx } from "../../lib/timeline-geom"

export function Playhead({
  seconds,
  geom,
}: {
  seconds: number
  geom: TimelineGeom
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500/90"
      style={{ left: `${secondsToPx(seconds, geom)}px` }}
    >
      <div className="absolute -left-[5px] -top-1 h-2 w-[11px] rounded-sm bg-red-500 shadow" />
    </div>
  )
}
