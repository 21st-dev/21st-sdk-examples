"use client"

import { GripVertical, Music2, Video } from "lucide-react"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import {
  type Project,
  type Track,
  type UUID,
  clipsOnTrack,
  getAsset,
  projectDuration,
} from "../../lib/project"
import {
  DEFAULT_GEOM,
  type TimelineGeom,
  pxToSeconds,
  secondsToPx,
  snap,
} from "../../lib/timeline-geom"
import { hasDragPayload, peekDragKind, readDragPayload } from "../../lib/dnd"
import type { Clip } from "../../lib/project"
import { ClipInspectorFields } from "../clip-inspector-bar"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
  IconButton,
  formatShortcut,
} from "../ui"
import { ClipBlock } from "./ClipBlock"
import { Playhead } from "./Playhead"
import { Ruler } from "./Ruler"

/** Minimum distance from clip edges for a split to be meaningful. Mirrors
 * the guard inside `applyOp("split_clip")` so the UI button stays in sync. */
const SPLIT_MIN_OFFSET = 0.05

interface TimelineProps {
  project: Project
  selectedClipId: UUID | null
  onSelectClip: (clipId: UUID | null) => void
  onUpdateClip: (
    clipId: UUID,
    patch: { start?: number; length?: number; trimIn?: number; trackId?: string },
  ) => void
  onClipDragStart?: (clipId: UUID) => void
  onDropAsset: (assetId: string, trackId: UUID, startSeconds: number) => void
  playhead: number
  onSeek: (seconds: number) => void
  zoomIdx: number
  onChangeZoomIdx: (next: number) => void
  onRemoveTrack?: (trackId: UUID) => void
  onReorderTrack?: (trackId: UUID, toIndex: number) => void
  onAddTrack?: (kind: "video" | "audio") => void
  onSplitClip?: (clipId: UUID) => void
  onDuplicateClip?: (clipId: UUID) => void
  onDeleteClip?: (clipId: UUID) => void
  /** Inspector-style patch (may include volume, textOverlay), applied without
   * the drag no-overlap clamp. */
  onInspectorPatch?: (
    clipId: UUID,
    patch: {
      trimIn?: number
      length?: number
      start?: number
      volume?: number
      textOverlay?: Clip["textOverlay"] | null
    },
  ) => void
}

export const ZOOM_STEPS = [20, 40, 80, 120, 180, 260, 400]
export const MIN_ZOOM_IDX = 0
export const MAX_ZOOM_IDX = ZOOM_STEPS.length - 1

