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

export type BrowserUseConfigResult =
  | { ok: true; apiKey: string; baseUrl: string }
  | { ok: false; error: string }

export function getBrowserUseConfig(): BrowserUseConfigResult {
  const apiKey = getEnv("BROWSER_USE_API_KEY")
  const baseUrl = getEnv("BROWSER_USE_BASE_URL") || "https://api.browser-use.com/api/v2"

  if (!apiKey) {
    return {
      ok: false,
      error:
        "BROWSER_USE_API_KEY is not configured in runtime env. Set it in 21st dashboard env vars and redeploy.",
    }
  }

  return { ok: true, apiKey, baseUrl }
}
