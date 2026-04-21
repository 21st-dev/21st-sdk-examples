import { createWriteStream } from "fs"
import { mkdir, stat } from "fs/promises"
import { join } from "path"
import { Readable } from "stream"
import { finished } from "stream/promises"

const CACHE_DIR = "/tmp/video-editor/media"

/** Stable local path for a given URL. We cache by URL so re-renders are cheap. */
export function cachePathForUrl(url: string, preferredExt?: string): string {
  const hash = Buffer.from(url)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 32)
  const ext = preferredExt || guessExt(url) || "bin"
  return join(CACHE_DIR, `${hash}.${ext}`)
}

function guessExt(url: string): string | null {
  const m = url.toLowerCase().match(/\.([a-z0-9]{2,5})(?:\?|#|$)/)
  return m ? m[1]! : null
}

export async function ensureLocalCopy(url: string, preferredExt?: string): Promise<string> {
  await mkdir(CACHE_DIR, { recursive: true })
  const dst = cachePathForUrl(url, preferredExt)

  try {
    const s = await stat(dst)
    if (s.size > 0) return dst
  } catch {
    // not cached yet
  }

  const res = await fetch(url)
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}) for ${url}`)
  }
  const body = Readable.fromWeb(res.body as unknown as import("node:stream/web").ReadableStream)
  await finished(body.pipe(createWriteStream(dst)))
  return dst
}
