"use client"

import { useAtom } from "jotai"
import { useEffect } from "react"
import { ExternalLink, Keyboard, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { Separator } from "@/components/ui/separator"
import { isHelpCenterOpenAtom } from "@/lib/ui-atoms"

const SHORTCUTS: Array<[string[], string]> = [
  [["⌘", "?"], "Open this help dialog"],
  [["⌘", "K"], "Focus chat input"],
  [["V"], "Select tool"],
  [["H"], "Hand / pan"],
  [["T"], "Text"],
  [["R"], "Rectangle"],
  [["⌘", "Z"], "Undo"],
  [["⌘", "⇧", "Z"], "Redo"],
  [["Delete"], "Delete selected shape"],
]

const PRIMITIVES: Array<[string, string]> = [
  ["Variant shape", "A preview iframe of a page rendered by the dev server"],
  ["Reference image", "Drag images onto canvas — agent sees them as context"],
  ["Context pills", "Shapes you select become context for your next prompt"],
  ["Plan mode", "Toggle to make the agent outline steps before writing code"],
]

export function HelpCenterDialog() {
  const [open, setOpen] = useAtom(isHelpCenterOpenAtom)

  // Global hotkey: ⌘+? / Ctrl+?
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [setOpen])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="space-y-3 border-b border-border/60 p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[15px]">
                Canvas Template — Help
              </DialogTitle>
              <DialogDescription className="mt-1 text-[12px]">
                An AI canvas reference built on the 21st SDK.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[480px] overflow-y-auto p-6">
          <section className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Keyboard className="!size-3" /> Shortcuts
            </h3>
            <ul className="grid grid-cols-2 gap-y-1 gap-x-4">
              {SHORTCUTS.map(([keys, label], i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-[12px]"
                >
                  <span className="text-foreground/80">{label}</span>
                  <span className="flex items-center gap-1">
                    {keys.map((k, j) => (
                      <Kbd key={j}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <Separator className="my-5" />

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Canvas primitives
            </h3>
            <dl className="space-y-2">
              {PRIMITIVES.map(([name, desc]) => (
                <div
                  key={name}
                  className="rounded-md border border-border/50 bg-muted/30 p-2"
                >
                  <dt className="text-[12px] font-medium">{name}</dt>
                  <dd className="text-[11px] text-muted-foreground">{desc}</dd>
                </div>
              ))}
            </dl>
          </section>

          <Separator className="my-5" />

          <section className="space-y-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Docs & links
            </h3>
            <ul className="space-y-1 text-[12px]">
              <li>
                <a
                  href="https://21st.dev/agents/docs"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  21st SDK Agents docs <ExternalLink className="!size-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://tldraw.dev"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  tldraw docs <ExternalLink className="!size-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/21st-dev/21st-sdk-examples"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  21st SDK examples on GitHub <ExternalLink className="!size-3" />
                </a>
              </li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
