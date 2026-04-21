/**
 * Project reducer — pure functions that apply a typed operation to a Project.
 *
 * Both the drag-driven timeline UI and the agent's `update_timeline` tool
 * emit the same op shape, so the reducer is the single serialization point
 * between human edits and AI edits.
 *
 * Ops are intentionally small and composable; the agent can batch
 * multiple ops in one tool call.
 */

import {
  type Asset,
  type Clip,
  type Project,
  type ProjectOutput,
  type Track,
  type TrackKind,
  type UUID,
  clipsOnTrack,
  getAsset,
  getClip,
  getTrack,
  maxClipLength,
  newId,
  nextFreeStart,
} from "./project"

export type Op =
  | {
      op: "add_asset"
      asset: Omit<Asset, "id"> & { id?: UUID }
    }
  | {
      op: "update_asset"
      assetId: UUID
      patch: Partial<Omit<Asset, "id">>
    }
  | {
      op: "remove_asset"
      assetId: UUID
    }
  | {
      op: "add_clip"
      trackId: UUID
      assetId: UUID
      /** Omit to append at the end of the track. */
      start?: number
      length?: number
      trimIn?: number
      clipId?: UUID
    }
  | {
      op: "remove_clip"
      clipId: UUID
    }
  | {
      op: "move_clip"
      clipId: UUID
      start?: number
      trackId?: UUID
    }
  | {
      op: "trim_clip"
      clipId: UUID
      trimIn?: number
      length?: number
    }
  | {
      op: "split_clip"
      clipId: UUID
      /** Absolute timeline seconds at which to cut. */
      at: number
    }
  | {
      op: "set_volume"
      clipId: UUID
      volume: number
    }
  | {
      op: "set_text_overlay"
      clipId: UUID
      text: string | null
      position?: "top" | "center" | "bottom"
      color?: string
      fontSize?: number
    }
  | {
      op: "set_output"
      patch: Partial<ProjectOutput>
    }
  | {
      op: "add_track"
      kind: TrackKind
      trackId?: UUID
      label?: string
    }
  | {
      op: "remove_track"
      trackId: UUID
    }
  | {
      op: "clear_timeline"
    }

function withClip(project: Project, clipId: UUID, fn: (c: Clip) => Clip): Project {
  let touched = false
  const clips = project.clips.map((c) => {
    if (c.id !== clipId) return c
    touched = true
    return fn(c)
  })
  if (!touched) return project
  return { ...project, clips }
}

function withAsset(project: Project, assetId: UUID, fn: (a: Asset) => Asset): Project {
  let touched = false
  const assets = project.assets.map((a) => {
    if (a.id !== assetId) return a
    touched = true
    return fn(a)
  })
  if (!touched) return project
  return { ...project, assets }
}

