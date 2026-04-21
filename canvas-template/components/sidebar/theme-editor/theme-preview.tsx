"use client"

import type { ThemeConfig } from "@/lib/theme-store"

const RADIUS_PX: Record<ThemeConfig["radius"], string> = {
  none: "0",
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
}

/** A miniature live preview of the current theme. */
export function ThemePreview({ theme }: { theme: ThemeConfig }) {
  const radius = RADIUS_PX[theme.radius]
  const density =
    theme.density === "compact" ? 4 : theme.density === "relaxed" ? 12 : 8

  return (
    <div
      className="rounded-lg border border-border/60 bg-muted/40 p-3"
      style={{
        fontFamily:
          theme.font === "geist"
            ? "'Geist Sans', ui-sans-serif, system-ui"
            : theme.font === "mono"
              ? "ui-monospace, SFMono-Regular, monospace"
              : theme.font === "serif"
                ? "ui-serif, Georgia, serif"
                : theme.font === "system"
                  ? "-apple-system, BlinkMacSystemFont, sans-serif"
                  : "ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        className="flex flex-col gap-2 rounded-md bg-background p-3"
        style={{
          gap: `${density}px`,
          borderRadius: radius,
          color: theme.darkMode ? "#fafafa" : "#0a0a0a",
          background: theme.darkMode ? "#0a0a0a" : "#ffffff",
          border: "1px solid rgba(127,127,127,0.15)",
        }}
      >
        <div className="text-[9px] uppercase tracking-wider opacity-60">
          Preview
        </div>
        <div className="text-[13px] font-semibold">Upgrade your plan</div>
        <div className="text-[11px] opacity-70">
          Unlock unlimited projects and priority support.
        </div>
        <div className="flex gap-1.5 pt-1">
          <button
            type="button"
            className="px-2.5 py-1 text-[10px] font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: theme.primary, borderRadius: radius }}
          >
            Upgrade
          </button>
          <button
            type="button"
            className="px-2.5 py-1 text-[10px] transition-colors"
            style={{
              borderRadius: radius,
              border: "1px solid rgba(127,127,127,0.25)",
              color: theme.darkMode ? "#fafafa" : "#0a0a0a",
              background: "transparent",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
