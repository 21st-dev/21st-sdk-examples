/**
 * Compile a `Project` JSON into an `ffmpeg` invocation.
 *
 * MVP approach — single `filter_complex` graph:
 *   1. Download every referenced asset to a local temp path (cached by URL).
 *   2. For each video-track clip: `trim` → `scale/pad` → optional `drawtext`.
 *   3. Stack same-track segments with `concat`, stacked tracks with `overlay`.
 *   4. For each audio-track clip: `atrim` → `volume`.
 *   5. `amix` audio, mux with video, encode with libx264 / aac.
 *
 * What's intentionally simple here:
 *   - No transitions (no `xfade`) — neighbouring clips just cut.
 *   - No image clips with Ken-Burns / slow pan yet; images are stills.
 *   - No per-clip effects (brightness/contrast) yet.
 *
 * Hooks for scaling later:
 *   - `compileProject` returns a structured plan, not a raw string, so a
 *     future "segmented render" runner can split the graph across ffmpeg
 *     invocations (one per clip) and cache rendered segments.
 */

import type {
  ProjectData,
  // biome-ignore lint/correctness/noUnusedImports: type-only
} from "../project-schema"

type Project = ProjectData

export interface CompiledRender {
  /** `ffmpeg` arguments. */
  args: string[]
  /** Absolute path to the final container file. */
  outputPath: string
  /** Duration in seconds (capped to project duration). */
  duration: number
}

function projectDuration(project: Project): number {
  return project.clips.reduce((max, c) => Math.max(max, c.start + c.length), 0)
}

function outputPixelDims(project: Project): { width: number; height: number } {
  const shortSide =
    project.output.resolution === "1080p"
      ? 1080
      : project.output.resolution === "720p"
        ? 720
        : 480
  if (project.output.aspectRatio === "16:9") {
    const h = shortSide
    return { width: Math.round((h * 16) / 9 / 2) * 2, height: h }
  }
  if (project.output.aspectRatio === "9:16") {
    const w = shortSide
    return { width: w, height: Math.round((w * 16) / 9 / 2) * 2 }
  }
  return { width: shortSide, height: shortSide }
}

function escDrawText(text: string): string {
  // Escape ffmpeg drawtext special chars. We keep the set conservative.
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/%/g, "\\%")
}

interface CompileOpts {
  project: Project
  /** Map assetId → local file path (already downloaded). */
  localMediaPaths: Map<string, string>
  /** Absolute path to write the final file to. */
  outputPath: string
  /** Encoder preset for fast/preview vs final render. */
  preview: boolean
}

