"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAtom } from "jotai"
import type { UIMessage } from "ai"
import {
  Canvas,
  type CanvasHandle,
  type ShapeBrief,
} from "@/components/canvas/canvas"
import { ChatPanel, type ChatHandle } from "@/components/chat-panel"
import { EmptyCanvas } from "@/components/canvas/empty-state"
import { CanvasToolbar } from "@/components/canvas/toolbar"
import { ChatContextHints } from "@/components/chat/context-hints"
import { FixErrorsButton } from "@/components/chat/fix-errors-button"
import { PlanOverlay } from "@/components/chat/plan-overlay"
import { ContextPills } from "@/components/context-pills"
import { LeftQuickActions } from "@/components/canvas-header"
import { HelpCenterDialog } from "@/components/dialogs/help-center-dialog"
import { Onboarding } from "@/components/onboarding"
import { ResizableDivider } from "@/components/resizable-divider"
import { Sidebar } from "@/components/sidebar/sidebar"
import { saveSession, useSession } from "@/lib/session-store"
import { isPlanModeAtom, isSidebarOpenAtom } from "@/lib/ui-atoms"
import { themeToSystemPrompt, useTheme } from "@/lib/theme-store"

type Phase =
  | { kind: "idle" }
  | { kind: "provisioning"; msg: string }
  | { kind: "ready"; sandboxId: string; threadId: string }
  | { kind: "error"; msg: string }

const PANEL_KEY = "canvas-template:chat-panel-w"
const PANEL_DEFAULT = 380
const PROJECT_NAME = "Untitled file"

