import { tool } from "@21st-sdk/agent"
import { mkdir } from "fs/promises"
import { join } from "path"
import { z } from "zod"
import { opSchema, projectSchema } from "./project-schema"
import { compileProject } from "./ffmpeg/compile"
import { ensureLocalCopy } from "./ffmpeg/download"
import { ensureFfmpeg, probeMedia, runCommand } from "./ffmpeg/run"
import { uploadRender } from "./storage"

export function textResult(data: object, isError = false) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    ...(isError ? { isError: true } : {}),
  }
}

const WORK_ROOT = "/tmp/video-editor/renders"

export const videoEditorTools = {
  /**
   * Probe a media URL to get its duration, dimensions, and audio-track
   * presence. The UI calls this through the agent when a user pastes a
   * fresh URL so the asset card can show a proper duration and so
   * `add_clip` ops know valid `length` bounds.
   */
  probe_asset: tool({
    description:
      "Probe a media URL with ffprobe and return { duration, width, height, hasAudio, videoCodec, audioCodec }.",
    inputSchema: z.object({
      url: z.string().url(),
      kind: z.enum(["video", "image", "audio"]).optional(),
    }),
    execute: async ({ url, kind }) => {
      const ffmpegCheck = await ensureFfmpeg()
      if (!ffmpegCheck.ok) return textResult({ error: ffmpegCheck.error }, true)

      if (kind === "image") {
        // Images don't have a duration; probe returns 0.
        try {
          const info = await probeMedia(url)
          return textResult({
            url,
            duration: 0,
            width: info.width,
            height: info.height,
            hasAudio: false,
            videoCodec: info.videoCodec,
            audioCodec: null,
          })
        } catch (err) {
          return textResult(
            { error: err instanceof Error ? err.message : String(err), url },
            true,
          )
        }
      }

      try {
        const info = await probeMedia(url)
        return textResult({ url, ...info })
      } catch (err) {
        return textResult(
          { error: err instanceof Error ? err.message : String(err), url },
          true,
        )
      }
    },
  }),

  /**
   * Mutate the timeline project. The client holds the canonical state;
   * the agent sends ops and a human-readable summary, the client applies
   * them through the same reducer that powers drag-edits.
   */
  update_timeline: tool({
    description: [
      "Apply one or more ops to the user's current timeline project.",
      "The client state is the source of truth — you only send ops, never the full project.",
      "Ops include: add_asset, update_asset, remove_asset, add_clip, remove_clip, move_clip, trim_clip, set_volume, set_text_overlay, set_output, add_track, remove_track, clear_timeline.",
    ].join(" "),
    inputSchema: z.object({
      ops: z.array(opSchema).min(1),
      summary: z.string().min(1),
    }),
    execute: async ({ ops, summary }) => {
      // Validation happens automatically via zod. We echo back the ops so
      // the UI can replay them through its reducer.
      return textResult({ ops, summary, count: ops.length })
    },
  }),

  /**
   * Render the whole project to MP4 using ffmpeg in this sandbox, then
   * upload the result so the browser can play it.
   */
  render_project: tool({
    description:
      "Render the given project with ffmpeg in the sandbox and upload the result. Returns the public URL. Set preview=true for a fast low-quality render while iterating.",
    inputSchema: z.object({
      project: projectSchema,
      preview: z.boolean().optional(),
    }),
    execute: async ({ project, preview }) => {
      const ffmpegCheck = await ensureFfmpeg()
      if (!ffmpegCheck.ok) return textResult({ error: ffmpegCheck.error }, true)

      if (project.clips.length === 0) {
        return textResult({ error: "Timeline is empty. Add at least one clip before rendering." }, true)
      }

      // Resolve every referenced asset to a local copy.
      const localMediaPaths = new Map<string, string>()
      for (const asset of project.assets) {
        // Only download assets actually used by a clip.
        if (!project.clips.some((c) => c.assetId === asset.id)) continue
        try {
          const path = await ensureLocalCopy(asset.url)
          localMediaPaths.set(asset.id, path)
        } catch (err) {
          return textResult(
            {
              error: `Failed to download asset ${asset.label} (${asset.url}): ${err instanceof Error ? err.message : err}`,
            },
            true,
          )
        }
      }

      await mkdir(WORK_ROOT, { recursive: true })
      const jobId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
      const outputPath = join(WORK_ROOT, `render_${jobId}.mp4`)

      let compiled
      try {
        compiled = compileProject({
          project,
          localMediaPaths,
          outputPath,
          preview: !!preview,
        })
      } catch (err) {
        return textResult(
          { error: `compile: ${err instanceof Error ? err.message : err}` },
          true,
        )
      }

      const started = Date.now()
      const run = await runCommand("ffmpeg", compiled.args, { timeoutMs: 10 * 60 * 1000 })
      const elapsedMs = Date.now() - started
      if (run.code !== 0) {
        return textResult(
          {
            error: `ffmpeg exited with code ${run.code}`,
            stderr: run.stderr.slice(-2000),
            elapsedMs,
            // Surface the command so scaling forks can debug their graph.
            ffmpegArgs: compiled.args,
          },
          true,
        )
      }

      let upload
      try {
        upload = await uploadRender(outputPath, `project_${jobId}.mp4`)
      } catch (err) {
        return textResult(
          {
            error: `upload: ${err instanceof Error ? err.message : err}`,
            elapsedMs,
          },
          true,
        )
      }

      return textResult({
        url: upload.url,
        backend: upload.backend,
        duration: compiled.duration,
        preview: !!preview,
        bytes: upload.bytes,
        elapsedMs,
      })
    },
  }),
}
