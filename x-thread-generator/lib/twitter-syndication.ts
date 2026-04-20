// Fetches a user's recent public tweets via Twitter's embed syndication
// endpoint — the same one the official embed scripts use. No auth, no keys,
// no paid APIs. Best-effort: the endpoint is unofficial and can change or
// rate-limit; callers MUST have a fallback (paste mode).

const MAX_SAMPLES = 10
const MIN_LEN = 10
const MAX_LEN = 280
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/

export class SyndicationError extends Error {
  status: number
  retryAfterSeconds?: number
  constructor(message: string, status = 502, retryAfterSeconds?: number) {
    super(message)
    this.name = "SyndicationError"
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

// Per-handle in-memory cache. Module-scoped so it survives across requests
// in dev (Next route handlers share module state). Keyed by lowercased handle.
type CacheEntry = { handle: string; samples: string[]; fetchedAt: number }
const cache = new Map<string, CacheEntry>()

export function normalizeHandle(raw: string): string {
  const h = raw.trim().replace(/^@/, "")
  if (!HANDLE_RE.test(h)) {
    throw new SyndicationError("Handle must be 1–15 chars of letters/digits/underscore.", 400)
  }
  return h
}

// Normalize one raw tweet string into something worth using as a style sample.
// Returns null for tweets that shouldn't be kept.
export function cleanSample(raw: string): string | null {
  let s = raw
  // unescape JSON-ish sequences if caller passed them literal
  s = s.replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\\t/g, " ")
  s = s.replace(/\\"/g, '"').replace(/\\\\/g, "\\")
  s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))

  // strip t.co shortlinks (embed-only noise)
  s = s.replace(/https?:\/\/t\.co\/\S+/g, "")
  // strip leading RT prefix (retweet quote)
  s = s.replace(/^RT @\S+:\s*/, "")
  // strip leading @-mention stack (replies)
  s = s.replace(/^(@\S+\s+)+/, "")
  // collapse triple newlines
  s = s.replace(/\n{3,}/g, "\n\n")
  s = s.trim()

  if (s.length < MIN_LEN) return null
  if (s.length > MAX_LEN) s = s.slice(0, MAX_LEN).trimEnd()
  return s
}

// Pulls "full_text":"..." occurrences out of the HTML, JSON-unescapes, cleans,
// dedupes. Intentionally loose — the embed endpoint's internal JSON shape
// changes; anchoring on the field name is more durable than a schema parse.
export function extractTweetsFromHtml(html: string): string[] {
  const re = /"full_text":"((?:[^"\\]|\\.)*)"/g
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of html.matchAll(re)) {
    const cleaned = cleanSample(m[1])
    if (!cleaned) continue
    const key = cleaned.slice(0, 60).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
    if (out.length >= MAX_SAMPLES) break
  }
  return out
}

export async function fetchSyndicationTweets(
  handleRaw: string,
): Promise<{ handle: string; samples: string[]; cached: boolean }> {
  const handle = normalizeHandle(handleRaw)
  const cacheKey = handle.toLowerCase()

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { handle: cached.handle, samples: cached.samples, cached: true }
  }

  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${handle}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://platform.twitter.com/",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    })
  } catch (err) {
    throw new SyndicationError(`network: ${String(err)}`, 502)
  }

  if (res.status === 404) {
    throw new SyndicationError(`No public profile for @${handle}`, 404)
  }

  if (res.status === 429) {
    const reset = Number(res.headers.get("x-rate-limit-reset"))
    const retryAfterSeconds =
      Number.isFinite(reset) && reset > 0
        ? Math.max(1, reset - Math.floor(Date.now() / 1000))
        : 60
    throw new SyndicationError(
      `Twitter rate-limited the request. Try again in ~${retryAfterSeconds}s, or paste tweets below.`,
      429,
      retryAfterSeconds,
    )
  }

  if (!res.ok) {
    throw new SyndicationError(`Syndication returned ${res.status}`, 502)
  }

  const html = await res.text()
  const samples = extractTweetsFromHtml(html)
  if (samples.length === 0) {
    throw new SyndicationError(
      `No public tweets found for @${handle}. The account may be private, suspended, or new.`,
      404,
    )
  }

  cache.set(cacheKey, { handle, samples, fetchedAt: Date.now() })
  return { handle, samples, cached: false }
}

// Drop a handle from the cache so the next call re-fetches. Used by the
// "refresh" button in <VoiceReference />.
export function invalidateSyndicationCache(handleRaw: string) {
  try {
    cache.delete(normalizeHandle(handleRaw).toLowerCase())
  } catch {}
}
