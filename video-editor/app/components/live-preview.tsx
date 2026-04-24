"use client"

/**
 * Live scrub preview.
 *
 * Plays the timeline directly in the browser using HTML5 `<video>` / `<audio>`
 * elements keyed off the current playhead, with no round-trip to ffmpeg for
 * iteration. The agent's `render_project` is only needed when the user wants
 * a final exported MP4.
 *
 * Limitations (intentional, to keep things snappy):
 *  - Only the topmost video track is drawn; overlay compositing is shown in
 *    the rendered preview after an explicit Render.
 *  - Audio mix: we play one <audio> per audio track at the clip that covers
 *    the playhead, with its `volume` from the project. No cross-fades.
 *  - Text overlays / drawtext / filters are a visual indicator only; they
 *    show as a caption box, but the final rendered version is the ffmpeg one.
 */

import { ChevronsRight, Pause, Play, Redo2, SkipBack, Undo2 } from "lucide-react"
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react"
import { Button, IconButton } from "./ui"
import {
  type Clip,
  type Project,
  clipsOnTrack,
  getAsset,
  projectDuration,
} from "../lib/project"
import type { RenderStatus, RenderUpload } from "../lib/render"
import { formatTimestamp } from "../lib/timeline-geom"

export type { RenderStatus } from "../lib/render"

