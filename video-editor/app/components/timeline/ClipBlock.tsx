"use client"

import { forwardRef, useEffect, useRef, useState, type HTMLAttributes } from "react"
import type { Asset, Clip, Track } from "../../lib/project"
import { maxClipLength } from "../../lib/project"
import { setDragPayload } from "../../lib/dnd"
import {
  type TimelineGeom,
  clampNonNegative,
  pxToSeconds,
  secondsToPx,
  snap,
} from "../../lib/timeline-geom"

type DragMode = "move" | "trim-left" | "trim-right"

/**
 * Pass-through props forwarded onto the root `<div>`. Radix `asChild` (and
 * any future wrapper that needs to attach listeners / refs) relies on these
 * — without them the trigger has no element to instrument.
 */
type RootProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onPointerDown" | "onClick" | "onChange" | "onDragStart" | "style" | "className"
>

export interface ClipBlockProps extends RootProps {
  clip: Clip
  asset: Asset | undefined
  tracks: Track[]
  geom: TimelineGeom
  selected: boolean
  onSelect: () => void
  /**
   * Called continuously while the user drags. Batches trim+move+trackId so
   * the reducer sees one coherent state.
   */
  onChange: (next: {
    start?: number
    length?: number
    trimIn?: number
    trackId?: string
  }) => void
  /** Called once at the start of a drag so history can snapshot. */
  onDragStart?: () => void
}

const KIND_CLASSES: Record<string, string> = {
  video: "bg-blue-500/25 border-blue-400/60 hover:bg-blue-500/30",
  image: "bg-amber-500/25 border-amber-400/60 hover:bg-amber-500/30",
  audio: "bg-emerald-500/25 border-emerald-400/60 hover:bg-emerald-500/30",
}

export const ClipBlock = forwardRef<HTMLDivElement, ClipBlockProps>(function ClipBlock(
  {
    clip,
    asset,
    tracks,
    geom,
    selected,
    onSelect,
    onChange,
    onDragStart,
    ...rootProps
  },
  ref,
) {
  const [dragMode, setDragMode] = useState<DragMode | null>(null)
  const dragRef = useRef<{
    mode: DragMode
    originClientX: number
    originClientY: number
    originClip: { start: number; length: number; trimIn: number; trackId: string }
  } | null>(null)

  useEffect(() => {
    if (!dragMode) return

    function onMove(ev: PointerEvent) {
      if (!dragRef.current) return
      const { mode, originClientX, originClientY, originClip } = dragRef.current
      const dx = ev.clientX - originClientX
      const dy = ev.clientY - originClientY
      const ds = pxToSeconds(dx, geom)

      if (mode === "move") {
        const nextStart = clampNonNegative(snap(originClip.start + ds, geom))

        // Track switching: compute target track by vertical offset. Tracks are
        // `geom.trackHeight` px tall and rendered in the same order as `tracks`.
        const originIdx = tracks.findIndex((t) => t.id === originClip.trackId)
        if (originIdx >= 0) {
          const offsetRows = Math.round(dy / geom.trackHeight)
          const targetIdx = Math.max(
            0,
            Math.min(tracks.length - 1, originIdx + offsetRows),
          )
          const targetTrack = tracks[targetIdx]!
          // Forbid moving audio asset onto video track and vice-versa. The
          // reducer would accept it, but ffmpeg wouldn't do the right thing
          // with an audio file on a video track.
          const kind = asset?.kind
          const allowed =
            !kind ||
            (kind === "audio" && targetTrack.kind === "audio") ||
            (kind !== "audio" && targetTrack.kind === "video")
          onChange({
            start: nextStart,
            trackId: allowed ? targetTrack.id : originClip.trackId,
          })
          return
        }
        onChange({ start: nextStart })
      } else if (mode === "trim-left") {
        const maxTrim = asset?.duration ?? Number.POSITIVE_INFINITY
        const desired = originClip.trimIn + ds
        const newTrim = Math.min(Math.max(0, desired), maxTrim - 0.1)
        const deltaTrim = newTrim - originClip.trimIn
        const newStart = clampNonNegative(snap(originClip.start + deltaTrim, geom))
        const newLength = Math.max(0.1, originClip.length - deltaTrim)
        onChange({ start: newStart, trimIn: newTrim, length: newLength })
      } else {
        const max = maxClipLength(asset, originClip.trimIn)
        const nextLength = Math.min(
          Math.max(0.1, snap(originClip.length + ds, geom)),
          max,
        )
        onChange({ length: nextLength })
      }
    }

    function onUp() {
      dragRef.current = null
      setDragMode(null)
    }

    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [dragMode, asset, geom, onChange, tracks])

  function startDrag(mode: DragMode, ev: React.PointerEvent) {
    // Only the primary (left) button drags; right-click opens the context menu.
    if (ev.button !== 0) return
    ev.preventDefault()
    ev.stopPropagation()
    // `setPointerCapture` throws `NotFoundError` if the pointer isn't active
    // (e.g. synthetic events, already-released pointers). It's a
    // nice-to-have, so swallow the error rather than aborting the drag.
    try {
      ;(ev.target as HTMLElement).setPointerCapture?.(ev.pointerId)
    } catch {
      /* ignore */
    }
    dragRef.current = {
      mode,
      originClientX: ev.clientX,
      originClientY: ev.clientY,
      originClip: {
        start: clip.start,
        length: clip.length,
        trimIn: clip.trimIn,
        trackId: clip.trackId,
      },
    }
    setDragMode(mode)
    onSelect()
    onDragStart?.()
  }

  const kind = asset?.kind ?? "video"
  const colorCls = KIND_CLASSES[kind] ?? KIND_CLASSES.video
  const width = Math.max(12, secondsToPx(clip.length, geom))
  const left = secondsToPx(clip.start, geom)
  const title = asset?.label ?? clip.assetId

  return (
    <div
      {...rootProps}
      ref={ref}
      className={`group absolute top-1 bottom-1 rounded-md border transition-colors ${colorCls} ${
        selected ? "ring-2 ring-white/80" : "ring-0"
      } ${dragMode ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ left: `${left}px`, width: `${width}px` }}
      onPointerDown={(e) => startDrag("move", e)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      // Native HTML drag is disabled on the block itself; we use pointer drag
      // for positional edits. But we still set a payload in case someone
      // drags it into a drop zone like a waste-bin in a future iteration.
      draggable={false}
      onDragStart={(e) => {
        setDragPayload(e.dataTransfer, { kind: "clip", clipId: clip.id })
      }}
    >
      <div className="flex h-full w-full items-center gap-1 overflow-hidden px-2 text-[11px] text-neutral-100">
        <span className="truncate font-medium">{title}</span>
        {clip.textOverlay?.text && (
          <span className="shrink-0 rounded bg-white/20 px-1 text-[9px] uppercase tracking-wide">
            T
          </span>
        )}
        {kind === "audio" &&
          typeof clip.volume === "number" &&
          clip.volume !== 1 && (
            <span className="shrink-0 rounded bg-white/20 px-1 text-[9px]">
              {Math.round(clip.volume * 100)}%
            </span>
          )}
      </div>

      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 opacity-0 transition-opacity group-hover:opacity-100"
        onPointerDown={(e) => startDrag("trim-left", e)}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/30 opacity-0 transition-opacity group-hover:opacity-100"
        onPointerDown={(e) => startDrag("trim-right", e)}
      />
    </div>
  )
})
