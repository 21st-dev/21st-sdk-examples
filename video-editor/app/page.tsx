"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AssetPanel } from "./components/asset-panel"
import { ChatSidebar } from "./components/chat-sidebar"
import {
  LivePreview,
  type LivePreviewHandle,
} from "./components/live-preview"
import { ResizableSplit } from "./components/resizable-split"
import { Timeline, MAX_ZOOM_IDX, MIN_ZOOM_IDX } from "./components/timeline/Timeline"
import { TopBar } from "./components/top-bar"
import { TooltipProvider } from "./components/ui/tooltip"
import { formatSilentAction } from "./lib/chat-protocol"
import { readStorage, useLocalStorageState, writeStorage } from "./lib/local-storage"
import {
  type Asset,
  type Clip,
  type Project,
  type ProjectOutput,
  type UUID,
  clampStartNonOverlapping,
  clipsOnTrack,
  findNearestFreeStart,
  getAsset,
  getClip,
  newId,
  newProject,
  projectDuration,
} from "./lib/project"
import type { Op } from "./lib/project-ops"
import { INITIAL_RENDER, type RenderState } from "./lib/render"
import { useAgentSession } from "./lib/use-agent-session"
import { useColorMode, type ColorMode } from "./lib/use-color-mode"
import { useProjectHistory } from "./lib/use-project-history"
import { useShortcuts } from "./lib/use-shortcuts"
import { SAMPLE_ASSETS, SAMPLE_PROMPTS } from "./sample-data"

/** Minimum distance from clip edges for a split to be meaningful. Mirrors the
 *  guard inside `applyOp("split_clip")` so the UI button stays in sync. */
const SPLIT_MIN_OFFSET = 0.05
const DEFAULT_ZOOM_IDX = 3 // 120 px/s
const CHAT_OPEN_STORAGE_KEY = "video-editor:chat-open"
const projectStoreKey = (sandboxId: string) => `video-editor:project:${sandboxId}`

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
          Loading…
        </main>
      }
    >
      <EditorShell />
    </Suspense>
  )
}

