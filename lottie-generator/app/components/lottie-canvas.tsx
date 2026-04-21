"use client"

import dynamic from "next/dynamic"
import type { LottieRefCurrentProps } from "lottie-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { RenderLottiePayload } from "../types"
import { LottieTimeline } from "./lottie-timeline"

const Lottie = dynamic(() => import("lottie-react"), { ssr: false })

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-fuchsia-500/40 to-cyan-500/40 blur-2xl" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-black/70 dark:text-white/70">No animation yet</p>
        <p className="max-w-xs text-xs text-black/40 dark:text-white/40">
          Describe an animation in the chat — e.g. <em>&ldquo;bouncing ball loader&rdquo;</em> — and the agent will generate a Lottie JSON.
        </p>
      </div>
    </div>
  )
}

export function LottieCanvas({ payload }: { payload: RenderLottiePayload | null }) {
  const lottieRef = useRef<LottieRefCurrentProps | null>(null)
  const [paused, setPaused] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [copied, setCopied] = useState(false)
  const hoverStateRef = useRef<{ wasPlaying: boolean; returnFrame: number } | null>(null)

  // Reset frame counter + unpause when a new animation arrives.
  const animationKey = payload ? `${payload.name}-${payload.layerCount}-${payload.durationSeconds}` : ""
  useEffect(() => {
    setCurrentFrame(0)
    setPaused(false)
  }, [animationKey])

  const jsonString = useMemo(() => {
    if (!payload) return ""
    return JSON.stringify(payload.animation, null, 2)
  }, [payload])

  const handleTogglePlay = useCallback(() => {
    const api = lottieRef.current
    if (!api) return
    if (paused) {
      api.play()
      setPaused(false)
    } else {
      api.pause()
      setPaused(true)
    }
  }, [paused])

  // Spacebar toggles play/pause (unless focus is inside an input/textarea)
  useEffect(() => {
    if (!payload) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== " " && e.code !== "Space") return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return
      e.preventDefault()
      handleTogglePlay()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [payload, handleTogglePlay])

  const handleRewind = useCallback(() => {
    const api = lottieRef.current
    if (!api) return
    api.goToAndPlay(0, true)
    setPaused(false)
    setCurrentFrame(0)
  }, [])

  const handleScrub = useCallback((frame: number) => {
    const api = lottieRef.current
    if (!api) return
    // Scrubbing commits the position — clear any hover state so we don't return.
    hoverStateRef.current = null
    api.goToAndStop(frame, true)
    setCurrentFrame(frame)
    setPaused(true)
  }, [])

  const handleHoverFrame = useCallback((frame: number | null) => {
    const api = lottieRef.current
    if (!api) return
    if (frame === null) {
      // Leave hover — restore prior state.
      const saved = hoverStateRef.current
      hoverStateRef.current = null
      if (saved) {
        if (saved.wasPlaying) {
          api.goToAndPlay(saved.returnFrame, true)
          setPaused(false)
        } else {
          api.goToAndStop(saved.returnFrame, true)
        }
        setCurrentFrame(saved.returnFrame)
      }
      return
    }
    // First hover event — snapshot where we were so we can return.
    if (!hoverStateRef.current) {
      hoverStateRef.current = { wasPlaying: !paused, returnFrame: currentFrame }
    }
    api.goToAndStop(frame, true)
    // Don't update currentFrame — keep the saved playhead position for the timeline.
  }, [paused, currentFrame])

  const handleCopy = useCallback(async () => {
    if (!jsonString) return
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }, [jsonString])

  const handleDownload = useCallback(() => {
    if (!payload || !jsonString) return
    const blob = new Blob([jsonString], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    const safeName = payload.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "animation"
    anchor.href = url
    anchor.download = `${safeName}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }, [payload, jsonString])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-black/[0.06] px-4 dark:border-white/[0.06]">
        <span className="text-[10px] font-medium uppercase tracking-widest text-black/35 dark:text-white/35">
          Preview
        </span>
        {payload ? (
          <span className="min-w-0 truncate text-sm font-medium">{payload.name}</span>
        ) : (
          <span className="text-sm text-black/40 dark:text-white/40">Waiting for agent</span>
        )}
        {payload && (
          <div className="ml-auto flex shrink-0 gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-black/60 transition-colors hover:bg-black/[0.05] hover:text-black/90 dark:text-white/60 dark:hover:bg-white/[0.05] dark:hover:text-white/90"
              title="Copy JSON to clipboard"
            >
              <CopyIcon />
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-xs font-medium text-background transition-opacity hover:opacity-90 active:scale-[0.97]"
              title="Download JSON"
            >
              <DownloadIcon />
              Download
            </button>
          </div>
        )}
      </div>

      {!payload ? (
        <div className="flex-1">
          <EmptyState />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="checker-bg flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6">
            <div className="max-h-full max-w-full" style={{ aspectRatio: `${payload.width} / ${payload.height}`, width: Math.min(payload.width, 520) }}>
              <Lottie
                key={animationKey}
                lottieRef={lottieRef}
                animationData={payload.animation}
                loop
                autoplay
                onEnterFrame={(e) => {
                  // Don't track frames while the user is hovering (we're showing a preview frame).
                  if (hoverStateRef.current) return
                  const raw = (e as { currentTime?: number } | undefined)?.currentTime
                  if (typeof raw === "number") setCurrentFrame(raw)
                }}
                style={{ width: "100%", height: "100%" }}
                rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
              />
            </div>
            {payload.description && (
              <p className="mx-auto max-w-md text-center text-xs text-black/60 dark:text-white/60">{payload.description}</p>
            )}
          </div>
          <div className="shrink-0 border-t border-black/[0.08] p-3 dark:border-white/[0.08]">
            <LottieTimeline
              payload={payload}
              currentFrame={currentFrame}
              paused={paused}
              onSeek={handleScrub}
              onHoverFrame={handleHoverFrame}
              onTogglePlay={handleTogglePlay}
              onRewind={handleRewind}
            />
          </div>
        </div>
      )}
    </div>
  )
}
