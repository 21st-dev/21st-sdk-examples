"use client"

// Global overrides shown in the toolbar popover. Same controls as ray.so:
// padding, line numbers, background on/off. Each override can be "default"
// so the theme's own opinion wins.

import { useRef, useState } from "react"
import { DEFAULT_CODE_SETTINGS, type CodeSettings } from "./code-frame"
import { useDismissible } from "@/app/_hooks/use-dismissible"

interface Props {
  value: CodeSettings
  onChange: (next: CodeSettings) => void
}

export function CodeSettingsControl({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  useDismissible(open, () => setOpen(false), rootRef)

  const isDefault =
    value.padding === "default" &&
    value.lineNumbers === "default" &&
    value.showBackground === true &&
    value.showFileIcon === true

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`h-7 flex items-center gap-1.5 rounded-md border px-2 text-[11px] transition-colors ${
          isDefault
            ? "border-neutral-200 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        }`}
        title="Customize code frames"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>Customize</span>
        {!isDefault && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-9 z-30 w-[280px] rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950 p-3 space-y-3"
        >
          <SegmentRow
            label="Padding"
            value={value.padding}
            onChange={(padding) => onChange({ ...value, padding })}
            options={[
              { id: "default", label: "auto" },
              { id: "sm", label: "16" },
              { id: "md", label: "24" },
              { id: "lg", label: "40" },
              { id: "xl", label: "56" },
            ]}
          />

          <SegmentRow
            label="Line numbers"
            value={value.lineNumbers}
            onChange={(lineNumbers) => onChange({ ...value, lineNumbers })}
            options={[
              { id: "default", label: "auto" },
              { id: "on", label: "on" },
              { id: "off", label: "off" },
            ]}
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">Background</span>
            <ToggleSwitch
              checked={value.showBackground}
              onChange={(showBackground) => onChange({ ...value, showBackground })}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-500">File icon</span>
            <ToggleSwitch
              checked={value.showFileIcon}
              onChange={(showFileIcon) => onChange({ ...value, showFileIcon })}
            />
          </div>

          <button
            type="button"
            onClick={() => onChange(DEFAULT_CODE_SETTINGS)}
            disabled={isDefault}
            className="w-full h-7 rounded border border-neutral-200 text-[11px] text-neutral-600 hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  )
}

function SegmentRow<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="flex items-center gap-0.5 rounded border border-neutral-200 p-0.5 dark:border-neutral-800">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex-1 rounded px-2 py-1 text-[11px] transition-colors ${
              value === o.id
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  )
}