function EditorShell() {
  const colorMode = useResolvedColorMode()
  const session = useAgentSession()

  const history = useProjectHistory(newProject())
  const {
    project,
    apply: applyOpsWithHistory,
    set: setProject,
    undo,
    redo,
    canUndo,
    canRedo,
  } = history

  // Keep a live ref so handlers that react to transient input (keyboard,
  // drag) can read the current project without rebuilding on every edit.
  const projectRef = useRef(project)
  projectRef.current = project
  const previewRef = useRef<LivePreviewHandle | null>(null)

  const [selectedClipId, setSelectedClipId] = useState<UUID | null>(null)
  const [playhead, setPlayhead] = useState(0)
  const [zoomIdx, setZoomIdx] = useState(DEFAULT_ZOOM_IDX)
  const [render, setRender] = useState<RenderState>(INITIAL_RENDER)
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null)
  const [chatOpen, setChatOpen] = useLocalStorageState<boolean>(CHAT_OPEN_STORAGE_KEY, true)

  useProjectPersistence(session.sandboxId, project, setProject)
  const duration = useMemo(() => projectDuration(project), [project])

  // ───────────────── selection-aware derivations ─────────────────

  const splittableClip = useMemo(
    () => findSplittableClip(project, playhead, selectedClipId),
    [project, playhead, selectedClipId],
  )
  const canSplit = !!splittableClip

  const selectedTrackId = useMemo(() => {
    if (!selectedClipId) return null
    return getClip(project, selectedClipId)?.trackId ?? null
  }, [project, selectedClipId])

  // ───────────────── handlers ─────────────────

  const handleSeekTo = useCallback((s: number) => {
    setPlayhead(s)
    previewRef.current?.seek(s)
  }, [])

  const nudgePlayhead = useCallback(
    (delta: number) => handleSeekTo(Math.max(0, playhead + delta)),
    [handleSeekTo, playhead],
  )

  const handleAddAsset = useCallback(
    (asset: Omit<Asset, "id"> & { id?: string }) => {
      const id = asset.id ?? newId("asset")
      applyOpsWithHistory([{ op: "add_asset", asset: { ...asset, id } }])
    },
    [applyOpsWithHistory],
  )

  const handleRemoveAsset = useCallback(
    (id: string) => applyOpsWithHistory([{ op: "remove_asset", assetId: id }]),
    [applyOpsWithHistory],
  )

  const handleLoadSample = useCallback(() => {
    const ops: Op[] = SAMPLE_ASSETS.map((a) => ({
      op: "add_asset" as const,
      asset: { ...a, id: newId("asset") },
    }))
    applyOpsWithHistory(ops)
  }, [applyOpsWithHistory])

  const appendAssetToTrack = useCallback(
    (assetId: string) => {
      const p = projectRef.current
      const asset = getAsset(p, assetId)
      if (!asset) return
      const track =
        asset.kind === "audio"
          ? p.tracks.find((t) => t.kind === "audio") ?? p.tracks[0]!
          : p.tracks.find((t) => t.kind === "video") ?? p.tracks[0]!
      applyOpsWithHistory([{ op: "add_clip", trackId: track.id, assetId }])
    },
    [applyOpsWithHistory],
  )

  const handleDropAsset = useCallback(
    (assetId: string, trackId: UUID, startSeconds: number) => {
      const p = projectRef.current
      const asset = getAsset(p, assetId)
      // Use the asset's natural duration as the dropped clip's length so the
      // overlap check matches the length `add_clip` will actually create.
      const length = estimateDropLength(asset)
      const resolvedStart = findNearestFreeStart(p, trackId, length, startSeconds)
      applyOpsWithHistory([
        { op: "add_clip", trackId, assetId, start: resolvedStart, length },
      ])
    },
    [applyOpsWithHistory],
  )

  const handleUpdateClipFromTimeline = useCallback(
    (
      clipId: UUID,
      patch: { start?: number; length?: number; trimIn?: number; trackId?: string },
    ) => {
      const p = projectRef.current
      const clip = getClip(p, clipId)
      if (!clip) return

      const resolved = resolveNonOverlappingPatch(p, clip, patch)

      const ops: Op[] = []
      if (resolved.trimIn !== undefined || resolved.length !== undefined) {
        ops.push({ op: "trim_clip", clipId, trimIn: resolved.trimIn, length: resolved.length })
      }
      if (resolved.start !== undefined || resolved.trackId !== undefined) {
        ops.push({ op: "move_clip", clipId, start: resolved.start, trackId: resolved.trackId })
      }
      if (ops.length > 0) applyOpsWithHistory(ops)
    },
    [applyOpsWithHistory],
  )

  const handleUpdateClipFromInspector = useCallback(
    (
      clipId: UUID,
      patch: {
        trimIn?: number
        length?: number
        start?: number
        volume?: number
        textOverlay?: Clip["textOverlay"] | null
      },
    ) => {
      const ops: Op[] = []
      if (patch.trimIn !== undefined || patch.length !== undefined) {
        ops.push({ op: "trim_clip", clipId, trimIn: patch.trimIn, length: patch.length })
      }
      if (patch.start !== undefined) {
        ops.push({ op: "move_clip", clipId, start: patch.start })
      }
      if (patch.volume !== undefined) {
        ops.push({ op: "set_volume", clipId, volume: patch.volume })
      }
      if (patch.textOverlay !== undefined) {
        if (patch.textOverlay === null) {
          ops.push({ op: "set_text_overlay", clipId, text: null })
        } else {
          ops.push({
            op: "set_text_overlay",
            clipId,
            text: patch.textOverlay.text,
            position: patch.textOverlay.position,
            color: patch.textOverlay.color,
            fontSize: patch.textOverlay.fontSize,
          })
        }
      }
      if (ops.length > 0) applyOpsWithHistory(ops)
    },
    [applyOpsWithHistory],
  )

  const handleRemoveClip = useCallback(
    (clipId: UUID) => {
      applyOpsWithHistory([{ op: "remove_clip", clipId }])
      setSelectedClipId((sel) => (sel === clipId ? null : sel))
    },
    [applyOpsWithHistory],
  )

  const handleDuplicateClip = useCallback(
    (clipId: UUID) => {
      const p = projectRef.current
      const clip = getClip(p, clipId)
      if (!clip) return
      const ops = duplicateClipOps(p, clip)
      applyOpsWithHistory(ops)
      setSelectedClipId(ops[0].op === "add_clip" ? ops[0].clipId! : clipId)
    },
    [applyOpsWithHistory],
  )

  // Ripple delete: remove the clip AND shift every following clip on the same
  // track leftward by its length, closing the gap.
  const handleRippleDeleteClip = useCallback(
    (clipId: UUID) => {
      const p = projectRef.current
      const clip = getClip(p, clipId)
      if (!clip) return
      const shift = clip.length
      const clipEnd = clip.start + clip.length
      const following = clipsOnTrack(p, clip.trackId).filter(
        (c) => c.id !== clip.id && c.start >= clipEnd - 0.01,
      )
      const ops: Op[] = [{ op: "remove_clip", clipId }]
      for (const c of following) {
        ops.push({ op: "move_clip", clipId: c.id, start: Math.max(0, c.start - shift) })
      }
      applyOpsWithHistory(ops)
      setSelectedClipId((sel) => (sel === clipId ? null : sel))
    },
    [applyOpsWithHistory],
  )

  const handleSplitClip = useCallback(
    (clipId: UUID) => {
      const clip = getClip(projectRef.current, clipId)
      if (!clip || !isInterior(clip, playhead)) return
      applyOpsWithHistory([{ op: "split_clip", clipId, at: playhead }])
    },
    [playhead, applyOpsWithHistory],
  )

  const handleSplitAtPlayhead = useCallback(() => {
    if (!splittableClip) return
    applyOpsWithHistory([{ op: "split_clip", clipId: splittableClip.id, at: playhead }])
  }, [splittableClip, playhead, applyOpsWithHistory])

  // Razor tool: split every clip across all tracks that straddles the playhead.
  const handleRazorAtPlayhead = useCallback(() => {
    const candidates = projectRef.current.clips.filter((c) => isInterior(c, playhead))
    if (candidates.length === 0) return
    applyOpsWithHistory(
      candidates.map((c) => ({ op: "split_clip" as const, clipId: c.id, at: playhead })),
    )
  }, [playhead, applyOpsWithHistory])

  const handleUpdateOutput = useCallback(
    (patch: Partial<ProjectOutput>) => {
      applyOpsWithHistory([{ op: "set_output", patch }])
    },
    [applyOpsWithHistory],
  )

  const handleAddTrack = useCallback(
    (kind: "video" | "audio") => applyOpsWithHistory([{ op: "add_track", kind }]),
    [applyOpsWithHistory],
  )

  const handleRemoveTrack = useCallback(
    (trackId: UUID) => applyOpsWithHistory([{ op: "remove_track", trackId }]),
    [applyOpsWithHistory],
  )

  const handleReorderTrack = useCallback(
    (trackId: UUID, toIndex: number) =>
      applyOpsWithHistory([{ op: "move_track", trackId, toIndex }]),
    [applyOpsWithHistory],
  )

  const handleProbeResult = useCallback(
    (url: string, info: Partial<Asset>) => {
      const asset = projectRef.current.assets.find((a) => a.url === url)
      if (!asset) return
      applyOpsWithHistory([{ op: "update_asset", assetId: asset.id, patch: info }])
    },
    [applyOpsWithHistory],
  )

  const handleRender = useCallback((preview: boolean) => {
    if (projectRef.current.clips.length === 0) {
      setRender({
        url: null,
        status: "error",
        errorMessage: "Timeline is empty.",
        upload: null,
      })
      return
    }
    setPendingPrompt(
      formatSilentAction(
        `render ${preview ? "draft preview" : "final"}`,
        `Render the current project using render_project({ preview: ${preview} }).`,
      ),
    )
  }, [])

  const handleRenderPending = useCallback(() => {
    setRender({ url: null, status: "rendering", errorMessage: null, upload: null })
  }, [])

  const handlePromptConsumed = useCallback(() => setPendingPrompt(null), [])
  const handleToggleChat = useCallback(() => setChatOpen((o) => !o), [setChatOpen])

  // ───────────────── keyboard shortcuts ─────────────────

  useShortcuts(
    {
      Space: () => previewRef.current?.togglePlay(),
      ArrowLeft: () => nudgePlayhead(-0.1),
      ArrowRight: () => nudgePlayhead(0.1),
      "Shift+ArrowLeft": () => nudgePlayhead(-1),
      "Shift+ArrowRight": () => nudgePlayhead(1),
      Home: () => handleSeekTo(0),
      End: () => handleSeekTo(projectDuration(projectRef.current)),
      Backspace: () => {
        if (selectedClipId) handleRemoveClip(selectedClipId)
      },
      Delete: () => {
        if (selectedClipId) handleRemoveClip(selectedClipId)
      },
      "Shift+Backspace": () => {
        if (selectedClipId) handleRippleDeleteClip(selectedClipId)
      },
      "Shift+Delete": () => {
        if (selectedClipId) handleRippleDeleteClip(selectedClipId)
      },
      S: () => handleSplitAtPlayhead(),
      "Shift+S": () => handleRazorAtPlayhead(),
      "Cmd+D": () => {
        if (selectedClipId) handleDuplicateClip(selectedClipId)
      },
      Escape: () => setSelectedClipId(null),
      "Cmd+K": () => setChatOpen((o) => !o),
      "Cmd+Z": () => undo(),
      "Cmd+Shift+Z": () => redo(),
      "Cmd+Enter": () => handleRender(false),
      "Cmd+P": () => handleRender(true),
      "+": () => setZoomIdx((i) => Math.min(MAX_ZOOM_IDX, i + 1)),
      "=": () => setZoomIdx((i) => Math.min(MAX_ZOOM_IDX, i + 1)),
      "-": () => setZoomIdx((i) => Math.max(MIN_ZOOM_IDX, i - 1)),
      "Cmd+=": () => setZoomIdx((i) => Math.min(MAX_ZOOM_IDX, i + 1)),
      "Cmd+-": () => setZoomIdx((i) => Math.max(MIN_ZOOM_IDX, i - 1)),
    },
    {
      // Undo/redo win even over the agent chat textarea — otherwise Cmd+Z
      // silently undoes text in the chat box instead of the timeline edit.
      global: ["Cmd+Z", "Cmd+Shift+Z"],
    },
  )

  // ───────────────── render ─────────────────

  if (session.error) {
    return <BootError message={session.error} />
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={`flex h-screen flex-col bg-neutral-950 text-neutral-100 ${colorMode === "dark" ? "dark" : ""}`}>
      <TopBar
        output={project.output}
        duration={duration}
        onUpdateOutput={handleUpdateOutput}
        onToggleChat={handleToggleChat}
        chatOpen={chatOpen}
        onSplit={handleSplitAtPlayhead}
        canSplit={canSplit}
        onExport={() => handleRender(false)}
        exportDisabled={render.status === "rendering" || duration === 0}
      />

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <AssetPanel
          assets={project.assets}
          onAdd={handleAddAsset}
          onRemove={handleRemoveAsset}
          onLoadSample={handleLoadSample}
          onQuickAdd={appendAssetToTrack}
        />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ResizableSplit
            initialTopPct={55}
            minTopPct={20}
            maxTopPct={80}
            storageKey="video-editor:split-top-pct"
            top={
              <LivePreview
                ref={previewRef}
                project={project}
                playhead={playhead}
                onPlayhead={setPlayhead}
                selectedTrackId={selectedTrackId}
                renderedUrl={render.url}
                renderStatus={render.status}
                renderError={render.errorMessage}
                lastUpload={render.upload}
                onRender={handleRender}
                renderBusy={render.status === "rendering"}
                onUndo={undo}
                onRedo={redo}
                canUndo={canUndo}
                canRedo={canRedo}
              />
            }
            bottom={
              <Timeline
                project={project}
                selectedClipId={selectedClipId}
                onSelectClip={setSelectedClipId}
                onUpdateClip={handleUpdateClipFromTimeline}
                onInspectorPatch={handleUpdateClipFromInspector}
                onDropAsset={handleDropAsset}
                playhead={playhead}
                onSeek={handleSeekTo}
                zoomIdx={zoomIdx}
                onChangeZoomIdx={setZoomIdx}
                onAddTrack={handleAddTrack}
                onRemoveTrack={handleRemoveTrack}
                onReorderTrack={handleReorderTrack}
                onSplitClip={handleSplitClip}
                onDuplicateClip={handleDuplicateClip}
                onDeleteClip={handleRemoveClip}
              />
            }
          />
        </section>

        {chatOpen && (
          <ChatSidebar
            sandboxId={session.sandboxId}
            threadId={session.threadId}
            colorMode={colorMode}
            project={project}
            onApplyOps={applyOpsWithHistory}
            onProbeResult={handleProbeResult}
            onRenderResult={setRender}
            onRenderPending={handleRenderPending}
            pendingPrompt={pendingPrompt}
            onPromptConsumed={handlePromptConsumed}
            onClose={() => setChatOpen(false)}
            samplePrompts={SAMPLE_PROMPTS}
            onSamplePrompt={setPendingPrompt}
          />
        )}
      </div>
      </div>
    </TooltipProvider>
  )
}

