"use client"

import { useState } from "react"

export type AuthorStyle = {
  handle?: string
  fetchedAt: number
  samples: string[]
  active: boolean
}

const MIN_SAMPLES = 3
const MAX_SAMPLES = 10

function cleanSampleClient(raw: string): string | null {
  let s = raw
    .replace(/https?:\/\/t\.co\/\S+/g, "")
    .replace(/^RT @\S+:\s*/, "")
    .replace(/^(@\S+\s+)+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  if (s.length < 10) return null
  if (s.length > 280) s = s.slice(0, 280).trimEnd()
  return s
}

function samplesFromPaste(text: string): string[] {
  // Split on blank-line boundaries first (tweets often have embedded newlines),
  // then fall back to single-line splits. Dedupe by prefix.
  const blocks = text
    .split(/\n\s*\n+/)
    .flatMap((b) => (b.includes("\n") ? [b] : b.split("\n")))
  const seen = new Set<string>()
  const out: string[] = []
  for (const b of blocks) {
    const cleaned = cleanSampleClient(b)
    if (!cleaned) continue
    const key = cleaned.slice(0, 60).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cleaned)
    if (out.length >= MAX_SAMPLES) break
  }
  return out
}

interface VoiceReferenceProps {
  style: AuthorStyle | null
  onChange: (next: AuthorStyle | null) => void
}

export function VoiceReference({ style, onChange }: VoiceReferenceProps) {
  const [paste, setPaste] = useState("")
  const [handle, setHandle] = useState("")
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  async function tryFetch(opts: { handleOverride?: string; fresh?: boolean } = {}) {
    const h = (opts.handleOverride ?? handle).trim().replace(/^@/, "")
    if (!h) {
      setError("Enter a handle or paste tweets below.")
      return
    }
    setError(null)
    setFetching(true)
    try {
      const res = await fetch("/api/style/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: h, fresh: !!opts.fresh }),
      })
      const data = (await res.json()) as {
        handle?: string
        samples?: string[]
        error?: string
        retryAfterSeconds?: number
      }
      if (!res.ok || !data.samples || data.samples.length === 0) {
        const base = data.error || `Couldn't fetch @${h}. Paste tweets manually below.`
        setError(
          data.retryAfterSeconds
            ? `${base} (retry in ${data.retryAfterSeconds}s)`
            : base,
        )
        return
      }
      onChange({
        handle: data.handle,
        fetchedAt: Date.now(),
        samples: data.samples.slice(0, MAX_SAMPLES),
        active: true,
      })
      setPaste("")
      setHandle("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed")
    } finally {
      setFetching(false)
    }
  }

  function loadPaste() {
    const samples = samplesFromPaste(paste)
    if (samples.length < MIN_SAMPLES) {
      setError(`Need at least ${MIN_SAMPLES} non-empty tweets (got ${samples.length}).`)
      return
    }
    setError(null)
    onChange({
      handle: handle.trim().replace(/^@/, "") || undefined,
      fetchedAt: Date.now(),
      samples,
      active: true,
    })
    setPaste("")
    setHandle("")
  }

  function toggleActive() {
    if (!style) return
    onChange({ ...style, active: !style.active })
  }

  function clearAll() {
    onChange(null)
    setPaste("")
    setHandle("")
    setError(null)
    setShowAll(false)
  }

  // LOADED
  if (style && style.samples.length > 0) {
    const ageMin = Math.max(1, Math.round((Date.now() - style.fetchedAt) / 60_000))
    const visible = showAll ? style.samples : style.samples.slice(0, 3)
    return (
      <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-2.5">
        <div className="flex items-center gap-1.5 text-[11px]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            {style.samples.length} sample{style.samples.length === 1 ? "" : "s"}
          </span>
          {style.handle && (
            <span className="text-neutral-500 truncate">· @{style.handle}</span>
          )}
          <span className="ml-auto text-neutral-400">
            {ageMin < 60 ? `${ageMin}m` : `${Math.round(ageMin / 60)}h`}
          </span>
        </div>

        <ul className="space-y-1 text-[11px]">
          {visible.map((s, i) => (
            <li key={i} className="text-neutral-600 dark:text-neutral-400 line-clamp-2 pl-2 border-l border-neutral-200 dark:border-neutral-800">
              {s}
            </li>
          ))}
          {style.samples.length > 3 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-[10px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline-offset-2 hover:underline"
              >
                {showAll ? "show less" : `show ${style.samples.length - 3} more`}
              </button>
            </li>
          )}
        </ul>

        <label className="flex items-center gap-2 pt-1 cursor-pointer select-none">
          <span
            className={`relative inline-block h-4 w-7 rounded-full transition-colors ${
              style.active ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                style.active ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </span>
          <input type="checkbox" checked={style.active} onChange={toggleActive} className="sr-only" />
          <span className="text-[11px] text-neutral-700 dark:text-neutral-300">
            Match my voice
          </span>
        </label>

        <div className="flex items-center gap-1 pt-0.5">
          {style.handle && (
            <button
              type="button"
              onClick={() => tryFetch({ handleOverride: style.handle, fresh: true })}
              disabled={fetching}
              className="h-6 rounded border border-neutral-200 dark:border-neutral-800 px-2 text-[10px] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 disabled:opacity-50"
            >
              {fetching ? "…" : "refresh"}
            </button>
          )}
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto h-6 rounded px-2 text-[10px] text-neutral-500 hover:text-red-500"
          >
            clear
          </button>
        </div>
      </div>
    )
  }

  // EMPTY
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-neutral-400 text-[11px]">@</span>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="handle"
          disabled={fetching}
          className="flex-1 h-7 rounded border border-neutral-200 dark:border-neutral-800 bg-transparent px-2 text-[12px] outline-none focus:border-neutral-400 dark:focus:border-neutral-600 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => tryFetch()}
          disabled={fetching || !handle.trim()}
          className="h-7 rounded bg-neutral-900 dark:bg-neutral-100 px-2.5 text-[11px] font-medium text-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-40"
        >
          {fetching ? "…" : "try fetch"}
        </button>
      </div>

      <div className="relative">
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={`Or paste 3–${MAX_SAMPLES} of your tweets (one per line or blank-line separated).`}
          rows={4}
          className="w-full resize-none rounded border border-neutral-200 dark:border-neutral-800 bg-transparent px-2 py-1.5 text-[12px] leading-[1.4] outline-none focus:border-neutral-400 dark:focus:border-neutral-600 placeholder:text-neutral-400"
        />
      </div>

      <button
        type="button"
        onClick={loadPaste}
        disabled={paste.trim().length === 0}
        className="w-full h-7 rounded bg-neutral-900 dark:bg-neutral-100 text-[11px] font-medium text-white dark:text-neutral-900 hover:opacity-90 disabled:opacity-40"
      >
        Load samples
      </button>

      {error && (
        <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}

export function sanitizeAuthorStyle(raw: unknown): AuthorStyle | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.samples)) return null
  const samples = o.samples.filter((s): s is string => typeof s === "string").slice(0, MAX_SAMPLES)
  if (samples.length === 0) return null
  return {
    handle: typeof o.handle === "string" ? o.handle : undefined,
    fetchedAt: typeof o.fetchedAt === "number" ? o.fetchedAt : Date.now(),
    samples,
    active: o.active !== false,
  }
}