export default function Home() {
  const [session, setSession] = useSession()
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })
  const [allShapes, setAllShapes] = useState<ShapeBrief[]>([])
  const [selectedShapes, setSelectedShapes] = useState<ShapeBrief[]>([])
  const [messageCount, setMessageCount] = useState(0)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLive, setPreviewLive] = useState(false)
  const [sidebarOpen] = useAtom(isSidebarOpenAtom)
  const [panelW, setPanelW] = useState<number>(() => {
    if (typeof window === "undefined") return PANEL_DEFAULT
    const stored = Number(localStorage.getItem(PANEL_KEY))
    return Number.isFinite(stored) && stored > 0 ? stored : PANEL_DEFAULT
  })
  const [isPlanMode] = useAtom(isPlanModeAtom)
  const [theme] = useTheme()
  const initRef = useRef(false)
  const chatHandle = useRef<ChatHandle | null>(null)

  // Canvas imperative handle + selection refs
  const canvasHandle = useRef<CanvasHandle | null>(null)
  const selectedShapesRef = useRef<ShapeBrief[]>([])
  const handleSelectionChange = useCallback((briefs: ShapeBrief[]) => {
    selectedShapesRef.current = briefs
    setSelectedShapes(briefs)
  }, [])
  const handleShapesChange = useCallback((briefs: ShapeBrief[]) => {
    setAllShapes(briefs)
  }, [])
  const getShapes = useCallback(() => selectedShapesRef.current, [])
  const getTheme = useCallback(() => themeToSystemPrompt(theme), [theme])

  // ---- Provisioning --------------------------------------------------------
  const provision = useCallback(async () => {
    setPhase({
      kind: "provisioning",
      msg: "Creating sandbox & installing dependencies (≈90s)…",
    })
    const sbRes = await fetch("/api/agent/sandbox", { method: "POST" })
    if (!sbRes.ok) {
      const err = await sbRes.json().catch(() => ({}))
      throw new Error(err.error ?? `Sandbox create failed (${sbRes.status})`)
    }
    const sbData = (await sbRes.json()) as { sandboxId: string }

    setPhase({ kind: "provisioning", msg: "Creating thread…" })
    const tRes = await fetch("/api/agent/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sandboxId: sbData.sandboxId, name: "Canvas session" }),
    })
    if (!tRes.ok) throw new Error("Thread create failed")
    const thread = (await tRes.json()) as { id: string }

    const next = {
      sandboxId: sbData.sandboxId,
      threadId: thread.id,
      e2bSandboxId: null,
    }
    setSession(next)
    saveSession(next)
  }, [setSession])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    ;(async () => {
      try {
        if (!session) await provision()
      } catch (err) {
        setPhase({
          kind: "error",
          msg: err instanceof Error ? err.message : "Unknown error",
        })
      }
    })()
  }, [session, provision])

  useEffect(() => {
    if (session && phase.kind !== "ready") {
      setPhase({
        kind: "ready",
        sandboxId: session.sandboxId,
        threadId: session.threadId,
      })
    }
  }, [session, phase.kind])

  // ---- Dev-server preview polling -----------------------------------------
  const pokePreview = useCallback(
    async (routePath?: string) => {
      if (!session) return
      try {
        const r = await fetch(
          `/api/preview?sandboxId=${encodeURIComponent(session.sandboxId)}&port=3000`,
        )
        if (!r.ok) return
        const data = (await r.json()) as { url: string; live: boolean }
        setPreviewUrl(data.url ?? null)
        setPreviewLive(!!data.live)
        if (data.live) {
          const rp = routePath ?? "/"
          const full = rp === "/" ? data.url : `${data.url}${rp}`
          const label = rp === "/" ? "app/page.tsx" : `app${rp}/page.tsx`
          canvasHandle.current?.upsertVariantPreview(full, label, rp)
        }
      } catch {}
    },
    [session],
  )

  useEffect(() => {
    if (phase.kind !== "ready") return
    pokePreview()
    const i = setInterval(() => pokePreview(), 8000)
    return () => clearInterval(i)
  }, [phase.kind, pokePreview])

  // ---- Actions -------------------------------------------------------------
  const handleReset = useCallback(() => {
    saveSession(null)
    setSession(null)
    initRef.current = false
    setPhase({ kind: "idle" })
    window.location.reload()
  }, [setSession])

  const handleOpenFile = useCallback(
    (filePath: string) => {
      const routeMatch = filePath.match(/^app\/(.*?)\/?page\.tsx?$/)
      const routePath = routeMatch
        ? `/${routeMatch[1]}`.replace(/\/$/, "") || "/"
        : "/"
      pokePreview(routePath)
    },
    [pokePreview],
  )

  const handleFocusShape = useCallback((id: string) => {
    canvasHandle.current?.focusShape(id)
  }, [])
  const handleDeleteShape = useCallback((id: string) => {
    canvasHandle.current?.deleteShape(id)
  }, [])

  const handleNewVariant = useCallback(() => {
    const idea = window.prompt(
      "Describe the new prototype:",
      "A cleaner, minimalist version with more whitespace",
    )
    if (!idea) return
    const existing = allShapes
      .map((s) => s.text ?? "")
      .filter((s) => /variant-(\d+)/.test(s))
      .map((s) => Number(/variant-(\d+)/.exec(s)?.[1] ?? 0))
    const next = existing.length > 0 ? Math.max(...existing) + 1 : 2
    const route = `/variant-${next}`
    chatHandle.current?.sendPrompt(
      `Create a new page at app/variant-${next}/page.tsx with this direction: ${idea}. Use Tailwind. The root app/page.tsx should stay unchanged. Then make sure the dev server is running (call start_dev_server if not).`,
    )
    canvasHandle.current?.upsertVariantPreview(
      previewUrl ? `${previewUrl}${route}` : "",
      `app${route}/page.tsx`,
      route,
    )
  }, [allShapes, previewUrl])

  const handleRegenerate = useCallback(() => {
    chatHandle.current?.sendPrompt(
      "Regenerate app/page.tsx with a different, modern design — keep the same intent but try a new visual direction. Then call start_dev_server.",
    )
  }, [])

  const handleClearCanvas = useCallback(() => {
    allShapes.forEach((s) => canvasHandle.current?.deleteShape(s.id))
  }, [allShapes])

  const handleApplyTheme = useCallback((desc: string) => {
    chatHandle.current?.sendPrompt(desc)
  }, [])

  const handleFixErrors = useCallback(() => {
    chatHandle.current?.sendPrompt(
      "The dev server is returning a 500. Read /tmp/next-dev.log (tail -100), then fix the compilation error in the source files. Then call start_dev_server to restart.",
    )
  }, [])

  const handleResizePanel = useCallback((w: number) => {
    setPanelW(w)
    try {
      localStorage.setItem(PANEL_KEY, String(w))
    } catch {}
  }, [])

  const handleDevServerLive = useCallback(() => {
    pokePreview()
  }, [pokePreview])

  // ---- Variant toolbar handlers -------------------------------------------
  const selectedVariant = useMemo(
    () => selectedShapes.find((s) => s.type === "variant") ?? null,
    [selectedShapes],
  )
  const selectedVariantUrl = useMemo(() => {
    if (!selectedVariant || !previewUrl) return null
    const rp = selectedVariant.routePath ?? "/"
    return rp === "/" ? previewUrl : `${previewUrl}${rp}`
  }, [selectedVariant, previewUrl])

  const handleFullScreen = useCallback(() => {
    if (selectedVariantUrl) window.open(selectedVariantUrl, "_blank")
  }, [selectedVariantUrl])
  const handleCopyUrl = useCallback(async () => {
    if (!selectedVariantUrl) return
    try {
      await navigator.clipboard.writeText(selectedVariantUrl)
    } catch {}
  }, [selectedVariantUrl])
  const handleShareAction = useCallback(() => {
    // Reuse full-screen behaviour as "share" — opens preview publicly.
    handleFullScreen()
  }, [handleFullScreen])
  const handleHistory = useCallback(() => {
    window.alert(
      "Version history is a 21st-only feature in this template. It would show git branches committed per message.",
    )
  }, [])
  const handleToggleInteractive = useCallback(() => {
    // Template note: we don't have an "interactive" prop on VariantShape — all
    // iframes are pointer-events:none by default. Could be extended later.
  }, [])

  // ---- Render --------------------------------------------------------------
  if (phase.kind === "error") {
    return (
      <main className="flex h-screen items-center justify-center">
        <div className="max-w-md space-y-3 text-center">
          <p className="text-sm text-destructive">{phase.msg}</p>
          <button
            onClick={handleReset}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Reset & retry
          </button>
        </div>
      </main>
    )
  }

  if (phase.kind !== "ready") {
    return (
      <main className="flex h-screen items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-border border-t-foreground" />
          <p className="text-sm text-muted-foreground">
            {phase.kind === "provisioning" ? phase.msg : "Initializing…"}
          </p>
        </div>
      </main>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Onboarding />
      <HelpCenterDialog />

      {/* Left sidebar (240px when open, nothing when closed — LeftQuickActions sits above canvas) */}
      <Sidebar
        sandboxId={phase.sandboxId}
        projectName={PROJECT_NAME}
        shapes={allShapes}
        onFocusShape={handleFocusShape}
        onDeleteShape={handleDeleteShape}
        onOpenFile={handleOpenFile}
        onApplyTheme={handleApplyTheme}
        onNewVariant={handleNewVariant}
        onReset={handleReset}
      />

      {/* Canvas area — full height, no top bar */}
      <div className="relative min-w-0 flex-1">
        <Canvas
          handleRef={canvasHandle}
          onSelectionChange={handleSelectionChange}
          onShapesChange={handleShapesChange}
        />

        {/* Floating LeftQuickActions — only when sidebar closed */}
        {!sidebarOpen && (
          <div className="pointer-events-auto absolute left-3 top-3 z-20">
            <LeftQuickActions projectName={PROJECT_NAME} />
          </div>
        )}

        {/* Floating canvas toolbar — top-center */}
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2">
          <div className="pointer-events-auto">
            <CanvasToolbar
              selectedVariant={selectedVariant}
              selectedInteractive={false}
              onToggleInteractive={handleToggleInteractive}
              onNewVariant={handleNewVariant}
              onRegenerate={handleRegenerate}
              onFullScreen={handleFullScreen}
              onHistory={handleHistory}
              onShare={handleShareAction}
              onDeleteShape={() =>
                selectedVariant && handleDeleteShape(selectedVariant.id)
              }
              onCopyUrl={handleCopyUrl}
              onOpenInNewTab={handleFullScreen}
              onResetCanvas={handleClearCanvas}
            />
          </div>
        </div>

        {/* Plan overlay + Fix-errors — bottom */}
        <PlanOverlay messages={messages} visible={isPlanMode} />
        <FixErrorsButton
          sandboxId={phase.sandboxId}
          onFix={handleFixErrors}
        />

        {/* Empty canvas hint — only when nothing has happened yet */}
        {messageCount === 0 && allShapes.length === 0 && (
          <EmptyCanvas
            onPick={(prompt) => chatHandle.current?.sendPrompt(prompt)}
          />
        )}
      </div>

      {/* Resize handle between canvas and chat */}
      <ResizableDivider value={panelW} onChange={handleResizePanel} />

      {/* Right chat panel */}
      <div
        className="flex shrink-0 flex-col overflow-hidden bg-background"
        style={{ width: panelW }}
      >
        <ContextPills
          selectedShapes={selectedShapes}
          onFocus={handleFocusShape}
          onDismiss={(id) => canvasHandle.current?.deselectShape(id)}
        />
        <ChatContextHints
          visible={messageCount === 0}
          onPick={(p) => chatHandle.current?.sendPrompt(p)}
        />
        <div className="min-h-0 flex-1">
          <ChatPanel
            sandboxId={phase.sandboxId}
            threadId={phase.threadId}
            getShapes={getShapes}
            getTheme={getTheme}
            onDevServerLive={handleDevServerLive}
            onMessageCountChange={setMessageCount}
            onMessagesChange={setMessages}
            handleRef={chatHandle}
          />
        </div>
      </div>
    </div>
  )
}
