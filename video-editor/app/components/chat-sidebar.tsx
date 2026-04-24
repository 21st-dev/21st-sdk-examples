"use client"

import { X } from "lucide-react"
import { ChatPanel } from "./chat-panel"
import type { Asset, Project } from "../lib/project"
import type { Op } from "../lib/project-ops"
import type { RenderState } from "../lib/render"
import type { ColorMode } from "../lib/use-color-mode"
import { resetAgentSession } from "../lib/use-agent-session"

export interface SamplePrompt {
  title: string
  prompt: string
}

interface ChatSidebarProps {
  /** Both ids are `null` until `useAgentSession` finishes booting. While
   * either is null the sidebar shows a "Loading…" placeholder. */
  sandboxId: string | null
  threadId: string | null
  colorMode: ColorMode
  project: Project
  onApplyOps: (ops: Op[]) => void
  onProbeResult: (url: string, info: Partial<Asset>) => void
  onRenderResult: (state: RenderState) => void
  onRenderPending: () => void
  pendingPrompt: string | null
  onPromptConsumed: () => void
  onClose: () => void
  samplePrompts?: SamplePrompt[]
  onSamplePrompt?: (prompt: string) => void
}

/** Right-side chat column: header with sample prompts / Reset / Close, and the
 * `<ChatPanel>` below. Rendered conditionally by the editor shell. */
export function ChatSidebar({
  sandboxId,
  threadId,
  onClose,
  samplePrompts,
  onSamplePrompt,
  ...chatPanelProps
}: ChatSidebarProps) {
  const { project } = chatPanelProps
  const showSamples =
    project.assets.length > 0 &&
    samplePrompts &&
    samplePrompts.length > 0 &&
    onSamplePrompt
  return (
    <aside className="flex h-full w-[380px] shrink-0 min-w-0 flex-col border-l border-neutral-800 bg-neutral-950">
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-800 px-3 py-1.5 text-[11px] text-neutral-400">
        <span className="font-medium text-neutral-200">Agent</span>
        <span className="flex-1" />
        {showSamples && (
          <div className="flex gap-1">
            {samplePrompts.slice(0, 3).map((p) => (
              <button
                key={p.title}
                type="button"
                onClick={() => onSamplePrompt(p.prompt)}
                className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:bg-white/5 hover:text-white"
                title={p.prompt}
              >
                {p.title}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => resetAgentSession()}
          className="rounded px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-200"
          title="Clear sandbox + project"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 py-0.5 text-neutral-500 hover:text-neutral-100"
          title="Close (⌘K)"
          aria-label="Close chat"
        >
          <X size={12} />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        {sandboxId && threadId ? (
          <ChatPanel
            sandboxId={sandboxId}
            threadId={threadId}
            {...chatPanelProps}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-neutral-500">
            Loading…
          </div>
        )}
      </div>
    </aside>
  )
}