// ───────────────── helpers ─────────────────

function useResolvedColorMode(): ColorMode {
  const searchParams = useSearchParams()
  const param = searchParams.get("theme")
  const override = param === "light" || param === "dark" ? param : undefined
  return useColorMode(override)
}

/** Hydrate the project from localStorage once the sandbox is known, and
 * mirror subsequent edits back to storage. */
function useProjectPersistence(
  sandboxId: string | null,
  project: Project,
  setProject: (project: Project, snapshot?: boolean) => void,
) {
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (!sandboxId || hydratedRef.current) return
    const stored = readStorage<Project>(projectStoreKey(sandboxId))
    if (stored && Array.isArray(stored.tracks) && Array.isArray(stored.clips)) {
      setProject(stored, false)
    }
    hydratedRef.current = true
  }, [sandboxId, setProject])

  // Mirror edits back to storage — but only AFTER hydration finished, else
  // the first commit with the freshly-booted sandbox id would clobber the
  // stored project with the empty `newProject()` default before the hydrate
  // effect has a chance to run.
  useEffect(() => {
    if (!sandboxId || !hydratedRef.current) return
    writeStorage(projectStoreKey(sandboxId), project)
  }, [sandboxId, project])
}

function isInterior(clip: Clip, t: number): boolean {
  return t > clip.start + SPLIT_MIN_OFFSET && t < clip.start + clip.length - SPLIT_MIN_OFFSET
}