export function applyOp(project: Project, op: Op): Project {
  switch (op.op) {
    case "add_asset": {
      const id = op.asset.id ?? newId("asset")
      if (project.assets.some((a) => a.id === id)) return project
      const asset: Asset = {
        ...op.asset,
        id,
        duration: op.asset.duration ?? null,
        width: op.asset.width ?? null,
        height: op.asset.height ?? null,
        hasAudio: op.asset.hasAudio ?? null,
      }
      return { ...project, assets: [...project.assets, asset] }
    }

    case "update_asset": {
      return withAsset(project, op.assetId, (a) => ({ ...a, ...op.patch, id: a.id }))
    }

    case "remove_asset": {
      return {
        ...project,
        assets: project.assets.filter((a) => a.id !== op.assetId),
        clips: project.clips.filter((c) => c.assetId !== op.assetId),
      }
    }

    case "add_clip": {
      const asset = getAsset(project, op.assetId)
      const track = getTrack(project, op.trackId)
      if (!asset || !track) return project
      const trimIn = Math.max(0, op.trimIn ?? 0)
      const sourceRemaining = (asset.duration ?? 0) - trimIn
      const fallback = asset.kind === "image" ? 5 : 5
      const suggestedLength = op.length ?? (sourceRemaining > 0 ? sourceRemaining : fallback)
      const length = Math.min(
        Math.max(0.1, suggestedLength),
        maxClipLength(asset, trimIn),
      )
      const start = op.start ?? nextFreeStart(project, op.trackId)
      const clip: Clip = {
        id: op.clipId ?? newId("clip"),
        trackId: op.trackId,
        assetId: op.assetId,
        start: Math.max(0, start),
        length,
        trimIn,
      }
      // Audio clips get a default volume.
      if (track.kind === "audio") clip.volume = 1
      return { ...project, clips: [...project.clips, clip] }
    }

    case "remove_clip": {
      return { ...project, clips: project.clips.filter((c) => c.id !== op.clipId) }
    }

    case "move_clip": {
      return withClip(project, op.clipId, (c) => ({
        ...c,
        start: op.start !== undefined ? Math.max(0, op.start) : c.start,
        trackId: op.trackId ?? c.trackId,
      }))
    }

    case "trim_clip": {
      const clip = getClip(project, op.clipId)
      if (!clip) return project
      const asset = getAsset(project, clip.assetId)
      const trimIn = op.trimIn !== undefined ? Math.max(0, op.trimIn) : clip.trimIn
      const maxLen = maxClipLength(asset, trimIn)
      const length =
        op.length !== undefined ? Math.min(Math.max(0.1, op.length), maxLen) : Math.min(clip.length, maxLen)
      return withClip(project, op.clipId, (c) => ({ ...c, trimIn, length }))
    }

    case "split_clip": {
      const clip = getClip(project, op.clipId)
      if (!clip) return project
      const localOffset = op.at - clip.start
      // Only split if the cut lands strictly inside the clip.
      if (localOffset <= 0.05 || localOffset >= clip.length - 0.05) return project
      const rightId = newId("clip")
      const left: Clip = { ...clip, length: localOffset }
      const right: Clip = {
        ...clip,
        id: rightId,
        start: clip.start + localOffset,
        length: clip.length - localOffset,
        trimIn: clip.trimIn + localOffset,
      }
      const clips = project.clips.flatMap((c) => (c.id === clip.id ? [left, right] : [c]))
      return { ...project, clips }
    }

    case "set_volume": {
      return withClip(project, op.clipId, (c) => ({
        ...c,
        volume: Math.min(1, Math.max(0, op.volume)),
      }))
    }

    case "set_text_overlay": {
      return withClip(project, op.clipId, (c) => {
        if (op.text === null || op.text === "") {
          const { textOverlay: _unused, ...rest } = c
          return rest as Clip
        }
        return {
          ...c,
          textOverlay: {
            text: op.text,
            position: op.position ?? c.textOverlay?.position ?? "bottom",
            color: op.color ?? c.textOverlay?.color,
            fontSize: op.fontSize ?? c.textOverlay?.fontSize,
          },
        }
      })
    }

    case "set_output": {
      return { ...project, output: { ...project.output, ...op.patch } }
    }

    case "add_track": {
      const id = op.trackId ?? newId(op.kind === "video" ? "video" : "audio")
      if (project.tracks.some((t) => t.id === id)) return project
      const track: Track = {
        id,
        kind: op.kind,
        label: op.label ?? `${op.kind === "video" ? "V" : "A"}${project.tracks.filter((t) => t.kind === op.kind).length + 1}`,
      }
      return { ...project, tracks: [...project.tracks, track] }
    }

    case "remove_track": {
      if (project.tracks.length <= 1) return project
      return {
        ...project,
        tracks: project.tracks.filter((t) => t.id !== op.trackId),
        clips: project.clips.filter((c) => c.trackId !== op.trackId),
      }
    }

    case "clear_timeline": {
      return { ...project, clips: [] }
    }

    default: {
      // Exhaustiveness check.
      const _never: never = op
      return project
    }
  }
}

export function applyOps(project: Project, ops: Op[]): Project {
  let p = project
  for (const op of ops) p = applyOp(p, op)
  return p
}

// ───────────────── convenience for drag-edits from the UI ─────────────────

export function opsForMove(clipId: UUID, start: number, trackId?: UUID): Op[] {
  return [{ op: "move_clip", clipId, start, trackId }]
}

export function opsForTrim(
  clipId: UUID,
  next: { trimIn?: number; length?: number; start?: number },
): Op[] {
  const ops: Op[] = []
  if (next.trimIn !== undefined || next.length !== undefined) {
    ops.push({ op: "trim_clip", clipId, trimIn: next.trimIn, length: next.length })
  }
  if (next.start !== undefined) {
    ops.push({ op: "move_clip", clipId, start: next.start })
  }
  return ops
}
