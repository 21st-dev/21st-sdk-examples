"use client"

import { ExternalLink } from "lucide-react"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"

const SHORTCUTS: Array<[string[], string]> = [
  [["V"], "Select tool"],
  [["H"], "Hand / pan"],
  [["T"], "Text"],
  [["R"], "Rectangle"],
  [["⌘", "Z"], "Undo"],
  [["⌘", "⇧", "Z"], "Redo"],
]

export function HelpTab() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center border-b border-border/60 px-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Help
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <section className="space-y-1.5">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            What is this
          </h3>
          <p className="text-[12px] leading-relaxed text-foreground/80">
            A reference implementation of an AI canvas built on the 21st SDK.
            The agent lives in its own E2B sandbox; it edits a Next.js app and
            the result streams back into your canvas as an iframe shape.
          </p>
        </section>

        <Separator className="my-4" />

        <section className="space-y-2">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Shortcuts
          </h3>
          <ul className="space-y-1">
            {SHORTCUTS.map(([keys, label]) => (
              <li
                key={label}
                className="flex items-center justify-between text-[12px]"
              >
                <span className="text-foreground/80">{label}</span>
                <span className="flex items-center gap-1">
                  {keys.map((k, i) => (
                    <Kbd key={i}>{k}</Kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <Separator className="my-4" />

        <section className="space-y-1.5">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Docs
          </h3>
          <ul className="space-y-1 text-[12px]">
            <li>
              <a
                href="https://21st.dev/agents/docs"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                21st SDK Agents <ExternalLink className="!size-3" />
              </a>
            </li>
            <li>
              <a
                href="https://tldraw.dev"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                tldraw <ExternalLink className="!size-3" />
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