function findSplittableClip(
  project: Project,
  playhead: number,
  selectedClipId: UUID | null,
): Clip | undefined {
  if (selectedClipId) {
    const selected = getClip(project, selectedClipId)
    if (selected && isInterior(selected, playhead)) return selected
  }
  return project.clips.find((c) => isInterior(c, playhead))
}

/** Build the op batch for duplicating a clip right after itself, carrying over
 * clip-side state (volume, text overlay) that `add_clip` does not seed. The
 * insertion point is pushed forward past any overlapping neighbour. */
function duplicateClipOps(project: Project, clip: Clip): Op[] {
  const duplicateId = newId("clip")
  const preferredStart = clip.start + clip.length
  const start = findNearestFreeStart(project, clip.trackId, clip.length, preferredStart)
  const ops: Op[] = [
    {
      op: "add_clip",
      clipId: duplicateId,
      trackId: clip.trackId,
      assetId: clip.assetId,
      start,
      length: clip.length,
      trimIn: clip.trimIn,
    },
  ]
  if (typeof clip.volume === "number") {
    ops.push({ op: "set_volume", clipId: duplicateId, volume: clip.volume })
  }
  if (clip.textOverlay) {
    ops.push({
      op: "set_text_overlay",
      clipId: duplicateId,
      text: clip.textOverlay.text,
      position: clip.textOverlay.position,
      color: clip.textOverlay.color,
      fontSize: clip.textOverlay.fontSize,
    })
  }
  return ops
}

