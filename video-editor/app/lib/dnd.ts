/**
 * Drag payload envelope + helpers for the HTML5 Drag API.
 * We serialise a small discriminated union into `dataTransfer` under a
 * custom mime type, keeping native text payloads untouched.
 */

export type AssetDragKind = "video" | "image" | "audio"

export type DragPayload =
  | { kind: "asset"; assetId: string; label: string; assetKind: AssetDragKind }
  | { kind: "clip"; clipId: string }

export const DND_MIME = "application/x-video-editor"

/**
 * Encode the asset kind into the MIME type as well, because HTML5 drag-and-drop
 * forbids `dataTransfer.getData(...)` during `dragover` (Chrome/Firefox security).
 * Only `types` are readable before drop, so we stuff whatever we need to gate
 * the drop decision into the MIME itself.
 */
export const DND_KIND_MIMES: Record<AssetDragKind | "clip", string> = {
  video: "application/x-video-editor+video-asset",
  image: "application/x-video-editor+image-asset",
  audio: "application/x-video-editor+audio-asset",
  clip: "application/x-video-editor+clip",
}

export function setDragPayload(dt: DataTransfer, payload: DragPayload) {
  dt.effectAllowed = "move"
  try {
    dt.setData(DND_MIME, JSON.stringify(payload))
    // Also register a kind-specific MIME so `dragover` handlers can decide
    // whether to accept the drop without reading `getData`.
    const kindMime =
      payload.kind === "asset"
        ? DND_KIND_MIMES[payload.assetKind]
        : DND_KIND_MIMES.clip
    dt.setData(kindMime, "1")
    // Some browsers refuse drops without at least one well-known type:
    dt.setData("text/plain", payload.kind === "asset" ? payload.label : payload.clipId)
  } catch {
    // Safari sometimes throws during non-pointer events.
  }
}

export function readDragPayload(dt: DataTransfer): DragPayload | null {
  try {
    const raw = dt.getData(DND_MIME)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DragPayload
    if (!parsed || typeof parsed !== "object" || typeof (parsed as DragPayload).kind !== "string") {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function hasDragPayload(dt: DataTransfer): boolean {
  return dt.types.includes(DND_MIME)
}

/** Peek the drag-source kind without reading `getData` — safe inside `dragover`. */
export function peekDragKind(dt: DataTransfer): AssetDragKind | "clip" | null {
  for (const [kind, mime] of Object.entries(DND_KIND_MIMES)) {
    if (dt.types.includes(mime)) return kind as AssetDragKind | "clip"
  }
  return null
}
