"use client"

import { useMemo, useRef, useState } from "react"
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
import { IconButton } from "../ui"
import { ClipBlock } from "./ClipBlock"
import { Playhead } from "./Playhead"
import { Ruler } from "./Ruler"

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
  onAddTrack?: (kind: "video" | "audio") => void
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
  onAddTrack,
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

  const canvasRef = useRef<HTMLDivElement | null>(null)

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

  return (
    <div className="flex min-h-0 flex-col bg-neutral-950 text-neutral-100">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-neutral-800 px-3 text-[11px] text-neutral-400">
        <span className="font-medium text-neutral-200">Timeline</span>
        <span className="tabular-nums text-neutral-500">
          {duration > 0
            ? `${duration.toFixed(1)}s · ${project.clips.length} clip${project.clips.length === 1 ? "" : "s"}`
            : "empty"}
        </span>
        <span className="flex-1" />
        {onAddTrack && (
          <>
            <button
              type="button"
              onClick={() => onAddTrack("video")}
              className="rounded border border-neutral-700 px-1.5 h-6 text-[10px] font-medium text-neutral-300 hover:bg-white/5 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              title="Add video track"
            >
              + Video
            </button>
            <button
              type="button"
              onClick={() => onAddTrack("audio")}
              className="rounded border border-neutral-700 px-1.5 h-6 text-[10px] font-medium text-neutral-300 hover:bg-white/5 hover:text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
              title="Add audio track"
            >
              + Audio
            </button>
            <span className="mx-1 h-4 w-px bg-neutral-800" aria-hidden />
          </>
        )}
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
          {project.tracks.map((track) => (
            <div
              key={track.id}
              className="group flex h-[56px] items-center justify-between gap-1 border-b border-neutral-800 px-2 text-[11px] text-neutral-400"
            >
              <span className="truncate font-medium">{track.label ?? track.id}</span>
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
          ))}
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
                  {clipsOnTrack(project, track.id).map((clip) => (
                    <ClipBlock
                      key={clip.id}
                      clip={clip}
                      asset={getAsset(project, clip.assetId)}
                      tracks={project.tracks}
                      geom={geom}
                      selected={selectedClipId === clip.id}
                      onSelect={() => onSelectClip(clip.id)}
                      onChange={(patch) => onUpdateClip(clip.id, patch)}
                      onDragStart={() => onClipDragStart?.(clip.id)}
                    />
                  ))}
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
    </div>
  )
}
