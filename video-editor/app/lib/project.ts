/**
 * Timeline project model — single source of truth for the editor.
 *
 * Shape:
 *   Project
 *     ├── tracks[]  (video / audio lanes)
 *     ├── clips[]   (flat list; each clip points at a trackId)
 *     ├── assets[]  (imported media the clips reference)
 *     └── output    (final render settings)
 *
 * Both the timeline UI (drag / trim / split) and the agent's
 * `update_timeline` tool mutate the project through the same
 * reducer in `./project-ops.ts`, so drag-edits and AI-edits are
 * indistinguishable downstream.
 */

export type UUID = string

export type AssetKind = "video" | "image" | "audio"

export interface Asset {
  id: UUID
  kind: AssetKind
  url: string
  label: string
  /** Seconds. `null` if still being probed, `0` for still images. */
  duration: number | null
  width?: number | null
  height?: number | null
  hasAudio?: boolean | null
}

export type TrackKind = "video" | "audio"

export interface Track {
  id: UUID
  kind: TrackKind
  label?: string
  muted?: boolean
}

export interface TextOverlay {
  text: string
  position: "top" | "center" | "bottom"
  color?: string
  fontSize?: number
}

export interface Clip {
  id: UUID
  trackId: UUID
  assetId: UUID
  /** Position on the timeline (seconds). */
  start: number
  /** Visible length on the timeline (seconds). */
  length: number
  /** Seconds of source skipped at the head. */
  trimIn: number
  /** 0..1, audio only. */
  volume?: number
  textOverlay?: TextOverlay
}

export type ResolutionPreset = "480p" | "720p" | "1080p"
export type AspectRatio = "16:9" | "9:16" | "1:1"
export type OutputFormat = "mp4" | "webm"

export interface ProjectOutput {
  format: OutputFormat
  resolution: ResolutionPreset
  aspectRatio: AspectRatio
  fps: number
}

export interface Project {
  tracks: Track[]
  clips: Clip[]
  assets: Asset[]
  output: ProjectOutput
}

export const DEFAULT_OUTPUT: ProjectOutput = {
  format: "mp4",
  resolution: "480p",
  aspectRatio: "16:9",
  fps: 30,
}

/** Pixel dimensions for the chosen preset + aspect ratio. */
export function outputPixelDims(output: ProjectOutput): { width: number; height: number } {
  const shortSide =
    output.resolution === "1080p" ? 1080 : output.resolution === "720p" ? 720 : 480
  if (output.aspectRatio === "16:9") {
    const h = shortSide
    return { width: Math.round((h * 16) / 9 / 2) * 2, height: h }
  }
  if (output.aspectRatio === "9:16") {
    const w = shortSide
    return { width: w, height: Math.round((w * 16) / 9 / 2) * 2 }
  }
  // 1:1
  return { width: shortSide, height: shortSide }
}

let idSeq = 0
export function newId(prefix = "id"): UUID {
  idSeq += 1
  return `${prefix}_${Date.now().toString(36)}_${idSeq.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`
}

export function newProject(): Project {
  return {
    tracks: [
      { id: "video-1", kind: "video", label: "V1" },
      { id: "audio-1", kind: "audio", label: "A1" },
    ],
    clips: [],
    assets: [],
    output: DEFAULT_OUTPUT,
  }
}

// ───────────────── derived helpers ─────────────────

export function clipsOnTrack(project: Project, trackId: UUID): Clip[] {
  return project.clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start)
}

export function clipEndsAt(clip: Clip): number {
  return clip.start + clip.length
}

export function projectDuration(project: Project): number {
  return project.clips.reduce((max, c) => Math.max(max, clipEndsAt(c)), 0)
}

export function getAsset(project: Project, assetId: UUID): Asset | undefined {
  return project.assets.find((a) => a.id === assetId)
}

export function getClip(project: Project, clipId: UUID): Clip | undefined {
  return project.clips.find((c) => c.id === clipId)
}

export function getTrack(project: Project, trackId: UUID): Track | undefined {
  return project.tracks.find((t) => t.id === trackId)
}

/**
 * Find the next free start position on a track after snapping to the end
 * of the last clip. Used when the agent says "append clip to V1" without
 * specifying a position.
 */
