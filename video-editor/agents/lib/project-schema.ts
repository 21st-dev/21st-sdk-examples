import { z } from "zod"

/**
 * Zod mirrors of `app/lib/project.ts` types.
 *
 * The agent receives the full `Project` in each message via system-note
 * context injection and can echo it back in `render_project`. We keep
 * this duplicate schema intentionally: the client-side model uses
 * TypeScript-only types for perf, and the agent side needs strict
 * runtime validation.
 */

export const assetKindSchema = z.enum(["video", "image", "audio"])
export const trackKindSchema = z.enum(["video", "audio"])
export const outputFormatSchema = z.enum(["mp4", "webm"])
export const resolutionSchema = z.enum(["480p", "720p", "1080p"])
export const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1"])
export const overlayPositionSchema = z.enum(["top", "center", "bottom"])

export const assetSchema = z.object({
  id: z.string(),
  kind: assetKindSchema,
  url: z.string().url(),
  label: z.string(),
  duration: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  hasAudio: z.boolean().nullable().optional(),
})

export const trackSchema = z.object({
  id: z.string(),
  kind: trackKindSchema,
  label: z.string().optional(),
  muted: z.boolean().optional(),
})

export const textOverlaySchema = z.object({
  text: z.string(),
  position: overlayPositionSchema,
  color: z.string().optional(),
  fontSize: z.number().optional(),
})

export const clipSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  assetId: z.string(),
  start: z.number().min(0),
  length: z.number().min(0),
  trimIn: z.number().min(0),
  volume: z.number().min(0).max(1).optional(),
  textOverlay: textOverlaySchema.optional(),
})

export const projectOutputSchema = z.object({
  format: outputFormatSchema,
  resolution: resolutionSchema,
  aspectRatio: aspectRatioSchema,
  fps: z.number().int().min(12).max(60),
})

export const projectSchema = z.object({
  tracks: z.array(trackSchema).min(1),
  clips: z.array(clipSchema),
  assets: z.array(assetSchema),
  output: projectOutputSchema,
})

// ───────────────── Ops (mirror of app/lib/project-ops.ts) ─────────────────

export const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_asset"),
    asset: assetSchema.partial({ id: true, duration: true, width: true, height: true, hasAudio: true }),
  }),
  z.object({
    op: z.literal("update_asset"),
    assetId: z.string(),
    patch: assetSchema.omit({ id: true }).partial(),
  }),
  z.object({ op: z.literal("remove_asset"), assetId: z.string() }),
  z.object({
    op: z.literal("add_clip"),
    trackId: z.string(),
    assetId: z.string(),
    start: z.number().min(0).optional(),
    length: z.number().min(0).optional(),
    trimIn: z.number().min(0).optional(),
    clipId: z.string().optional(),
  }),
  z.object({ op: z.literal("remove_clip"), clipId: z.string() }),
  z.object({
    op: z.literal("move_clip"),
    clipId: z.string(),
    start: z.number().min(0).optional(),
    trackId: z.string().optional(),
  }),
  z.object({
    op: z.literal("trim_clip"),
    clipId: z.string(),
    trimIn: z.number().min(0).optional(),
    length: z.number().min(0).optional(),
  }),
  z.object({
    op: z.literal("split_clip"),
    clipId: z.string(),
    at: z.number().min(0),
  }),
  z.object({
    op: z.literal("set_volume"),
    clipId: z.string(),
    volume: z.number().min(0).max(1),
  }),
  z.object({
    op: z.literal("set_text_overlay"),
    clipId: z.string(),
    text: z.string().nullable(),
    position: overlayPositionSchema.optional(),
    color: z.string().optional(),
    fontSize: z.number().optional(),
  }),
  z.object({ op: z.literal("set_output"), patch: projectOutputSchema.partial() }),
  z.object({
    op: z.literal("add_track"),
    kind: trackKindSchema,
    trackId: z.string().optional(),
    label: z.string().optional(),
  }),
  z.object({ op: z.literal("remove_track"), trackId: z.string() }),
  z.object({
    op: z.literal("move_track"),
    trackId: z.string(),
    toIndex: z.number().int().min(0),
  }),
  z.object({ op: z.literal("clear_timeline") }),
])

export type ProjectData = z.infer<typeof projectSchema>
export type OpData = z.infer<typeof opSchema>
