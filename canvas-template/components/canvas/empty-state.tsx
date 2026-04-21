"use client"

import { ArrowRight, Grid3x3, LayoutDashboard, Rocket, Table2 } from "lucide-react"

const SUGGESTIONS: Array<{
  title: string
  description: string
  icon: React.ElementType
  prompt: string
}> = [
  {
    title: "Hero section",
    description: "Bold gradient headline with a primary CTA",
    icon: Rocket,
    prompt:
      "Make app/page.tsx a bold hero section with gradient text, a primary CTA, and a subtle background pattern. Tailwind. Then call start_dev_server.",
  },
  {
    title: "Pricing table",
    description: "Three tiers with a highlighted middle plan",
    icon: Table2,
    prompt:
      "Replace app/page.tsx with a 3-tier pricing table (Free $0, Pro $15, Team $40). Highlight the middle tier. Tailwind. Then call start_dev_server.",
  },
  {
    title: "Feature grid",
    description: "Six cards with icons and short copy",
    icon: Grid3x3,
    prompt:
      "Build a 6-card feature grid on app/page.tsx — each card has an emoji, a short headline, and one sentence of body copy. Tailwind. Then call start_dev_server.",
  },
  {
    title: "Dashboard layout",
    description: "Sidebar, metric cards, and a chart area",
    icon: LayoutDashboard,
    prompt:
      "Create a minimal dashboard on app/page.tsx: sidebar navigation, top stats row (4 metric cards), and a big chart area (static placeholder). Tailwind. Then call start_dev_server.",
  },
]

export function EmptyCanvas({
  onPick,
}: {
  onPick: (prompt: string) => void
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="pointer-events-auto w-full max-w-[540px] space-y-4 rounded-xl border border-border/80 bg-background/95 p-5 shadow-xl backdrop-blur-md">
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
            Canvas Template
          </div>
          <h2 className="text-[16px] font-semibold text-foreground">
            Describe what you want to build.
          </h2>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            The agent will edit{" "}
            <code className="rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground">
              app/page.tsx
            </code>{" "}
            inside its sandbox, then stream the live preview back into this
            canvas.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SUGGESTIONS.map((s) => {
            const Icon = s.icon
            return (
              <button
                key={s.title}
                type="button"
                onClick={() => onPick(s.prompt)}
                className="group flex items-start gap-2 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-left transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-accent hover:shadow-sm"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-[12px] font-medium text-foreground">
                    {s.title}
                    <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {s.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <div className="text-[11px] text-muted-foreground/80">
          Or type your own prompt in the chat panel →
        </div>
      </div>
    </div>
  )
}
