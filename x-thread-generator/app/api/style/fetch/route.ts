import { NextRequest, NextResponse } from "next/server"
import {
  fetchSyndicationTweets,
  invalidateSyndicationCache,
  SyndicationError,
} from "@/lib/twitter-syndication"

// POST /api/style/fetch  { handle: "serafim" | "@serafim", fresh?: boolean }
// → 200 { handle, samples: string[], cached: boolean }
// → 429 { error, retryAfterSeconds }
// → 4xx / 5xx { error }
//
// Results are cached for 10 min per handle so repeated clicks don't burn
// the syndication endpoint's ~30/min budget. Pass `fresh: true` to bypass.
export async function POST(req: NextRequest) {
  let body: { handle?: unknown; fresh?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const handle = typeof body?.handle === "string" ? body.handle : ""
  if (!handle) {
    return NextResponse.json({ error: "handle (string) is required" }, { status: 400 })
  }

  if (body.fresh === true) invalidateSyndicationCache(handle)

  try {
    const out = await fetchSyndicationTweets(handle)
    return NextResponse.json(out)
  } catch (err) {
    if (err instanceof SyndicationError) {
      const payload: Record<string, unknown> = { error: err.message }
      if (err.retryAfterSeconds != null) payload.retryAfterSeconds = err.retryAfterSeconds
      return NextResponse.json(payload, { status: err.status })
    }
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
