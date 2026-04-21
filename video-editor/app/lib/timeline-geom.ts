/**
 * Timeline geometry helpers — px↔seconds math, snap-to-grid, track hit-testing.
 */

export interface TimelineGeom {
  /** How many pixels represent one second at the current zoom. */
  pxPerSec: number
  /** Track row height in pixels. */
  trackHeight: number
  /** Left gutter where track labels live. */
  gutterWidth: number
  /** Snap resolution in seconds (e.g. 0.1s). 0 to disable. */
  snap: number
}

export const DEFAULT_GEOM: TimelineGeom = {
  pxPerSec: 80,
  trackHeight: 56,
  gutterWidth: 0,
  snap: 0.1,
}

export function secondsToPx(s: number, g: TimelineGeom): number {
  return s * g.pxPerSec
}

export function pxToSeconds(px: number, g: TimelineGeom): number {
  return px / g.pxPerSec
}

export function snap(seconds: number, g: TimelineGeom): number {
  if (!g.snap || g.snap <= 0) return seconds
  return Math.round(seconds / g.snap) * g.snap
}

export function clampNonNegative(s: number): number {
  return s < 0 ? 0 : s
}

export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const total = Math.max(0, seconds)
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  const ms = Math.floor((total % 1) * 1000)
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(3, "0")
    .slice(0, 2)}`
}

export function tickInterval(g: TimelineGeom): number {
  // Aim for at least 80px between major ticks.
  const minPx = 80
  const candidates = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  for (const c of candidates) {
    if (secondsToPx(c, g) >= minPx) return c
  }
  return candidates[candidates.length - 1]!
}