export function compileProject(opts: CompileOpts): CompiledRender {
  const { project, localMediaPaths, outputPath, preview } = opts
  const duration = projectDuration(project)
  if (duration <= 0) {
    throw new Error("Project has no clips on the timeline.")
  }
  const { width, height } = outputPixelDims(project)

  const videoTracks = project.tracks.filter((t) => t.kind === "video")
  const audioTracks = project.tracks.filter((t) => t.kind === "audio")

  // Every unique local file becomes one -i input. Index map is used below.
  const inputs: string[] = []
  const inputIndex = new Map<string, number>()
  function ensureInput(path: string): number {
    const hit = inputIndex.get(path)
    if (hit !== undefined) return hit
    const idx = inputs.length
    inputs.push(path)
    inputIndex.set(path, idx)
    return idx
  }

  const filterLines: string[] = []

  // Always start with a solid-color canvas matching the output so that we
  // can overlay every video clip on it. This also anchors the duration.
  filterLines.push(
    `color=c=black:s=${width}x${height}:d=${duration.toFixed(3)}:r=${project.output.fps}[base]`,
  )

  // ── video chain ──────────────────────────────────────────────────────
  let lastVideoLabel = "base"
  // Walk tracks from bottom → top. Bottom track clips render first;
  // higher-indexed tracks overlay on top.
  for (const track of videoTracks) {
    const clips = project.clips
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => a.start - b.start)
    for (const clip of clips) {
      const assetPath = localMediaPaths.get(clip.assetId)
      const asset = project.assets.find((a) => a.id === clip.assetId)
      if (!assetPath || !asset) continue
      if (asset.kind === "audio") continue

      const inputIdx = ensureInput(assetPath)

      // Build the clip's video node:  scale/pad → trim → set presentation timestamp.
      const rawLabel = `v${inputIdx}c${clip.id.replace(/[^a-zA-Z0-9]/g, "")}`

      const src = asset.kind === "image" ? `${inputIdx}:v` : `${inputIdx}:v`
      const loopFilter =
        asset.kind === "image"
          ? `loop=loop=-1:size=1:start=0,trim=duration=${clip.length.toFixed(3)},fps=${project.output.fps},`
          : `trim=start=${clip.trimIn.toFixed(3)}:duration=${clip.length.toFixed(3)},`
      let node =
        `[${src}]` +
        loopFilter +
        `setpts=PTS-STARTPTS+${clip.start.toFixed(3)}/TB,` +
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,` +
        `setsar=1`

      if (clip.textOverlay?.text) {
        const pos = clip.textOverlay.position
        const y =
          pos === "top"
            ? "40"
            : pos === "center"
              ? "(h-text_h)/2"
              : "h-text_h-60"
        const fontSize = Math.max(16, Math.min(128, clip.textOverlay.fontSize ?? Math.round(height / 16)))
        const color = clip.textOverlay.color ?? "white"
        node +=
          `,drawtext=text='${escDrawText(clip.textOverlay.text)}':` +
          `fontcolor=${color}:fontsize=${fontSize}:` +
          `x=(w-text_w)/2:y=${y}:` +
          `box=1:boxcolor=black@0.4:boxborderw=12`
      }

      filterLines.push(`${node}[${rawLabel}]`)

      // Overlay this clip on top of the running composite, gated by
      // its timeline window so it only appears during [start, start+length].
      const outLabel = `vmix_${rawLabel}`
      filterLines.push(
        `[${lastVideoLabel}][${rawLabel}]overlay=enable='between(t,${clip.start.toFixed(
          3,
        )},${(clip.start + clip.length).toFixed(3)})'[${outLabel}]`,
      )
      lastVideoLabel = outLabel
    }
  }

  // ── audio chain ──────────────────────────────────────────────────────
  const audioLabels: string[] = []
  for (const track of audioTracks) {
    const clips = project.clips
      .filter((c) => c.trackId === track.id)
      .sort((a, b) => a.start - b.start)
    for (const clip of clips) {
      const assetPath = localMediaPaths.get(clip.assetId)
      const asset = project.assets.find((a) => a.id === clip.assetId)
      if (!assetPath || !asset) continue
      if (asset.kind === "image") continue
      if (asset.kind === "video" && asset.hasAudio === false) continue
      if (track.muted) continue

      const inputIdx = ensureInput(assetPath)
      const label = `a${inputIdx}c${clip.id.replace(/[^a-zA-Z0-9]/g, "")}`
      const volume = clip.volume ?? 1

      const src = `${inputIdx}:a?`

      filterLines.push(
        `[${src}]atrim=start=${clip.trimIn.toFixed(3)}:duration=${clip.length.toFixed(
          3,
        )},asetpts=PTS-STARTPTS,adelay=${Math.round(clip.start * 1000)}|${Math.round(
          clip.start * 1000,
        )},volume=${volume.toFixed(3)}[${label}]`,
      )
      audioLabels.push(label)
    }
  }

  // Also mix in any video-clip native audio that isn't explicitly
  // duplicated onto an audio track. Simple rule for MVP: if the video
  // clip sits on the *bottom* video track AND has audio, include it
  // at volume 1 so talking-head cuts aren't silent.
  const bottomVideoTrack = videoTracks[0]
  if (bottomVideoTrack) {
    const clips = project.clips
      .filter((c) => c.trackId === bottomVideoTrack.id)
      .sort((a, b) => a.start - b.start)
    for (const clip of clips) {
      const assetPath = localMediaPaths.get(clip.assetId)
      const asset = project.assets.find((a) => a.id === clip.assetId)
      if (!assetPath || !asset) continue
      if (asset.kind !== "video") continue
      if (asset.hasAudio === false) continue

      const inputIdx = ensureInput(assetPath)
      const label = `nat${inputIdx}c${clip.id.replace(/[^a-zA-Z0-9]/g, "")}`
      filterLines.push(
        `[${inputIdx}:a?]atrim=start=${clip.trimIn.toFixed(
          3,
        )}:duration=${clip.length.toFixed(3)},asetpts=PTS-STARTPTS,adelay=${Math.round(
          clip.start * 1000,
        )}|${Math.round(clip.start * 1000)}[${label}]`,
      )
      audioLabels.push(label)
    }
  }

  let audioMapArg: string[] = []
  if (audioLabels.length === 0) {
    // No audio at all — synthesise a silent track so the output is still valid.
    filterLines.push(
      `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${duration.toFixed(
        3,
      )}[aout]`,
    )
    audioMapArg = ["-map", "[aout]"]
  } else if (audioLabels.length === 1) {
    filterLines.push(`[${audioLabels[0]}]anull[aout]`)
    audioMapArg = ["-map", "[aout]"]
  } else {
    filterLines.push(
      `${audioLabels.map((l) => `[${l}]`).join("")}amix=inputs=${audioLabels.length}:dropout_transition=0:normalize=0[aout]`,
    )
    audioMapArg = ["-map", "[aout]"]
  }

  const filterComplex = filterLines.join(";")

  // Build final arg list.
  const args: string[] = ["-y", "-hide_banner", "-loglevel", "error"]
  for (const path of inputs) {
    // Images need the -loop flag on the input so ffmpeg keeps feeding frames.
    const asset = project.assets.find(
      (a) => localMediaPaths.get(a.id) === path && a.kind === "image",
    )
    if (asset) {
      args.push("-loop", "1", "-t", duration.toFixed(3), "-i", path)
    } else {
      args.push("-i", path)
    }
  }

  args.push(
    "-filter_complex",
    filterComplex,
    "-map",
    `[${lastVideoLabel}]`,
    ...audioMapArg,
    "-c:v",
    "libx264",
    "-preset",
    preview ? "ultrafast" : "veryfast",
    "-crf",
    preview ? "28" : "22",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(project.output.fps),
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    "-t",
    duration.toFixed(3),
    outputPath,
  )

  return { args, outputPath, duration }
}