export function Timeline({
  project,
  selectedClipId,
  onSelectClip,
  onUpdateClip,
  onClipDragStart,
  onDropAsset,
  playhead,
  onSeek,
  zoomIdx,
  onChangeZoomIdx,
  onRemoveTrack,
  onReorderTrack,
  onAddTrack,
  onSplitClip,
  onDuplicateClip,
  onDeleteClip,
  onInspectorPatch,
}: TimelineProps) {
  const geom: TimelineGeom = useMemo(
    () => ({ ...DEFAULT_GEOM, pxPerSec: ZOOM_STEPS[zoomIdx]! }),
    [zoomIdx],
  )
  const duration = projectDuration(project)
  const canvasWidth = Math.max(secondsToPx(Math.max(duration, 10) + 4, geom), 800)

  const [dropTarget, setDropTarget] = useState<
    | { trackId: UUID; startSeconds: number; valid: boolean }
    | null
  >(null)

  const [trackDrag, setTrackDrag] = useState<
    | { trackId: UUID; originIndex: number; targetIndex: number }
    | null
  >(null)

  const canvasRef = useRef<HTMLDivElement | null>(null)

  // Trackpad pinch and Cmd/Ctrl + wheel zoom the timeline. React's onWheel
  // is passive, so preventDefault inside it is a no-op — we attach natively
  // with `passive: false` so we can block the browser's page-zoom behaviour.
  // A small deltaY accumulator prevents a single flick from stepping through
  // the entire zoom range at once on high-resolution trackpads.
  const zoomIdxRef = useRef(zoomIdx)
  zoomIdxRef.current = zoomIdx
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    let acc = 0
    const WHEEL_STEP = 40 // pixels of wheel delta per zoom step
    function onWheel(e: WheelEvent) {
      // Browsers report trackpad pinch as a wheel event with ctrlKey set;
      // Cmd/Ctrl + wheel is the conventional explicit gesture.
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      acc += e.deltaY
      while (Math.abs(acc) >= WHEEL_STEP) {
        const direction = acc > 0 ? -1 : 1 // deltaY > 0 = pinch out / scroll down → zoom out
        acc -= Math.sign(acc) * WHEEL_STEP
        const current = zoomIdxRef.current
        const next = Math.max(MIN_ZOOM_IDX, Math.min(MAX_ZOOM_IDX, current + direction))
        if (next === current) break
        onChangeZoomIdx(next)
      }
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [onChangeZoomIdx])

  function handleTrackDrop(e: React.DragEvent, track: Track) {
    const payload = readDragPayload(e.dataTransfer)
    if (!payload || payload.kind !== "asset") return
    const asset = project.assets.find((a) => a.id === payload.assetId)
    if (!asset) return
    // Reject cross-kind drops.
    if (asset.kind === "audio" && track.kind !== "audio") return
    if (asset.kind !== "audio" && track.kind !== "video") return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const secs = Math.max(0, snap(pxToSeconds(x, geom), geom))
    e.preventDefault()
    onDropAsset(asset.id, track.id, secs)
    setDropTarget(null)
  }

  function handleTrackDragOver(e: React.DragEvent, track: Track) {
    // `dragover` cannot call `getData` (spec-level), so we only peek the kind
    // encoded in the MIME types list.
    if (!hasDragPayload(e.dataTransfer)) return
    const dragKind = peekDragKind(e.dataTransfer)
    if (!dragKind) return
    const valid =
      (dragKind === "audio" && track.kind === "audio") ||
      (dragKind !== "audio" && dragKind !== "clip" && track.kind === "video")

    if (!valid) {
      e.dataTransfer.dropEffect = "none"
      setDropTarget({ trackId: track.id, startSeconds: 0, valid: false })
      return
    }

    // Must call preventDefault to signal "drop is allowed here".
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const secs = Math.max(0, snap(pxToSeconds(x, geom), geom))
    setDropTarget({ trackId: track.id, startSeconds: secs, valid: true })
  }

  function handleTrackDragLeave() {
    setDropTarget(null)
  }

  // ── track reorder (rail drag handle) ─────────────────────────────────
  function startTrackDrag(trackId: UUID, ev: React.PointerEvent) {
    if (!onReorderTrack || ev.button !== 0) return
    ev.preventDefault()
    ev.stopPropagation()
    const originIndex = project.tracks.findIndex((t) => t.id === trackId)
    if (originIndex === -1) return
    const originY = ev.clientY
    const rowHeight = 56

    function onMove(e: PointerEvent) {
      const deltaRows = Math.round((e.clientY - originY) / rowHeight)
      const target = Math.max(
        0,
        Math.min(project.tracks.length - 1, originIndex + deltaRows),
      )
      setTrackDrag({ trackId, originIndex, targetIndex: target })
    }
    function onUp() {
      setTrackDrag((drag) => {
        if (drag && drag.targetIndex !== drag.originIndex && onReorderTrack) {
          onReorderTrack(drag.trackId, drag.targetIndex)
        }
        return null
      })
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
    setTrackDrag({ trackId, originIndex, targetIndex: originIndex })
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
  }

  return (
    <div className="flex min-h-0 flex-col bg-neutral-950 text-neutral-100">
      <div className="flex h-9 shrink-0 items-center gap-2 overflow-x-auto border-b border-neutral-800 px-3 text-[11px] text-neutral-400">
        {selectedClipId && onInspectorPatch && onDeleteClip && (
          <ClipInspectorFields
            project={project}
            selectedClipId={selectedClipId}
            onUpdateClip={onInspectorPatch}
            onRemoveClip={onDeleteClip}
            onClose={() => onSelectClip(null)}
          />
        )}
        <span className="flex-1" />
        <IconButton
          size="xs"
          icon={<span aria-hidden>−</span>}
          onClick={() => onChangeZoomIdx(Math.max(MIN_ZOOM_IDX, zoomIdx - 1))}
          disabled={zoomIdx === MIN_ZOOM_IDX}
          aria-label="Zoom out"
          title="Zoom out"
          shortcut="-"
        />
        <span className="w-14 text-center tabular-nums text-neutral-500">
          {geom.pxPerSec}px/s
        </span>
        <IconButton
          size="xs"
          icon={<span aria-hidden>+</span>}
          onClick={() => onChangeZoomIdx(Math.min(MAX_ZOOM_IDX, zoomIdx + 1))}
          disabled={zoomIdx === MAX_ZOOM_IDX}
          aria-label="Zoom in"
          title="Zoom in"
          shortcut="+"
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[64px] shrink-0 flex-col border-r border-neutral-800 bg-neutral-950/80">
          <div className="h-7 shrink-0 border-b border-neutral-800" />
          {project.tracks.map((track, trackIdx) => {
            const isDragging = trackDrag?.trackId === track.id
            const isDropTargetRow =
              !!trackDrag &&
              trackDrag.trackId !== track.id &&
              trackDrag.targetIndex === trackIdx
            const canReorder = !!onReorderTrack && project.tracks.length > 1
            return (
              <div
                key={track.id}
                className={[
                  "group relative flex h-[56px] items-center justify-between gap-1 border-b border-neutral-800 px-2 text-[11px] transition-colors",
                  isDragging ? "bg-white/10 text-white" : "text-neutral-400",
                  isDropTargetRow ? "bg-blue-500/10" : "",
                ].join(" ")}
                title={track.label ?? track.id}
              >
                <div
                  onPointerDown={(e) => canReorder && startTrackDrag(track.id, e)}
                  className={[
                    "flex items-center gap-1",
                    canReorder ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "",
                  ].join(" ")}
                  title={canReorder ? "Drag to reorder" : undefined}
                >
                  {canReorder && (
                    <GripVertical
                      size={12}
                      className="text-neutral-600 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden
                    />
                  )}
                  {track.kind === "audio" ? (
                    <Music2 size={14} aria-label="Audio track" />
                  ) : (
                    <Video size={14} aria-label="Video track" />
                  )}
                </div>
                {onRemoveTrack && project.tracks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveTrack(track.id)}
                    className="opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    title="Remove track"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div
          ref={canvasRef}
          className="relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
          onClick={() => onSelectClip(null)}
        >
          <div className="relative" style={{ width: `${canvasWidth}px` }}>
            <Ruler duration={duration} geom={geom} playhead={playhead} onSeek={onSeek} />
            {project.tracks.map((track) => {
              const isDropActive = dropTarget?.trackId === track.id && dropTarget.valid
              return (
                <div
                  key={track.id}
                  className={`relative h-[56px] border-b border-neutral-800 transition-colors ${
                    track.kind === "audio" ? "bg-neutral-900/40" : "bg-neutral-950"
                  } ${isDropActive ? "bg-blue-500/10 ring-1 ring-inset ring-blue-500/50" : ""}`}
                  onDragOver={(e) => handleTrackDragOver(e, track)}
                  onDragLeave={handleTrackDragLeave}
                  onDrop={(e) => handleTrackDrop(e, track)}
                >
                  {clipsOnTrack(project, track.id).map((clip) => {
                    const clipBlock = (
                      <ClipBlock
                        clip={clip}
                        asset={getAsset(project, clip.assetId)}
                        tracks={project.tracks}
                        geom={geom}
                        selected={selectedClipId === clip.id}
                        onSelect={() => onSelectClip(clip.id)}
                        onChange={(patch) => onUpdateClip(clip.id, patch)}
                        onDragStart={() => onClipDragStart?.(clip.id)}
                      />
                    )
                    if (!onSplitClip && !onDuplicateClip && !onDeleteClip) {
                      return <Fragment key={clip.id}>{clipBlock}</Fragment>
                    }
                    const canSplit =
                      clip.start + SPLIT_MIN_OFFSET < playhead &&
                      playhead < clip.start + clip.length - SPLIT_MIN_OFFSET
                    return (
                      <ContextMenu
                        key={clip.id}
                        onOpenChange={(open) => open && onSelectClip(clip.id)}
                      >
                        <ContextMenuTrigger asChild>{clipBlock}</ContextMenuTrigger>
                        <ContextMenuContent>
                          {onSplitClip && (
                            <ContextMenuItem
                              disabled={!canSplit}
                              onSelect={() => onSplitClip(clip.id)}
                            >
                              Split at playhead
                              <ContextMenuShortcut>
                                {formatShortcut("S")}
                              </ContextMenuShortcut>
                            </ContextMenuItem>
                          )}
                          {onDuplicateClip && (
                            <ContextMenuItem onSelect={() => onDuplicateClip(clip.id)}>
                              Duplicate
                              <ContextMenuShortcut>
                                {formatShortcut("Cmd+D")}
                              </ContextMenuShortcut>
                            </ContextMenuItem>
                          )}
                          {onDeleteClip && (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onSelect={() => onDeleteClip(clip.id)}
                              >
                                Delete
                                <ContextMenuShortcut>
                                  {formatShortcut("Backspace")}
                                </ContextMenuShortcut>
                              </ContextMenuItem>
                            </>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    )
                  })}
                  {isDropActive && dropTarget && (
                    <div
                      className="pointer-events-none absolute top-1 bottom-1 w-0.5 bg-blue-400"
                      style={{ left: `${secondsToPx(dropTarget.startSeconds, geom)}px` }}
                    />
                  )}
                </div>
              )
            })}
            <Playhead seconds={playhead} geom={geom} />
          </div>
        </div>
      </div>

      {onAddTrack && (
        <div className="flex h-8 shrink-0 items-center gap-1 border-t border-neutral-800 px-3 text-[11px] text-neutral-400">
          <button
            type="button"
            onClick={() => onAddTrack("video")}
            className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2 h-6 text-[10px] font-medium text-neutral-300 hover:bg-white/5 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            title="Add video track"
          >
            <Video size={12} aria-hidden />
            <span>Add track</span>
          </button>
          <button
            type="button"
            onClick={() => onAddTrack("audio")}
            className="inline-flex items-center gap-1 rounded border border-neutral-700 px-2 h-6 text-[10px] font-medium text-neutral-300 hover:bg-white/5 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            title="Add audio track"
          >
            <Music2 size={12} aria-hidden />
            <span>Add track</span>
          </button>
        </div>
      )}

    </div>
  )
}