export interface LivePreviewHandle {
  seek: (seconds: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  isPlaying: () => boolean
}

interface LivePreviewProps {
  project: Project
  /** Playhead position in seconds. Must be driven by parent so UI + timeline agree. */
  playhead: number
  /** Parent-owned setter the preview calls during playback. */
  onPlayhead: (seconds: number) => void
  /** The track owning the currently selected clip. If set, its clip at the
   * playhead wins compositing even against higher tracks — so the user always
   * sees what they are editing. */
  selectedTrackId?: string | null
  /** When the render URL is set, the player can show the actual MP4 instead of scrub mode. */
  renderedUrl: string | null
  renderStatus: RenderStatus
  renderError?: string | null
  lastUpload?: RenderUpload | null
  onRender?: (preview: boolean) => void
  renderBusy: boolean
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

function findActiveClip(
  project: Project,
  kind: "video" | "audio",
  t: number,
  priorityTrackId?: string | null,
): Clip | null {
  // Walk top to bottom and return the first hit so the uppermost track wins
  // (standard Premiere/DaVinci compositing). When the user has a clip
  // selected, pin that track to the front — they always see what they are
  // editing even if a higher track covers the playhead.
  const filtered = project.tracks.filter((tr) => tr.kind === kind)
  const ordered =
    priorityTrackId && filtered.some((t) => t.id === priorityTrackId)
      ? [
          ...filtered.filter((t) => t.id === priorityTrackId),
          ...filtered.filter((t) => t.id !== priorityTrackId),
        ]
      : filtered
  for (const track of ordered) {
    for (const c of clipsOnTrack(project, track.id)) {
      if (t >= c.start && t < c.start + c.length) return c
    }
  }
  return null
}

export const LivePreview = forwardRef<LivePreviewHandle, LivePreviewProps>(
  function LivePreview(
    { project, playhead, onPlayhead, selectedTrackId, renderedUrl, renderStatus, renderError, lastUpload, onRender, renderBusy, onUndo, onRedo, canUndo, canRedo },
    ref,
  ) {
    const [mode, setMode] = useState<"live" | "rendered">("live")
    const [isPlaying, setIsPlaying] = useState(false)
    const rafRef = useRef<number | null>(null)
    const lastTickRef = useRef<number>(0)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const renderedVideoRef = useRef<HTMLVideoElement | null>(null)
    const audioRefsRef = useRef<Map<string, HTMLAudioElement>>(new Map())

    const duration = useMemo(() => projectDuration(project), [project])
    const aspect =
      project.output.aspectRatio === "9:16"
        ? "9 / 16"
        : project.output.aspectRatio === "1:1"
          ? "1 / 1"
          : "16 / 9"

    // Auto-switch to rendered mode right after a render completes, but let the
    // user flip back to live to keep editing.
    useEffect(() => {
      if (renderedUrl) setMode("rendered")
    }, [renderedUrl])

    // Any project change while in rendered mode implies the render is stale;
    // flip back to live so the user sees their edit immediately. We key on
    // the full project ref; `setMode("live")` is a no-op when already "live"
    // so this is safe to run on every edit.
    useEffect(() => {
      if (!renderedUrl) return
      setMode("live")
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project])

    // Active clip (topmost video/image on any video track; the selected
    // clip's track wins ties).
    const activeVideoClip = useMemo(
      () => findActiveClip(project, "video", playhead, selectedTrackId),
      [project, playhead, selectedTrackId],
    )
    const activeAudioClips = useMemo(() => {
      const result: Array<{ clip: Clip; trackId: string }> = []
      for (const track of project.tracks) {
        if (track.kind !== "audio") continue
        const c = clipsOnTrack(project, track.id).find(
          (c) => playhead >= c.start && playhead < c.start + c.length,
        )
        if (c) result.push({ clip: c, trackId: track.id })
      }
      return result
    }, [project, playhead])
    const activeAsset = activeVideoClip ? getAsset(project, activeVideoClip.assetId) : undefined

    // ── seek video when playhead or clip changes ──────────────────────────
    useEffect(() => {
      if (mode !== "live") return
      const v = videoRef.current
      if (!v || !activeVideoClip) return
      const local = playhead - activeVideoClip.start + activeVideoClip.trimIn
      // Only seek if off by more than a frame so we don't fight playback.
      if (Math.abs(v.currentTime - local) > 0.15) {
        try {
          v.currentTime = Math.max(0, local)
        } catch {}
      }
    }, [mode, playhead, activeVideoClip])

    // ── seek each active audio element ────────────────────────────────────
    useEffect(() => {
      if (mode !== "live") return
      for (const { clip } of activeAudioClips) {
        const asset = getAsset(project, clip.assetId)
        if (!asset) continue
        const a = audioRefsRef.current.get(clip.id)
        if (!a) continue
        const local = playhead - clip.start + clip.trimIn
        if (Math.abs(a.currentTime - local) > 0.2) {
          try {
            a.currentTime = Math.max(0, local)
          } catch {}
        }
        a.volume = clip.volume ?? 1
      }
    }, [mode, playhead, activeAudioClips, project])

    // ── play/pause sync ───────────────────────────────────────────────────
    useEffect(() => {
      if (mode !== "live") return
      if (isPlaying) {
        videoRef.current?.play().catch(() => {})
        for (const { clip } of activeAudioClips) {
          const a = audioRefsRef.current.get(clip.id)
          a?.play().catch(() => {})
        }
      } else {
        videoRef.current?.pause()
        for (const a of audioRefsRef.current.values()) a.pause()
      }
    }, [isPlaying, mode, activeAudioClips])

    // Keep the latest playhead in a ref so the RAF driver reads fresh values
    // without re-subscribing every frame (which would cause cascading rerenders).
    const playheadRef = useRef(playhead)
    playheadRef.current = playhead
    const durationRef = useRef(duration)
    durationRef.current = duration

    // ── driver loop: advance playhead, stop at project end ────────────────
    useEffect(() => {
      if (!isPlaying) return
      lastTickRef.current = performance.now()

      function tick(now: number) {
        const dt = (now - lastTickRef.current) / 1000
        lastTickRef.current = now
        let nextPh = playheadRef.current + dt
        const total = durationRef.current
        if (total > 0 && nextPh >= total) {
          nextPh = total
          setIsPlaying(false)
          onPlayhead(nextPh)
          return
        }
        onPlayhead(nextPh)
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }, [isPlaying, onPlayhead])

    useImperativeHandle(
      ref,
      () => ({
        seek: (s) => onPlayhead(Math.max(0, Math.min(duration, s))),
        play: () => setIsPlaying(true),
        pause: () => setIsPlaying(false),
        togglePlay: () => setIsPlaying((p) => !p),
        isPlaying: () => isPlaying,
      }),
      [duration, isPlaying, onPlayhead],
    )

    const showRendered = mode === "rendered" && !!renderedUrl

    return (
      <div className="flex h-full min-h-0 flex-col bg-black">
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
          <div
            className="relative flex h-full items-center justify-center overflow-hidden rounded-md bg-black shadow-2xl"
            style={{ aspectRatio: aspect, maxWidth: "100%", maxHeight: "100%" }}
          >
            {/* Rendered MP4 layer */}
            {showRendered && renderedUrl && (
              <video
                ref={renderedVideoRef}
                key={renderedUrl}
                src={renderedUrl}
                playsInline
                controls
                className="h-full w-full"
              />
            )}

            {/* Live scrub layer */}
            {!showRendered && activeVideoClip && activeAsset && activeAsset.kind === "video" && (
              <video
                ref={videoRef}
                key={activeAsset.url}
                src={activeAsset.url}
                playsInline
                muted
                preload="metadata"
                className="h-full w-full object-contain"
              />
            )}
            {!showRendered && activeVideoClip && activeAsset && activeAsset.kind === "image" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeAsset.url}
                alt={activeAsset.label}
                className="h-full w-full object-contain"
              />
            )}
            {!showRendered && !activeVideoClip && (
              <div className="flex h-full w-full items-center justify-center text-center text-xs text-neutral-500">
                {duration > 0
                  ? "Move the playhead to a clip"
                  : "Drop a clip on the timeline to begin"}
              </div>
            )}

            {/* Text overlay indicator (visual cue, not final render) */}
            {!showRendered && activeVideoClip?.textOverlay?.text && (
              <div
                className={`pointer-events-none absolute left-1/2 -translate-x-1/2 max-w-[80%] rounded px-3 py-1 text-center text-sm font-medium text-white ${
                  activeVideoClip.textOverlay.position === "top"
                    ? "top-4"
                    : activeVideoClip.textOverlay.position === "center"
                      ? "top-1/2 -translate-y-1/2"
                      : "bottom-4"
                }`}
                style={{
                  backgroundColor: "rgba(0,0,0,0.5)",
                  color: activeVideoClip.textOverlay.color ?? "white",
                }}
              >
                {activeVideoClip.textOverlay.text}
              </div>
            )}

            {/* Mode badge */}
            {renderedUrl && (
              <div className="absolute right-2 top-2 flex overflow-hidden rounded border border-neutral-700 bg-neutral-950/80 text-[10px] backdrop-blur-sm">
                <button
                  type="button"
                  onClick={() => setMode("live")}
                  className={`px-2 py-0.5 transition-colors ${
                    mode === "live" ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Live
                </button>
                <button
                  type="button"
                  onClick={() => setMode("rendered")}
                  className={`px-2 py-0.5 transition-colors ${
                    mode === "rendered" ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Rendered
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hidden audio players. one per active audio clip */}
        {!showRendered &&
          activeAudioClips.map(({ clip }) => {
            const asset = getAsset(project, clip.assetId)
            if (!asset) return null
            return (
              <audio
                key={clip.id}
                ref={(el) => {
                  if (el) audioRefsRef.current.set(clip.id, el)
                  else audioRefsRef.current.delete(clip.id)
                }}
                src={asset.url}
                preload="metadata"
              />
            )
          })}

        <div className="flex h-10 shrink-0 items-center gap-1.5 border-t border-neutral-800 bg-neutral-950 px-3 text-[11px] text-neutral-400">
          <IconButton
            size="sm"
            icon={<SkipBack size={13} />}
            onClick={() => onPlayhead(0)}
            title="Back to start"
            aria-label="Back to start"
          />
          <IconButton
            size="sm"
            variant="secondary"
            icon={isPlaying ? <Pause size={13} /> : <Play size={13} />}
            onClick={() => setIsPlaying((p) => !p)}
            disabled={duration === 0}
            title={isPlaying ? "Pause" : "Play"}
            shortcut="Space"
            aria-label={isPlaying ? "Pause" : "Play"}
          />
          <IconButton
            size="sm"
            icon={<ChevronsRight size={13} />}
            onClick={() => onPlayhead(Math.min(duration, playhead + 1))}
            title="Skip +1s"
            shortcut="Shift+ArrowRight"
            aria-label="Skip forward 1s"
          />

          <span className="ml-2 tabular-nums text-neutral-400" aria-label="Playhead position">
            {formatTimestamp(playhead)} <span className="text-neutral-600">/</span>{" "}
            {formatTimestamp(duration)}
          </span>

          <span className="flex-1" />

          {renderStatus === "rendering" && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              Rendering…
            </span>
          )}
          {renderStatus === "error" && renderError && (
            <span className="truncate text-red-400" title={renderError}>
              Render failed: {renderError.slice(0, 60)}
            </span>
          )}
          {lastUpload && renderStatus === "done" && (
            <span className="text-neutral-500">
              {lastUpload.backend} · {(lastUpload.bytes / 1024 / 1024).toFixed(1)}MB ·{" "}
              {Math.round(lastUpload.elapsedMs / 1000)}s
            </span>
          )}

          {onUndo && (
            <IconButton
              size="sm"
              icon={<Undo2 size={13} />}
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo"
              shortcut="Cmd+Z"
              aria-label="Undo"
            />
          )}
          {onRedo && (
            <IconButton
              size="sm"
              icon={<Redo2 size={13} />}
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo"
              shortcut="Cmd+Shift+Z"
              aria-label="Redo"
            />
          )}

          {onRender && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onRender(true)}
              disabled={renderBusy || duration === 0}
              title="Render a fast draft preview"
              shortcut="Cmd+P"
            >
              Draft
            </Button>
          )}

          {renderedUrl && (
            <a
              href={renderedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded px-1.5 py-0.5 text-[11px] text-neutral-500 underline underline-offset-2 outline-none hover:text-neutral-200 focus-visible:ring-2 focus-visible:ring-blue-500/60"
            >
              Open
            </a>
          )}
        </div>
      </div>
    )
  },
)
