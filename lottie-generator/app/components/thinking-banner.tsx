"use client"

import { useEffect, useMemo, useState } from "react"

// Time-based phase hints. The agent uses `runtime: "claude-code"` which batches
// output — the client sees nothing for 30-60s, then the full tool call at once.
// These labels give the user SOMETHING to read during the wait. Thresholds in
// seconds, checked last-match-wins.
const PHASES: Array<{ threshold: number; label: string }> = [
  { threshold: 0, label: "Interpreting prompt" },
  { threshold: 4, label: "Sketching composition" },
  { threshold: 10, label: "Choosing palette and timing" },
  { threshold: 20, label: "Writing keyframes" },
  { threshold: 40, label: "Assembling layers" },
  { threshold: 70, label: "Polishing animation" },
  { threshold: 110, label: "Still working — complex animations can take a minute" },
]

function pickPhase(elapsed: number) {
  let current = PHASES[0]
  for (const p of PHASES) {
    if (elapsed >= p.threshold) current = p
  }
  return current
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, "0")}`
}

function shortenPrompt(prompt: string): string {
  const trimmed = prompt.trim()
  if (trimmed.length <= 60) return trimmed
  return trimmed.slice(0, 57) + "…"
}

export function ThinkingBanner({
  prompt,
  startedAt,
}: {
  prompt: string
  startedAt: number
}) {
  const [now, setNow] = useState(() => Date.now())
  const [inputHeight, setInputHeight] = useState(200)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  // Measure the SDK's input bar so we can float the banner just above it,
  // regardless of textarea size or window width.
  useEffect(() => {
    const bar = document.querySelector(".an-input-bar") as HTMLElement | null
    if (!bar) return
    const update = () => setInputHeight(bar.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000))
  const phase = useMemo(() => pickPhase(elapsed), [elapsed])
  const short = shortenPrompt(prompt)

  return (
    <div
      className="pointer-events-none absolute inset-x-4 z-10"
      style={{ bottom: `${inputHeight + 8}px` }}
    >
      <div className="pointer-events-auto flex items-start gap-2 rounded-md border border-black/[0.08] bg-background/80 px-2.5 py-2 shadow-sm backdrop-blur-sm dark:border-white/[0.08] dark:bg-background/70">
        <span className="relative mt-[3px] inline-flex h-2 w-2 shrink-0 items-center justify-center">
          <span className="absolute h-2 w-2 animate-ping rounded-full bg-emerald-500/40" />
          <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="lottie-shimmer-text text-[12px]">
            Designing “{short}”
          </span>
          <span className="text-[11px] tabular-nums text-black/45 dark:text-white/45">
            {phase.label} · {fmtDuration(elapsed)}
          </span>
        </div>
      </div>
    </div>
  )
}

// Hides the SDK's built-in rotating "Working.../Crafting.../Brewing.../Preparing..."
// planning label so it doesn't fight with our own banner.
// The SDK renders it as a ToolRowBase with a <span> containing the literal text —
// we walk the message list and visibility-hide matching nodes.
const PLANNING_LABELS = new Set(["Working...", "Crafting...", "Brewing...", "Preparing..."])

export function useHideDefaultPlanningRow(active: boolean) {
  useEffect(() => {
    if (!active) return
    const list = document.querySelector(".an-message-list") as HTMLElement | null
    if (!list) return

    const hideIfPlanning = (root: HTMLElement) => {
      // Find any span whose trimmed text is one of the planning labels.
      const spans = root.querySelectorAll("span")
      for (const span of spans) {
        const t = span.textContent?.trim() ?? ""
        if (!PLANNING_LABELS.has(t)) continue
        // Walk up until we find the motion.div wrapper (first ancestor with motion styles).
        // Heuristic: hide the closest group row (contains 'flex items-center').
        let row: HTMLElement | null = span
        for (let i = 0; i < 6 && row; i++) {
          if (row.classList.contains("group") && row.classList.contains("flex")) break
          row = row.parentElement
        }
        const target = row ?? span.parentElement
        if (target) {
          // Hide the whole motion wrapper one level up so opacity animations don't fight.
          const wrapper = (target.parentElement as HTMLElement | null) ?? target
          wrapper.style.display = "none"
        }
      }
    }

    hideIfPlanning(list)
    const mo = new MutationObserver(() => hideIfPlanning(list))
    mo.observe(list, { childList: true, subtree: true, characterData: true })
    return () => mo.disconnect()
  }, [active])
}
