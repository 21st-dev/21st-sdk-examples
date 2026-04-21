import type { CustomToolRendererProps } from "@21st-sdk/react"

function parseOutput(output: unknown): Record<string, unknown> | null {
  if (!output) return null
  if (typeof output === "string") {
    try { return JSON.parse(output) } catch { return null }
  }
  if (Array.isArray(output)) {
    const textPart = (output as Array<{ type?: string; text?: string }>).find((it) => it.type === "text")
    if (!textPart?.text) return null
    try { return JSON.parse(textPart.text) } catch { return null }
  }
  if (typeof output === "object") return output as Record<string, unknown>
  return null
}

function SparkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 14.5 9.5 22 12 14.5 14.5 12 22 9.5 14.5 2 12 9.5 9.5Z" />
    </svg>
  )
}

function toNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

// Pull live progress signals from the partial `input` streaming in from the agent.
// Everything is best-effort — fields may be missing or truncated mid-stream.
function readStreamingProgress(input: Record<string, unknown> | undefined) {
  if (!input || typeof input !== "object") return null
  const anim = (input as { animation?: unknown }).animation
  if (!anim || typeof anim !== "object") return null
  const a = anim as Record<string, unknown>
  const w = toNum(a.w)
  const h = toNum(a.h)
  const fr = toNum(a.fr)
  const ip = toNum(a.ip)
  const op = toNum(a.op)
  const layers = Array.isArray(a.layers) ? a.layers.length : null
  const duration = fr && op !== null && ip !== null ? (op - ip) / fr : null
  return { w, h, fr, layers, duration }
}

function formatProgressLine(p: ReturnType<typeof readStreamingProgress>): string | null {
  if (!p) return null
  const bits: string[] = []
  if (p.layers !== null) bits.push(`${p.layers} layer${p.layers === 1 ? "" : "s"}`)
  if (p.duration !== null) bits.push(`${p.duration.toFixed(p.duration < 10 ? 1 : 0)}s`)
  if (p.fr !== null) bits.push(`${p.fr}fps`)
  if (p.w !== null && p.h !== null) bits.push(`${p.w}×${p.h}`)
  return bits.length > 0 ? bits.join(" · ") : null
}

export function RenderLottieRenderer({ input, output, status }: CustomToolRendererProps) {
  const data = parseOutput(output)
  const errorText = typeof data?.error === "string" ? data.error : null
  const successName = typeof data?.name === "string" ? data.name : null
  const streamingName = typeof input?.name === "string" ? (input.name as string) : null
  const streamingDesc = typeof input?.description === "string" ? (input.description as string) : null
  const successDesc = typeof data?.description === "string" ? (data.description as string) : null
  const name = successName ?? streamingName
  const desc = successDesc ?? streamingDesc

  const isStreaming = status === "pending" || status === "streaming"
  const progress = isStreaming ? readStreamingProgress(input) : null
  const progressLine = formatProgressLine(progress)

  // Label mirrors streaming milestones so users always see *something* advancing:
  //   no name yet → "Designing…"
  //   name present → "Rendering <name>"
  //   animation payload starting → "Building <N> layers · …"
  //   success → "Rendered <name>"
  let headline: string
  if (status === "error" || errorText) {
    headline = errorText ?? "render_lottie failed"
  } else if (status === "success") {
    headline = name ? `Rendered ${name}` : "Rendered animation"
  } else if (!name) {
    headline = "Designing…"
  } else if (progressLine && progress?.layers && progress.layers > 0) {
    headline = `Building ${name}`
  } else {
    headline = `Rendering ${name}`
  }

  const isError = status === "error" || Boolean(errorText)

  return (
    <div className="inline-flex max-w-full flex-col items-start gap-0.5 rounded-md border border-black/[0.08] bg-black/[0.03] px-2 py-1 text-[12px] text-black/70 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70">
      <div className="inline-flex items-center gap-1.5">
        <span className="text-black/40 dark:text-white/40"><SparkIcon /></span>
        {isError ? (
          <span className="text-red-600 dark:text-red-300">{headline}</span>
        ) : isStreaming ? (
          <span className="lottie-shimmer-text tabular-nums">{headline}</span>
        ) : (
          <span>{headline}</span>
        )}
      </div>
      {!isError && progressLine && isStreaming && (
        <span className="pl-[18px] text-[11px] tabular-nums text-black/45 dark:text-white/45">
          {progressLine}
        </span>
      )}
      {!isError && desc && (
        <span className="pl-[18px] text-[11px] text-black/50 dark:text-white/50 line-clamp-2">
          {desc}
        </span>
      )}
    </div>
  )
}