/** Heuristic clip length used when dropping an asset on the timeline — must
 * stay in sync with `add_clip`'s default length derivation so the no-overlap
 * clamp reflects what the reducer will create. */
function estimateDropLength(asset: Asset | undefined): number {
  if (!asset) return 5
  if (asset.kind === "image") return 5
  if (asset.duration && asset.duration > 0) return asset.duration
  return 5
}

/**
 * Clamp a drag-emitted patch (`move`, `trim-left`, `trim-right`) so the edit
 * keeps the clip inside its track's free space. The ClipBlock drag layer
 * emits patches optimistically every pointermove; we resolve them here so the
 * reducer never sees an overlapping placement.
 */
function resolveNonOverlappingPatch(
  project: Project,
  clip: Clip,
  patch: { start?: number; length?: number; trimIn?: number; trackId?: string },
): { start?: number; length?: number; trimIn?: number; trackId?: string } {
  const targetTrackId = patch.trackId ?? clip.trackId
  const result: typeof patch = { ...patch }

  // Case A: trim-left. ClipBlock sets start, trimIn, and length together,
  // keeping `start + length` equal to the clip's original right edge.
  if (
    patch.start !== undefined &&
    patch.trimIn !== undefined &&
    patch.length !== undefined &&
    patch.trackId === undefined
  ) {
    const originalEnd = clip.start + clip.length
    const prev = clipsOnTrack(project, clip.trackId)
      .filter((c) => c.id !== clip.id && c.start + c.length <= clip.start + 0.001)
      .pop()
    const minStart = prev ? prev.start + prev.length : 0
    const clampedStart = Math.max(minStart, patch.start)
    if (clampedStart !== patch.start) {
      const shift = clampedStart - patch.start
      result.start = clampedStart
      result.trimIn = Math.max(0, patch.trimIn + shift)
      result.length = Math.max(0.1, originalEnd - clampedStart)
    }
    return result
  }

  // Case B: trim-right. Only length changes; start/trackId/trimIn stay put.
  if (
    patch.length !== undefined &&
    patch.start === undefined &&
    patch.trimIn === undefined &&
    patch.trackId === undefined
  ) {
    const next = clipsOnTrack(project, clip.trackId)
      .find((c) => c.id !== clip.id && c.start >= clip.start + clip.length - 0.001)
    const maxLength = next ? Math.max(0.1, next.start - clip.start) : patch.length
    result.length = Math.min(patch.length, maxLength)
    return result
  }

  // Case C: move. start and/or trackId may have changed.
  if (patch.start !== undefined || patch.trackId !== undefined) {
    const targetLength = patch.length ?? clip.length
    const requested = patch.start ?? clip.start
    const clamped = clampStartNonOverlapping(
      project,
      targetTrackId,
      clip.id,
      targetLength,
      requested,
      clip.start,
    )
    result.start = clamped
  }
  return result
}

function BootError({ message }: { message: string }) {
  return (
    <main className="flex h-screen items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="space-y-2 text-center">
        <p className="text-red-400">{message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-sm text-neutral-400 underline hover:text-white"
        >
          Retry
        </button>
      </div>
    </main>
  )
}
