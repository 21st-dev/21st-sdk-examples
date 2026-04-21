"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Periodically pings /api/preview to detect compile errors. Shows a big
 * red "Fix" button when the dev server returns a 500+ response while the
 * sandbox is otherwise alive.
 *
 * Clicking it sends a "fix the dev server errors" prompt to the agent.
 */
export function FixErrorsButton({
  sandboxId,
  onFix,
}: {
  sandboxId: string
  onFix: () => void
}) {
  const [errorVisible, setErrorVisible] = useState(false)
  const [errorCode, setErrorCode] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null

    async function probe() {
      try {
        const r = await fetch(
          `/api/preview?sandboxId=${encodeURIComponent(sandboxId)}&port=3000`,
        )
        if (!r.ok) return
        const data = (await r.json()) as { url: string; live: boolean }
        if (cancelled) return
        if (data.live) {
          setErrorVisible(false)
          setErrorCode(null)
          return
        }
        // Not live — double-check with a raw fetch to the preview URL.
        // A 5xx from the E2B proxy means the dev server is erroring.
        try {
          const raw = await fetch(data.url, {
            method: "HEAD",
            signal: AbortSignal.timeout(4000),
          })
          if (raw.status >= 500) {
            setErrorCode(raw.status)
            setErrorVisible(true)
          } else {
            setErrorVisible(false)
            setErrorCode(null)
          }
        } catch {
          // Fetch failure = not listening at all → not a compile error.
          setErrorVisible(false)
          setErrorCode(null)
        }
      } catch {}
    }

    probe()
    intervalId = setInterval(probe, 12_000)
    return () => {
      cancelled = true
      if (intervalId) clearInterval(intervalId)
    }
  }, [sandboxId])

  if (!errorVisible) return null

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-20">
      <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-destructive/40 bg-background/95 p-2 shadow-xl backdrop-blur-md">
        <AlertCircle className="!size-4 text-destructive" />
        <div className="text-[11px] text-destructive">
          Dev server errors detected
        </div>
        <Button
          size="sm"
          variant="destructive"
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={onFix}
        >
          <Wand2 className="!size-3" />
          Fix
        </Button>
      </div>
    </div>
  )
}
