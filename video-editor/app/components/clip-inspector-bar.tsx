"use client"

import { Trash2, X } from "lucide-react"
import type { Clip, Project, UUID } from "../lib/project"
import { getAsset, getClip } from "../lib/project"
import { IconButton, Input } from "./ui"

interface ClipInspectorFieldsProps {
  project: Project
  selectedClipId: UUID | null
  onUpdateClip: (
    clipId: UUID,
    patch: {
      trimIn?: number
      length?: number
      start?: number
      volume?: number
      textOverlay?: Clip["textOverlay"] | null
    },
  ) => void
  onRemoveClip: (clipId: UUID) => void
  onClose: () => void
}

/**
 * Inline inspector row — designed to live *inside* the timeline header.
 * Renders nothing when no clip is selected, so the parent bar collapses to
 * its own width instead of reserving space for an empty inspector.
 */
export function ClipInspectorFields({
  project,
  selectedClipId,
  onUpdateClip,
  onRemoveClip,
  onClose,
}: ClipInspectorFieldsProps) {
  if (!selectedClipId) return null
  const clip = getClip(project, selectedClipId)
  if (!clip) return null
  const asset = getAsset(project, clip.assetId)
  const isAudio = asset?.kind === "audio"
  const sourceDuration = asset?.duration ?? null
  const maxTrim = sourceDuration ? Math.max(0, sourceDuration - 0.1) : undefined
  const maxLength = sourceDuration ? sourceDuration - clip.trimIn : undefined

  return (
    <>
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-widest text-neutral-500">
        Clip
      </span>
      <span
        className="shrink-0 max-w-[160px] truncate font-medium text-neutral-200"
        title={asset?.label}
      >
        {asset?.label ?? clip.assetId}
      </span>
      <Divider />
      <CompactNumberField
        label="Start"
        value={clip.start}
        onChange={(v) => onUpdateClip(clip.id, { start: v })}
      />
      <CompactNumberField
        label="Length"
        value={clip.length}
        onChange={(v) => onUpdateClip(clip.id, { length: v })}
        max={maxLength}
      />
      <CompactNumberField
        label="Trim"
        value={clip.trimIn}
        onChange={(v) => onUpdateClip(clip.id, { trimIn: v })}
        max={maxTrim}
      />

      {isAudio && (
        <>
          <Divider />
          <CompactNumberField
            label="Vol"
            value={clip.volume ?? 1}
            onChange={(v) => onUpdateClip(clip.id, { volume: v })}
            step={0.05}
            max={1}
          />
        </>
      )}

      {!isAudio && (
        <>
          <Divider />
          <label className="flex shrink-0 items-center gap-1.5">
            <span className="text-neutral-500">Text</span>
            <Input
              inputSize="xs"
              type="text"
              placeholder="(none)"
              value={clip.textOverlay?.text ?? ""}
              aria-label="Overlay text"
              className="w-[120px]"
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
          </label>
          {clip.textOverlay && (
            <div role="radiogroup" aria-label="Overlay position" className="flex shrink-0 gap-0.5">
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
                    "rounded border px-1.5 py-[1px] text-[10px] capitalize transition-colors duration-100",
                    "outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60",
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
        </>
      )}

      <Divider />
      <IconButton
        size="xs"
        variant="danger"
        icon={<Trash2 size={12} />}
        onClick={() => onRemoveClip(clip.id)}
        title="Delete clip"
        shortcut="Backspace"
        aria-label="Delete clip"
      />
      <IconButton
        size="xs"
        icon={<X size={12} />}
        onClick={onClose}
        title="Deselect"
        shortcut="Escape"
        aria-label="Deselect"
      />
    </>
  )
}

function Divider() {
  return <span className="shrink-0 h-4 w-px bg-neutral-800" aria-hidden />
}

function CompactNumberField({
  label,
  value,
  onChange,
  step = 0.1,
  min = 0,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
}) {
  return (
    <label className="flex shrink-0 items-center gap-1.5">
      <span className="text-neutral-500">{label}</span>
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
        className="w-14"
      />
    </label>
  )
}
