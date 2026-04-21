"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ChevronRight,
  File,
  FileCode,
  Folder,
  FolderOpen,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/cn"

type Entry = { name: string; path: string; type: "file" | "dir" }

function iconFor(entry: Entry, open: boolean) {
  if (entry.type === "dir") return open ? FolderOpen : Folder
  if (/\.(tsx|ts|jsx|js|mjs|css)$/.test(entry.name)) return FileCode
  return File
}

function FileTreeNode({
  entry,
  sandboxId,
  depth,
  onFileClick,
}: {
  entry: Entry
  sandboxId: string
  depth: number
  onFileClick: (path: string) => void
}) {
  const [open, setOpen] = useState(depth === 0)
  const [children, setChildren] = useState<Entry[] | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (children || loading) return
    setLoading(true)
    try {
      const r = await fetch(
        `/api/agent/files?sandboxId=${encodeURIComponent(sandboxId)}&path=${encodeURIComponent(entry.path)}`,
      )
      if (r.ok) {
        const d = (await r.json()) as { entries: Entry[] }
        setChildren(d.entries)
      }
    } finally {
      setLoading(false)
    }
  }, [children, loading, sandboxId, entry.path])

  useEffect(() => {
    if (open && entry.type === "dir") load()
  }, [open, entry.type, load])

  const Icon = iconFor(entry, open)

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (entry.type === "dir") setOpen((o) => !o)
          else onFileClick(entry.path)
        }}
        className={cn(
          "group flex h-7 w-full items-center gap-1 rounded-md text-left text-[12px] text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground",
        )}
        style={{ paddingLeft: 6 + depth * 12, paddingRight: 6 }}
      >
        {entry.type === "dir" ? (
          <ChevronRight
            className={cn(
              "size-3 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
        ) : (
          <span className="inline-block w-3" />
        )}
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{entry.name}</span>
      </button>
      {open && entry.type === "dir" && (
        <div>
          {loading && (
            <div
              className="py-1 text-[11px] text-muted-foreground/60"
              style={{ paddingLeft: 22 + depth * 12 }}
            >
              …
            </div>
          )}
          {children?.map((c) => (
            <FileTreeNode
              key={c.path}
              entry={c}
              sandboxId={sandboxId}
              depth={depth + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function PagesTab({
  sandboxId,
  onFileClick,
}: {
  sandboxId: string
  onFileClick: (path: string) => void
}) {
  const [root, setRoot] = useState<Entry[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch(
          `/api/agent/files?sandboxId=${encodeURIComponent(sandboxId)}`,
        )
        if (!r.ok) throw new Error(`${r.status}`)
        const d = (await r.json()) as { entries: Entry[] }
        if (!cancelled) setRoot(d.entries)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sandboxId, tick])

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border/60 px-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Project files
        </span>
        <Button
          variant="ghost"
          size="iconSm"
          className="h-5 w-5"
          onClick={() => setTick((t) => t + 1)}
          aria-label="Refresh"
        >
          <RefreshCw className="!size-3" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        {err ? (
          <div className="px-2 py-2 text-[11px] text-destructive">{err}</div>
        ) : root === null ? (
          <div className="px-2 py-2 text-[11px] text-muted-foreground/60">
            Loading…
          </div>
        ) : root.length === 0 ? (
          <div className="px-2 py-2 text-[11px] text-muted-foreground/60">
            (empty)
          </div>
        ) : (
          root.map((e) => (
            <FileTreeNode
              key={e.path}
              entry={e}
              sandboxId={sandboxId}
              depth={0}
              onFileClick={onFileClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
