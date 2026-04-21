/**
 * Upload a rendered MP4 from the sandbox to somewhere the browser can play it.
 *
 * Two backends, picked in order:
 *
 *   1. Supabase Storage — if `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` are set,
 *      upload to the `video-renders` public bucket (create it once, see README).
 *      This is the path every serious fork should use.
 *
 *   2. catbox.moe — free, no-auth, 200 MB limit, anonymous uploads live for
 *      months. Works out of the box so the template runs without any extra
 *      credentials.
 *
 * The returned URL is passed back to the UI in the tool output and the
 * `<video>` element in the preview panel just plays it.
 */

import { readFile } from "fs/promises"
import { basename } from "path"
import { getEnv } from "./env"

export interface UploadResult {
  url: string
  backend: "supabase" | "catbox"
  bytes: number
}

export async function uploadRender(localPath: string, remoteName: string): Promise<UploadResult> {
  const supabaseUrl = getEnv("SUPABASE_URL")
  const supabaseKey = getEnv("SUPABASE_SERVICE_KEY") || getEnv("SUPABASE_SERVICE_ROLE_KEY")
  const bucket = getEnv("SUPABASE_VIDEO_BUCKET") || "video-renders"

  const buf = await readFile(localPath)

  if (supabaseUrl && supabaseKey) {
    const objectPath = `${Date.now()}_${remoteName}`
    const endpoint = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/${bucket}/${objectPath}`
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "video/mp4",
        "Cache-Control": "3600",
        "x-upsert": "true",
      },
      body: new Uint8Array(buf),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Supabase upload failed (${res.status}): ${text.slice(0, 300)}`)
    }
    const publicUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${objectPath}`
    return { url: publicUrl, backend: "supabase", bytes: buf.byteLength }
  }

  // Fallback: catbox.moe (multipart/form-data via global FormData + Blob).
  const form = new FormData()
  form.append("reqtype", "fileupload")
  form.append(
    "fileToUpload",
    new Blob([new Uint8Array(buf)], { type: "video/mp4" }),
    basename(remoteName),
  )
  const res = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: form,
  })
  const text = (await res.text()).trim()
  if (!res.ok || !text.startsWith("http")) {
    throw new Error(`catbox.moe upload failed (${res.status}): ${text.slice(0, 300)}`)
  }
  return { url: text, backend: "catbox", bytes: buf.byteLength }
}
