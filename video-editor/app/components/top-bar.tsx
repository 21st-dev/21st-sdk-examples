"use client"

import { MessageSquare, Redo2, Undo2 } from "lucide-react"
import type { ProjectOutput } from "../lib/project"
import { IconButton, PillGroup } from "./ui"

interface TopBarProps {
  output: ProjectOutput
  duration: number
  onUpdateOutput: (patch: Partial<ProjectOutput>) => void
  onToggleChat: () => void
  chatOpen: boolean
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

export function TopBar({
  output,
  duration,
  onUpdateOutput,
  onToggleChat,
  chatOpen,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: TopBarProps) {
  return (
    <header className="flex h-11 shrink-0 min-w-0 items-center gap-3 overflow-x-auto border-b border-neutral-800 bg-neutral-950 px-3 text-neutral-100">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold">Video Editor</span>
        <span className="text-[11px] tabular-nums text-neutral-500">
          {duration > 0 ? `${duration.toFixed(1)}s` : "empty"}
        </span>
      </div>

      <span className="h-4 w-px shrink-0 bg-neutral-800" aria-hidden />

      <PillGroup
        label="Res"
        value={output.resolution}
        options={[
          { value: "480p", label: "480" },
          { value: "720p", label: "720" },
          { value: "1080p", label: "1080" },
        ]}
        onChange={(v) => onUpdateOutput({ resolution: v })}
      />
      <PillGroup
        label="Aspect"
        value={output.aspectRatio}
        options={[
          { value: "16:9", label: "16:9" },
          { value: "9:16", label: "9:16" },
          { value: "1:1", label: "1:1" },
        ]}
        onChange={(v) => onUpdateOutput({ aspectRatio: v })}
      />
      <PillGroup
        label="FPS"
        value={output.fps}
        options={[
          { value: 24, label: "24" },
          { value: 30, label: "30" },
          { value: 60, label: "60" },
        ]}
        onChange={(v) => onUpdateOutput({ fps: v })}
      />

      <span className="flex-1" />

      <div className="flex shrink-0 items-center gap-0.5">
        <IconButton
          icon={<Undo2 size={14} />}
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo"
          shortcut="Cmd+Z"
          aria-label="Undo"
        />
        <IconButton
          icon={<Redo2 size={14} />}
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo"
          shortcut="Cmd+Shift+Z"
          aria-label="Redo"
        />
      </div>

      <span className="h-4 w-px shrink-0 bg-neutral-800" aria-hidden />

      <button
        type="button"
        onClick={onToggleChat}
        title={chatOpen ? "Hide chat" : "Show chat"}
        aria-keyshortcuts="Cmd+K"
        aria-pressed={chatOpen}
        className={[
          "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors duration-100",
          "outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950",
          chatOpen
            ? "bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
            : "text-neutral-400 hover:bg-white/5 hover:text-white",
        ].join(" ")}
      >
        <MessageSquare size={13} />
        <span>Chat</span>
      </button>
    </header>
  )
}
