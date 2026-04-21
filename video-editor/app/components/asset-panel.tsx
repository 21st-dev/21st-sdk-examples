"use client"

import { Music2 } from "lucide-react"
import { useEffect, useState } from "react"
import { setDragPayload } from "../lib/dnd"
import type { Asset, AssetKind } from "../lib/project"
import { Button, Input, Select } from "./ui"

interface AssetPanelProps {
  assets: Asset[]
  onAdd: (asset: Omit<Asset, "id"> & { id?: string }) => void
  onRemove: (id: string) => void
  onLoadSample: () => void
  /** Click-append fallback for users who don't discover drag. */
  onQuickAdd: (assetId: string) => void
}

const KIND_CLASSES: Record<AssetKind, string> = {
  video: "bg-blue-500/20 text-blue-300",
  image: "bg-amber-500/20 text-amber-300",
  audio: "bg-emerald-500/20 text-emerald-300",
}

function guessKind(url: string): AssetKind {
  const lower = url.toLowerCase().split("?")[0]
  if (/\.(mp3|wav|m4a|aac|ogg)$/.test(lower)) return "audio"
  if (/\.(jpg|jpeg|png|gif|webp|bmp)$/.test(lower)) return "image"
  return "video"
}

function deriveLabel(url: string): string {
  try {
    const parsed = new URL(url)
    const name = parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.hostname
    return decodeURIComponent(name).replace(/\.[a-z0-9]{2,5}$/i, "")
  } catch {
    return url
  }
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "…"
  if (seconds === 0) return "img"
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m === 0) return `${s}s`
  return `${m}:${s.toString().padStart(2, "0")}`
}

function AssetThumb({ asset }: { asset: Asset }) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => setLoaded(false), [asset.url])

  if (asset.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={asset.url}
        alt={asset.label}
        className="h-full w-full object-cover"
        draggable={false}
      />
    )
  }
  if (asset.kind === "video") {
    return (
      <video
        src={asset.url}
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
        className={`h-full w-full object-cover transition-opacity ${
          loaded ? "opacity-100" : "opacity-60"
        }`}
      />
    )
  }
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-emerald-950/70 text-emerald-300">
      <Music2 size={20} />
      <span className="text-[9px] uppercase tracking-wide">audio</span>
    </div>
  )
}

export function AssetPanel({
  assets,
  onAdd,
  onRemove,
  onLoadSample,
  onQuickAdd,
}: AssetPanelProps) {
  const [url, setUrl] = useState("")
  const [kind, setKind] = useState<AssetKind>("video")
  const [error, setError] = useState<string | null>(null)

  function handleAdd() {
    const trimmed = url.trim()
    if (!trimmed) return
    try {
      new URL(trimmed)
    } catch {
      setError("Invalid URL")
      return
    }
    onAdd({ url: trimmed, kind, label: deriveLabel(trimmed), duration: null })
    setUrl("")
    setError(null)
  }

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 text-neutral-100">
      <div className="flex shrink-0 items-baseline justify-between px-3 pt-3 pb-2">
        <div>
          <h2 className="text-sm font-semibold">Assets</h2>
          <p className="text-[10px] text-neutral-500">
            Drag onto the timeline · {assets.length}
          </p>
        </div>
        <button
          type="button"
          onClick={onLoadSample}
          className="rounded px-1 py-0.5 text-[11px] text-neutral-400 underline underline-offset-2 outline-none hover:text-neutral-100 focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          Load sample
        </button>
      </div>

      <div className="shrink-0 space-y-1.5 px-3 pb-3">
        <div className="flex gap-1.5">
          <Select
            size="sm"
            value={kind}
            onChange={(e) => setKind(e.target.value as AssetKind)}
            aria-label="Asset kind"
            className="w-[76px]"
          >
            <option value="video">Video</option>
            <option value="image">Image</option>
            <option value="audio">Audio</option>
          </Select>
          <Input
            inputSize="sm"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              const next = e.target.value.trim()
              if (next) setKind(guessKind(next))
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                handleAdd()
              }
            }}
            placeholder="https://…"
            aria-label="Asset URL"
            className="flex-1 min-w-0"
          />
        </div>
        <Button variant="primary" block disabled={!url.trim()} onClick={handleAdd}>
          Add
        </Button>
        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>

      <div className="flex-1 overflow-y-auto border-t border-neutral-800 px-2 py-2">
        {assets.length === 0 ? (
          <p className="px-2 text-[11px] text-neutral-500">
            No assets yet. Paste a URL above or click{" "}
            <span className="underline">Load sample</span>.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {assets.map((asset) => (
              <li
                key={asset.id}
                className="group relative overflow-hidden rounded-md border border-neutral-800 bg-neutral-900 transition-colors hover:border-neutral-600 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/40"
                draggable
                onDragStart={(e) =>
                  setDragPayload(e.dataTransfer, {
                    kind: "asset",
                    assetId: asset.id,
                    label: asset.label,
                    assetKind: asset.kind,
                  })
                }
                onDoubleClick={() => onQuickAdd(asset.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    onQuickAdd(asset.id)
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Add ${asset.label} to timeline (drag, double-click, or press Enter)`}
                title="Drag onto timeline · double-click or Enter to append"
              >
                <div className="aspect-video w-full overflow-hidden bg-black">
                  <AssetThumb asset={asset} />
                </div>
                <div className="flex items-center gap-1 px-1.5 py-1">
                  <span
                    className={`rounded px-1 py-px text-[9px] font-medium uppercase tracking-wide ${KIND_CLASSES[asset.kind]}`}
                  >
                    {asset.kind}
                  </span>
                  <span className="flex-1 truncate text-[11px]" title={asset.label}>
                    {asset.label}
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-neutral-500">
                    {formatDuration(asset.duration)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRemove(asset.id)
                  }}
                  className="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white opacity-0 transition-opacity outline-none hover:bg-red-500/80 focus-visible:ring-2 focus-visible:ring-blue-500/60 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Remove ${asset.label}`}
                  title="Remove asset"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
