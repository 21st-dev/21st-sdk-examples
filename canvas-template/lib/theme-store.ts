"use client"

import { atom, useAtom } from "jotai"

/**
 * Theme configuration that the Design tab lets users tweak. These values
 * are passed to the agent as part of the systemPrompt.append — the agent
 * then applies them to the Tailwind CSS it writes.
 */
export type ThemeConfig = {
  primary: string
  radius: "none" | "sm" | "md" | "lg" | "xl"
  font: "inter" | "geist" | "mono" | "serif" | "system"
  density: "compact" | "regular" | "relaxed"
  darkMode: boolean
}

export const DEFAULT_THEME: ThemeConfig = {
  primary: "#0034FF",
  radius: "md",
  font: "inter",
  density: "regular",
  darkMode: true,
}

export const PRIMARY_PRESETS = [
  "#0034FF", // 21st blue
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#F97316", // orange
  "#10B981", // emerald
  "#0EA5E9", // sky
  "#EF4444", // red
] as const

export const FONT_OPTIONS: Array<{ id: ThemeConfig["font"]; label: string; family: string }> = [
  { id: "inter", label: "Inter", family: "ui-sans-serif, system-ui, sans-serif" },
  { id: "geist", label: "Geist", family: "'Geist Sans', ui-sans-serif, system-ui" },
  { id: "mono", label: "Mono", family: "ui-monospace, SFMono-Regular, monospace" },
  { id: "serif", label: "Serif", family: "ui-serif, Georgia, serif" },
  { id: "system", label: "System", family: "-apple-system, BlinkMacSystemFont" },
]

export const RADIUS_OPTIONS: Array<{ id: ThemeConfig["radius"]; label: string; px: string }> = [
  { id: "none", label: "None", px: "0" },
  { id: "sm", label: "Small", px: "4px" },
  { id: "md", label: "Medium", px: "8px" },
  { id: "lg", label: "Large", px: "12px" },
  { id: "xl", label: "XL", px: "16px" },
]

export const themeAtom = atom<ThemeConfig>(DEFAULT_THEME)

export function useTheme() {
  return useAtom(themeAtom)
}

export function themeToSystemPrompt(t: ThemeConfig): string {
  return [
    `<theme-config>`,
    `Primary color: ${t.primary}`,
    `Border radius: ${t.radius}`,
    `Font family: ${t.font}`,
    `Density: ${t.density}`,
    `Dark mode: ${t.darkMode ? "enabled" : "disabled"}`,
    `When editing Tailwind CSS, respect these design tokens. Set CSS variables in app/globals.css accordingly.`,
    `</theme-config>`,
  ].join("\n")
}
