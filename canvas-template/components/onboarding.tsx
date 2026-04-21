"use client"

import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  MessageSquareText,
  MonitorPlay,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { hasSeenTourAtom } from "@/lib/ui-atoms"

const STEPS: Array<{
  title: string
  body: string
  icon: React.ElementType
}> = [
  {
    icon: Sparkles,
    title: "Welcome to Canvas Template",
    body: "A minimal reference for building AI-powered canvas products on top of the 21st SDK. The agent lives in its own E2B sandbox; it edits a Next.js app and the result streams back into your canvas.",
  },
  {
    icon: MessageSquareText,
    title: "Ask for what you want",
    body: "Type a prompt in the right panel. The agent reads and writes files in its sandbox and calls start_dev_server when it's ready to show you the result.",
  },
  {
    icon: MonitorPlay,
    title: "Your result lives on the canvas",
    body: "When the dev server is up, a variant shape appears on the canvas with a live iframe. Drag it around, resize it, or open it full-screen from the toolbar.",
  },
  {
    icon: ImageIcon,
    title: "Bring your own context",
    body: "Drag images onto the canvas — the agent will see them as reference. Select shapes to pin them as explicit context for your next message.",
  },
]

export function Onboarding() {
  const [seen, setSeen] = useAtom(hasSeenTourAtom)
  const [step, setStep] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (seen) return
    const t = setTimeout(() => setOpen(true), 400)
    return () => clearTimeout(t)
  }, [seen])

  const dismiss = () => {
    localStorage.setItem("canvas-template:seen-tour", "1")
    setSeen(true)
    setOpen(false)
  }

  if (seen) return null

  const current = STEPS[step] ?? STEPS[0]!
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) dismiss()
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-[480px]">
        <DialogHeader className="space-y-3 border-b border-border/60 p-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-primary">
                Tour · {step + 1}/{STEPS.length}
              </div>
              <DialogTitle className="text-[15px]">{current.title}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-[13px] leading-relaxed">
            {current.body}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex items-center justify-between gap-2 p-4 sm:justify-between">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-6 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => s - 1)}
              >
                <ArrowLeft /> Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
            >
              {isLast ? "Get started" : "Next"}
              {!isLast && <ArrowRight />}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
