"use client"

import { useMemo } from "react"
import { ListTodo } from "lucide-react"
import type { UIMessage } from "ai"
import { cn } from "@/lib/cn"

type PlanStep = { label: string; status: "pending" | "in_progress" | "done" }

/**
 * Parse a plan-mode assistant message into numbered steps. We don't ask the
 * agent for a structured format — we just detect ordered/unordered list
 * lines in the latest assistant text.
 */
function extractPlan(messages: UIMessage[]): PlanStep[] {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
  if (!lastAssistant) return []
  const text = (lastAssistant.parts ?? [])
    .filter((p): p is { type: "text"; text: string } => (p as any).type === "text")
    .map((p) => p.text)
    .join("\n")
  const lines = text.split("\n").map((l) => l.trim())
  const steps: PlanStep[] = []
  for (const line of lines) {
    const m = /^(?:\d+[.)]|[-*])\s+(.{3,})$/.exec(line)
    if (m?.[1]) {
      const label = m[1].replace(/\*\*/g, "").trim()
      const done = /\b(done|completed|✓)\b/i.test(label)
      steps.push({ label, status: done ? "done" : "pending" })
    }
  }
  return steps
}

/**
 * A compact visual plan overlay shown when plan mode is active and the
 * agent has proposed a numbered plan. Mirrors the 21st canvas plan-preview
 * look: left-aligned steps, circular status indicators, progress bar.
 */
export function PlanOverlay({
  messages,
  visible,
}: {
  messages: UIMessage[]
  visible: boolean
}) {
  const steps = useMemo(() => extractPlan(messages), [messages])
  if (!visible || steps.length === 0) return null

  const done = steps.filter((s) => s.status === "done").length
  const pct = Math.round((done / steps.length) * 100)

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
      <div className="pointer-events-auto w-[420px] max-w-[calc(100vw-32px)] rounded-xl border border-border/70 bg-background/95 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <ListTodo className="!size-3.5" />
          </div>
          <div className="flex-1 text-[12px] font-medium">Plan</div>
          <div className="text-[10px] text-muted-foreground">
            {done}/{steps.length} · {pct}%
          </div>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="max-h-[180px] overflow-y-auto px-3 py-2">
          <ol className="space-y-1.5">
            {steps.map((s, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 text-[12px]",
                  s.status === "done" && "text-muted-foreground line-through",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border text-[8px]",
                    s.status === "done"
                      ? "border-primary bg-primary text-primary-foreground"
                      : s.status === "in_progress"
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {s.status === "done" ? "✓" : i + 1}
                </span>
                <span className="flex-1 leading-snug">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
