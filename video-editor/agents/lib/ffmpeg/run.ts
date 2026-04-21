/**
 * Wrappers around `ffprobe` and `ffmpeg` subprocesses.
 * Pure functions — no global state. Every call spawns a fresh process.
 */

import { spawn } from "child_process"

export interface RunResult {
  code: number | null
  stdout: string
  stderr: string
}

export async function runCommand(
  bin: string,
  args: string[],
  opts: { input?: string; timeoutMs?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["pipe", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    let settled = false

    const timer = opts.timeoutMs
      ? setTimeout(() => {
          settled = true
          child.kill("SIGKILL")
          reject(new Error(`${bin} timed out after ${opts.timeoutMs}ms`))
        }, opts.timeoutMs)
      : null

    child.stdout.on("data", (d) => {
      stdout += d.toString()
    })
    child.stderr.on("data", (d) => {
      stderr += d.toString()
    })
    child.on("error", (err) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      reject(err)
    })
    child.on("close", (code) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })

    if (opts.input) {
      child.stdin.write(opts.input)
      child.stdin.end()
    } else {
      child.stdin.end()
    }
  })
}

export async function ensureFfmpeg(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { code } = await runCommand("ffmpeg", ["-version"], { timeoutMs: 5000 })
    if (code === 0) return { ok: true }
  } catch {
    // fall through
  }
  return {
    ok: false,
    error:
      "`ffmpeg` is not installed in this sandbox. See README → Scaling to production for how to bake it into the image.",
  }
}

export interface ProbedMedia {
  duration: number | null
  width: number | null
  height: number | null
  hasAudio: boolean
  videoCodec: string | null
  audioCodec: string | null
}

export async function probeMedia(url: string): Promise<ProbedMedia> {
  const { code, stdout, stderr } = await runCommand(
    "ffprobe",
    [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      "-analyzeduration",
      "5M",
      "-probesize",
      "5M",
      url,
    ],
    { timeoutMs: 30_000 },
  )
  if (code !== 0) {
    throw new Error(`ffprobe failed (code ${code}): ${stderr.trim().slice(0, 400)}`)
  }
  const data = JSON.parse(stdout) as {
    format?: { duration?: string }
    streams?: Array<{
      codec_type?: string
      codec_name?: string
      width?: number
      height?: number
    }>
  }
  const videoStream = data.streams?.find((s) => s.codec_type === "video")
  const audioStream = data.streams?.find((s) => s.codec_type === "audio")
  const duration = data.format?.duration ? Number.parseFloat(data.format.duration) : null

  return {
    duration: duration && Number.isFinite(duration) ? duration : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    hasAudio: !!audioStream,
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
  }
}
