"use client"

import { RotateCcw, Wand2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_THEME,
  FONT_OPTIONS,
  RADIUS_OPTIONS,
  type ThemeConfig,
  useTheme,
} from "@/lib/theme-store"
import { cn } from "@/lib/cn"
import { ColorPicker } from "./theme-editor/color-picker"
import { ThemePreview } from "./theme-editor/theme-preview"

export function DesignTab({
  onApply,
}: {
  /** Ask the agent to regenerate the app with the current theme. */
  onApply: (themeDescription: string) => void
}) {
  const [theme, setTheme] = useTheme()

  const patch = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) =>
    setTheme((t) => ({ ...t, [key]: value }))

  const apply = () => {
    const description = [
      `Primary color ${theme.primary}`,
      `${theme.radius} border radius`,
      `${FONT_OPTIONS.find((f) => f.id === theme.font)?.label ?? theme.font} font`,
      `${theme.density} spacing density`,
      theme.darkMode ? "dark mode" : "light mode",
    ].join(", ")
    onApply(
      `Restyle the current app to use this design system: ${description}. Update app/globals.css (CSS variables) and app/page.tsx classes accordingly. Then restart the dev server if needed.`,
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border/60 px-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Design
        </span>
        <Button
          variant="ghost"
          size="iconSm"
          className="h-5 w-5"
          onClick={() => setTheme(DEFAULT_THEME)}
          aria-label="Reset theme"
          title="Reset to defaults"
        >
          <RotateCcw className="!size-3" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 p-3">
          {/* Live preview */}
          <ThemePreview theme={theme} />

          {/* Primary color */}
          <section className="space-y-1.5">
            <div className="text-[11px] font-medium text-foreground">
              Primary color
            </div>
            <ColorPicker
              value={theme.primary}
              onChange={(v) => patch("primary", v)}
            />
          </section>

          <Separator />

          {/* Radius */}
          <section className="space-y-1.5">
            <div className="text-[11px] font-medium text-foreground">
              Corner radius
            </div>
            <div className="grid grid-cols-5 gap-1">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => patch("radius", r.id)}
                  className={cn(
                    "flex h-8 items-center justify-center border border-border/60 text-[10px] text-muted-foreground transition-colors hover:bg-accent",
                    theme.radius === r.id &&
                      "border-primary/60 bg-primary/10 text-foreground",
                  )}
                  style={{ borderRadius: r.px }}
                  aria-label={r.label}
                  title={r.label}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </section>

          <Separator />

          {/* Font */}
          <section className="space-y-1.5">
            <div className="text-[11px] font-medium text-foreground">Font</div>
            <div className="space-y-1">
              {FONT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => patch("font", f.id)}
                  className={cn(
                    "flex h-8 w-full items-center justify-between rounded-md border border-border/60 px-2.5 text-[12px] transition-colors hover:bg-accent",
                    theme.font === f.id &&
                      "border-primary/60 bg-primary/10 text-foreground",
                  )}
                  style={{ fontFamily: f.family }}
                >
                  <span>{f.label}</span>
                  <span className="text-[10px] text-muted-foreground">Aa</span>
                </button>
              ))}
            </div>
          </section>

          <Separator />

          {/* Density */}
          <section className="space-y-1.5">
            <div className="text-[11px] font-medium text-foreground">
              Spacing density
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(["compact", "regular", "relaxed"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => patch("density", d)}
                  className={cn(
                    "h-7 rounded-md border border-border/60 text-[11px] capitalize transition-colors hover:bg-accent",
                    theme.density === d &&
                      "border-primary/60 bg-primary/10 text-foreground",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </section>

          <Separator />

          {/* Dark mode */}
          <section className="flex items-center justify-between">
            <div className="text-[11px] font-medium text-foreground">
              Dark mode
            </div>
            <Switch
              checked={theme.darkMode}
              onCheckedChange={(v) => patch("darkMode", v)}
            />
          </section>
        </div>
      </div>

      <div className="border-t border-border/60 p-2">
        <Button size="sm" className="h-7 w-full gap-1.5" onClick={apply}>
          <Wand2 />
          Apply to app
        </Button>
      </div>
    </div>
  )
}