export function nextFreeStart(project: Project, trackId: UUID): number {
  const clips = clipsOnTrack(project, trackId)
  if (clips.length === 0) return 0
  return clipEndsAt(clips[clips.length - 1]!)
}

/** Largest `trimIn + length` we can allow for a clip given its asset duration. */
export function maxClipLength(asset: Asset | undefined, trimIn: number): number {
  if (!asset) return 30
  if (asset.kind === "image") return 30
  if (!asset.duration || asset.duration <= 0) return 30
  return Math.max(0.1, asset.duration - trimIn)
}

/** Tiny epsilon used to keep "touching" clips (end meeting next start) from
 * tripping the overlap test. */
const OVERLAP_EPSILON = 0.001

/**
 * Clamp a candidate `[start, start + length]` placement on `trackId` so it
 * does not overlap any existing clip (besides `excludeClipId`).
 *
 * Direction follows the movement: when `requestedStart >= originStart` the
 * clip is moving right and is blocked at the next neighbour's left edge;
 * otherwise it is blocked at the previous neighbour's right edge. Snapping to
 * one neighbour can cause a secondary collision on the other side, so we
 * iterate to a fixed point (bounded so a pathological layout can't hang).
 */
export function clampStartNonOverlapping(
  project: Project,
  trackId: UUID,
  excludeClipId: UUID | null,
  length: number,
  requestedStart: number,
  originStart: number,
): number {
  const others = project.clips
    .filter((c) => c.trackId === trackId && c.id !== excludeClipId)
    .sort((a, b) => a.start - b.start)
  if (others.length === 0) return Math.max(0, requestedStart)

  const movingRight = requestedStart >= originStart
  let start = Math.max(0, requestedStart)

  for (let pass = 0; pass < 8; pass++) {
    let collided = false
    for (const other of others) {
      const oStart = other.start
      const oEnd = other.start + other.length
      if (start + length <= oStart + OVERLAP_EPSILON) continue
      if (start >= oEnd - OVERLAP_EPSILON) continue
      collided = true
      start = movingRight ? Math.max(0, oStart - length) : oEnd
      break
    }
    if (!collided) break
  }
  return Math.max(0, start)
}

/**
 * Pick a start position for a fresh clip of `length` on `trackId` nearest to
 * `requestedStart`, preferring (in order): the requested spot itself if it's
 * free, then the end of a nearby clip, then `nextFreeStart`. Used for drops
 * from the asset panel where there's no natural movement direction.
 */
export function findNearestFreeStart(
  project: Project,
  trackId: UUID,
  length: number,
  requestedStart: number,
): number {
  const others = project.clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.start - b.start)
  const wanted = Math.max(0, requestedStart)
  if (fits(others, wanted, length)) return wanted

  // Build gaps (including the implicit pre-first gap starting at 0 and the
  // infinite post-last gap) and pick the one closest to `wanted`.
  const gaps: Array<{ start: number; end: number }> = []
  let cursor = 0
  for (const o of others) {
    if (o.start - cursor >= length - OVERLAP_EPSILON) {
      gaps.push({ start: cursor, end: o.start })
    }
    cursor = Math.max(cursor, o.start + o.length)
  }
  gaps.push({ start: cursor, end: Number.POSITIVE_INFINITY })

  // For each gap, the closest valid start to `wanted`.
  let bestStart = cursor
  let bestDistance = Number.POSITIVE_INFINITY
  for (const gap of gaps) {
    const maxStart = gap.end === Number.POSITIVE_INFINITY ? wanted : gap.end - length
    const clamped = Math.max(gap.start, Math.min(maxStart, wanted))
    const distance = Math.abs(clamped - wanted)
    if (distance < bestDistance) {
      bestDistance = distance
      bestStart = clamped
    }
  }
  return bestStart
}

function fits(
  sortedClips: Clip[],
  start: number,
  length: number,
): boolean {
  const end = start + length
  for (const c of sortedClips) {
    const cEnd = c.start + c.length
    if (end <= c.start + OVERLAP_EPSILON) return true
    if (start >= cEnd - OVERLAP_EPSILON) continue
    return false
  }
  return true
}
