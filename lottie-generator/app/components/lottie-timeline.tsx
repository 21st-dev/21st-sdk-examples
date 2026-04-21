"use client"

import { useMemo, useRef, useState } from "react"
import type { RenderLottiePayload } from "../types"

function PauseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  )
}

function RewindIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="11 19 2 12 11 5 11 19" />
      <polygon points="22 19 13 12 22 5 22 19" />
    </svg>
  )
}

function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`
}

function tickInterval(totalSeconds: number): number {
  // Aim for 4–8 major ticks across the visible duration.
  const candidates = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60]
  for (const c of candidates) {
    if (totalSeconds / c <= 10) return c
  }
  return candidates[candidates.length - 1]
}

const LAYER_COLORS = [
  "bg-fuchsia-500/70 border-fuchsia-400",
  "bg-cyan-500/70 border-cyan-400",
  "bg-amber-500/70 border-amber-400",
  "bg-emerald-500/70 border-emerald-400",
  "bg-violet-500/70 border-violet-400",
  "bg-rose-500/70 border-rose-400",
  "bg-sky-500/70 border-sky-400",
  "bg-lime-500/70 border-lime-400",
]

interface LayerInfo {
  ind: number
  name: string
  ip: number
  op: number
  type: string
}

function extractLayers(payload: RenderLottiePayload): LayerInfo[] {
  const raw = (payload.animation as { layers?: unknown[] }).layers
  if (!Array.isArray(raw)) return []
  const animIp = typeof (payload.animation as { ip?: unknown }).ip === "number" ? (payload.animation as { ip: number }).ip : 0
  const animOp = typeof (payload.animation as { op?: unknown }).op === "number" ? (payload.animation as { op: number }).op : payload.durationSeconds * payload.frameRate
  return raw.map((layer, i) => {
    const l = layer as Record<string, unknown>
    const ind = typeof l.ind === "number" ? (l.ind as number) : i + 1
    const name = typeof l.nm === "string" && l.nm ? (l.nm as string) : `Layer ${ind}`
    const ip = typeof l.ip === "number" ? (l.ip as number) : animIp
    const op = typeof l.op === "number" ? (l.op as number) : animOp
    const ty = typeof l.ty === "number" ? String(l.ty) : ""
    const typeMap: Record<string, string> = { "0": "pre-comp", "1": "solid", "2": "image", "3": "null", "4": "shape", "5": "text" }
    return { ind, name, ip, op, type: typeMap[ty] ?? "layer" }
  })
}

interface LottieTimelineProps {
  payload: RenderLottiePayload
  currentFrame: number
  paused: boolean
  onSeek: (frame: number) => void
  onHoverFrame?: (frame: number | null) => void
  onTogglePlay: () => void
  onRewind: () => void
}

export function LottieTimeline({ payload, currentFrame, paused, onSeek, onHoverFrame, onTogglePlay, onRewind }: LottieTimelineProps) {
  const rowsRef = useRef<HTMLDivElement | null>(null)
  const [draggingRow, setDraggingRow] = useState(false)
  const [hoverFrame, setHoverFrame] = useState<number | null>(null)

  const layers = useMemo(() => extractLayers(payload), [payload])
  const totalFrames = Math.max(1, Math.round(payload.durationSeconds * payload.frameRate))
  const totalSeconds = payload.durationSeconds
  const fr = payload.frameRate

  const playheadPct = Math.min(100, Math.max(0, (currentFrame / totalFrames) * 100))
  const currentSeconds = currentFrame / fr

  const step = tickInterval(totalSeconds)
  const ticks = useMemo(() => {
    const out: number[] = []
    for (let t = 0; t <= totalSeconds + step * 0.001; t += step) {
      out.push(Number(t.toFixed(3)))
    }
    return out
  }, [totalSeconds, step])

  function seekFromX(clientX: number, rect: DOMRect) {
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    onSeek(pct * totalFrames)
  }

  function frameFromX(clientX: number, rect: DOMRect) {
    const x = clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    return pct * totalFrames
  }

  const hoverPct = hoverFrame !== null ? Math.min(100, Math.max(0, (hoverFrame / totalFrames) * 100)) : null
  const hoverSeconds = hoverFrame !== null ? hoverFrame / fr : 0

  return (
    <div className="flex shrink-0 flex-col overflow-hidden rounded-md border border-black/[0.08] bg-black/[0.92] text-neutral-100 dark:border-white/[0.08]">
      <div className="flex h-8 items-center gap-2 border-b border-white/[0.08] px-3 text-[11px] text-neutral-400">
        <span className="font-medium uppercase tracking-widest text-[10px] text-neutral-300">Timeline</span>
        <span className="text-neutral-500">·</span>
        <span className="tabular-nums text-neutral-500">
          {totalSeconds.toFixed(2)}s · {layers.length} layer{layers.length === 1 ? "" : "s"} · {fr}fps
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={onRewind}
          className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Restart"
          title="Restart"
        >
          <RewindIcon />
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          className="flex h-6 w-6 items-center justify-center rounded bg-white text-black transition-opacity hover:opacity-90 active:scale-[0.97]"
          aria-label={paused ? "Play" : "Pause"}
          title={paused ? "Play" : "Pause"}
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <span className="ml-1 shrink-0 tabular-nums text-neutral-500">
          {formatTimestamp(currentSeconds)} / {formatTimestamp(totalSeconds)}
        </span>
      </div>

      <div className="flex min-h-0">
        <div className="flex w-[80px] shrink-0 flex-col border-r border-white/[0.08] bg-black/40">
          <div className="h-6 shrink-0 border-b border-white/[0.08]" />
          {layers.slice(0, 6).map((layer) => (
            <div
              key={layer.ind}
              className="flex h-7 items-center gap-1 border-b border-white/[0.06] px-2 text-[10px] text-neutral-400 last:border-b-0"
              title={`${layer.name} (${layer.type})`}
            >
              <span className="truncate">{layer.name}</span>
            </div>
          ))}
          {layers.length > 6 && (
            <div className="flex h-7 items-center px-2 text-[10px] text-neutral-500">
              +{layers.length - 6} more
            </div>
          )}
        </div>

        <div
          ref={rowsRef}
          className="relative flex-1 cursor-crosshair select-none"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return
            const el = e.currentTarget
            el.setPointerCapture(e.pointerId)
            setDraggingRow(true)
            seekFromX(e.clientX, el.getBoundingClientRect())
          }}
          onPointerMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const f = frameFromX(e.clientX, rect)
            setHoverFrame(f)
            onHoverFrame?.(f)
            if (draggingRow) seekFromX(e.clientX, rect)
          }}
          onPointerEnter={(e) => {
            const f = frameFromX(e.clientX, e.currentTarget.getBoundingClientRect())
            setHoverFrame(f)
            onHoverFrame?.(f)
          }}
          onPointerLeave={() => {
            if (!draggingRow) {
              setHoverFrame(null)
              onHoverFrame?.(null)
            }
          }}
          onPointerUp={(e) => {
            setDraggingRow(false)
            try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
          }}
        >
          <div className="relative h-6 border-b border-white/[0.08] bg-white/[0.02] text-[10px] text-neutral-500">
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 border-l border-white/[0.08]"
                style={{ left: `${(t / totalSeconds) * 100}%` }}
              >
                <span className="absolute left-1 top-0.5 select-none tabular-nums text-neutral-500">
                  {t === 0 ? "0s" : `${t.toFixed(t < 1 ? 2 : 1)}s`}
                </span>
              </div>
            ))}
          </div>

          {layers.slice(0, 6).map((layer, i) => {
            const startPct = Math.max(0, Math.min(100, (layer.ip / totalFrames) * 100))
            const widthPct = Math.max(0.5, Math.min(100 - startPct, ((layer.op - layer.ip) / totalFrames) * 100))
            const colorCls = LAYER_COLORS[i % LAYER_COLORS.length]
            return (
              <div
                key={layer.ind}
                className="relative h-7 border-b border-white/[0.06] last:border-b-0"
              >
                <div
                  className={`absolute top-1 bottom-1 rounded-sm border ${colorCls} shadow-sm`}
                  style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                >
                  <span className="pointer-events-none absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white/90 truncate">
                    {layer.name}
                  </span>
                </div>
              </div>
            )
          })}

          {hoverPct !== null && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-white/40"
              style={{ left: `${hoverPct}%` }}
            >
              <div
                className={`absolute -top-5 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-black shadow ${
                  hoverPct > 85 ? "right-1 -translate-x-0" : "left-1"
                }`}
              >
                {formatTimestamp(hoverSeconds)}
              </div>
            </div>
          )}

          <div
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500/90"
            style={{ left: `${playheadPct}%` }}
          >
            <div className="absolute -left-[5px] -top-0.5 h-2.5 w-[11px] rounded-sm bg-red-500 shadow" />
          </div>
        </div>
      </div>
    </div>
  )
}
