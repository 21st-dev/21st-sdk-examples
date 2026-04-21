"use client"

import { X } from "lucide-react"
import type { Asset, Clip, Project } from "../lib/project"
import { getAsset, getClip } from "../lib/project"
import { Button, IconButton, Input } from "./ui"

interface InspectorDrawerProps {
  project: Project
  selectedClipId: string | null
  onUpdateClip: (
    clipId: string,
    patch: {
      trimIn?: number
      length?: number
      start?: number
      volume?: number
      textOverlay?: Clip["textOverlay"] | null
    },
  ) => void
  onRemoveClip: (clipId: string) => void
  onClose: () => void
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.1,
  min = 0,
  max,
  suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-neutral-400">
      <span className="w-14 shrink-0">{label}</span>
      <Input
        inputSize="xs"
        type="number"
        value={Number.isFinite(value) ? Number(value.toFixed(3)) : 0}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value)
          if (!Number.isFinite(v)) return
          onChange(max !== undefined ? Math.min(max, Math.max(min, v)) : Math.max(min, v))
        }}
        className="w-20"
      />
      {suffix && <span className="text-neutral-500">{suffix}</span>}
    </label>
  )
}

function ClipPane({
  clip,
  asset,
  onUpdateClip,
  onRemoveClip,
  onClose,
}: {
  clip: Clip
  asset: Asset | undefined
  onUpdateClip: InspectorDrawerProps["onUpdateClip"]
  onRemoveClip: InspectorDrawerProps["onRemoveClip"]
  onClose: InspectorDrawerProps["onClose"]
}) {
  const isAudio = asset?.kind === "audio"
  const sourceDuration = asset?.duration ?? null
  const maxTrim = sourceDuration ? Math.max(0, sourceDuration - 0.1) : undefined
  const maxLength = sourceDuration ? sourceDuration - clip.trimIn : undefined

  return (
    <aside className="flex shrink-0 items-stretch border-t border-neutral-800 bg-neutral-950 text-neutral-100">
      <div className="flex w-[260px] shrink-0 flex-col gap-2 border-r border-neutral-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            Inspector
          </span>
          <span className="flex-1" />
          <IconButton
            size="xs"
            icon={<X size={12} />}
            onClick={onClose}
            title="Deselect"
            shortcut="Escape"
            aria-label="Deselect"
          />
        </div>
        <div className="truncate text-sm font-medium" title={asset?.label}>
          {asset?.label ?? clip.assetId}
        </div>
        <div className="text-[10px] text-neutral-500">
          {asset?.kind} · track {clip.trackId}
          {sourceDuration !== null && ` · src ${sourceDuration.toFixed(1)}s`}
        </div>
        <Button
          variant="danger"
          size="sm"
          block
          onClick={() => onRemoveClip(clip.id)}
          shortcut="Backspace"
          className="mt-auto"
        >
          Delete clip
        </Button>
      </div>

      <div className="flex flex-1 items-start gap-6 overflow-x-auto px-4 py-3">
        <section className="flex min-w-[200px] flex-col gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
            Position
          </span>
          <NumberField
            label="Start"
            value={clip.start}
            onChange={(v) => onUpdateClip(clip.id, { start: v })}
            suffix="s"
          />
          <NumberField
            label="Length"
            value={clip.length}
            onChange={(v) => onUpdateClip(clip.id, { length: v })}
            max={maxLength}
            suffix="s"
          />
          <NumberField
            label="Trim in"
            value={clip.trimIn}
            onChange={(v) => onUpdateClip(clip.id, { trimIn: v })}
            max={maxTrim}
            suffix="s"
          />
        </section>

        {isAudio && (
          <section className="flex min-w-[200px] flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
              Audio
            </span>
            <NumberField
              label="Volume"
              value={clip.volume ?? 1}
              onChange={(v) => onUpdateClip(clip.id, { volume: v })}
              step={0.05}
              min={0}
              max={1}
            />
          </section>
        )}

        {!isAudio && (
          <section className="flex min-w-[240px] flex-col gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
              Text overlay
            </span>
            <Input
              inputSize="sm"
              type="text"
              placeholder="(none)"
              value={clip.textOverlay?.text ?? ""}
              aria-label="Overlay text"
              onChange={(e) =>
                onUpdateClip(clip.id, {
                  textOverlay:
                    e.target.value.trim() === ""
                      ? null
                      : {
                          text: e.target.value,
                          position: clip.textOverlay?.position ?? "bottom",
                          color: clip.textOverlay?.color,
                          fontSize: clip.textOverlay?.fontSize,
                        },
                })
              }
            />
            {clip.textOverlay && (
              <div role="radiogroup" aria-label="Overlay position" className="flex gap-1">
                {(["top", "center", "bottom"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={clip.textOverlay?.position === p}
                    onClick={() =>
                      onUpdateClip(clip.id, {
                        textOverlay: { ...clip.textOverlay!, position: p },
                      })
                    }
                    className={[
                      "flex-1 rounded border px-1.5 py-0.5 text-[10px] capitalize transition-colors duration-100",
                      "outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-neutral-950",
                      clip.textOverlay?.position === p
                        ? "border-white/70 bg-white/10 text-white"
                        : "border-neutral-700 text-neutral-400 hover:text-neutral-200",
                    ].join(" ")}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </aside>
  )
}

export function InspectorDrawer(props: InspectorDrawerProps) {
  if (!props.selectedClipId) return null
  const clip = getClip(props.project, props.selectedClipId)
  if (!clip) return null
  return (
    <ClipPane
      clip={clip}
      asset={getAsset(props.project, clip.assetId)}
      onUpdateClip={props.onUpdateClip}
      onRemoveClip={props.onRemoveClip}
      onClose={props.onClose}
    />
  )
}
