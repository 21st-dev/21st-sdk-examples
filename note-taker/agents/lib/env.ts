import { readFileSync } from "fs"

let sandboxEnvLoaded = false

function loadSandboxEnv() {
  if (sandboxEnvLoaded) return
  sandboxEnvLoaded = true

  try {
    const raw = readFileSync("/home/user/.env", "utf-8")
    for (const line of raw.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (!match) continue
      const key = match[1].trim()
      const value = match[2].trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // Sandbox .env is optional in local/dev contexts.
  }
}

export function getEnv(name: string): string {
  if (process.env[name]) return process.env[name] as string
  loadSandboxEnv()
  return process.env[name] ?? ""
}

export type ConvexConfigResult =
  | { ok: true; url: string }
  | { ok: false; error: string }

export function getConvexConfig(): ConvexConfigResult {
  const url = getEnv("CONVEX_URL")
  if (!url) return { ok: false, error: "CONVEX_URL is not configured. Set it in 21st dashboard env vars." }
  return { ok: true, url }
}
