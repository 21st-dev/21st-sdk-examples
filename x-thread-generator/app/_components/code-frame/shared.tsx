"use client"

// Shared primitives for all CodeFrame variants.
// We mirror ray.so's approach: shiki highlights to HTML via CSS-variable-based
// theme, then each frame composes its own chrome, pattern, and borders around
// the same <HighlightedCode /> body.

import { forwardRef, useEffect, useState } from "react"
import { FONT_STACKS, type CodeTheme } from "../code-themes"
import { FileExtIcon } from "./file-ext-icon"

// Small tile shown in frame headers. Renders a proper brand-colored SVG for
// common languages (TS/JS/JSON/PY/GO/RS/HTML/CSS/SQL/SH/MD/YAML/Dockerfile)
// and falls back to a colored text-badge for anything else.
export function FileIconTile({
  filename,
  size = 16,
}: {
  filename: string
  size?: number
}) {
  return <FileExtIcon filename={filename} size={size} />
}

export type CodeBlock = { lang: string; code: string; filename?: string }

// Global UI overrides picked in the toolbar settings popover. Each key can
// be "default" to fall back to the theme's own opinion.
export type CodeSettings = {
  padding: "default" | "sm" | "md" | "lg" | "xl"
  lineNumbers: "default" | "on" | "off"
  showBackground: boolean
  showFileIcon: boolean
}

export const DEFAULT_CODE_SETTINGS: CodeSettings = {
  padding: "default",
  lineNumbers: "default",
  showBackground: true,
  showFileIcon: true,
}

export function resolveLineNumbers(
  theme: CodeTheme,
  settings: CodeSettings | undefined,
  fallback = false,
): boolean {
  const v = settings?.lineNumbers ?? "default"
  if (v === "on") return true
  if (v === "off") return false
  return theme.lineNumbers ?? fallback
}

export function resolvePadding(
  theme: CodeTheme,
  settings: CodeSettings | undefined,
  fallback: "sm" | "md" | "lg" | "xl" = "md",
): "sm" | "md" | "lg" | "xl" {
  const v = settings?.padding ?? "default"
  if (v !== "default") return v
  return theme.framePadding ?? fallback
}

// Map a lang slug to a sensible default file extension used in placeholder
// filenames. Kept local to avoid circular imports.
export function langToExt(lang: string): string {
  const map: Record<string, string> = {
    ts: "ts", tsx: "tsx", js: "js", jsx: "jsx",
    py: "py", python: "py",
    go: "go", rust: "rs", rs: "rs",
    sql: "sql", bash: "sh", sh: "sh", zsh: "sh",
    json: "json", yaml: "yml", yml: "yml",
    html: "html", css: "css",
  }
  return map[lang.toLowerCase()] ?? lang.toLowerCase()
}

// Inverse of langToExt, plus a few aliases. Returns null for unknown ext so
// callers can fall back to the agent's original lang.
export function extToLang(ext: string): string | null {
  const map: Record<string, string> = {
    ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", mjs: "js", cjs: "js",
    py: "python", rb: "ruby",
    go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift",
    c: "c", cpp: "cpp", h: "c", hpp: "cpp", cs: "csharp",
    sql: "sql", sh: "bash", bash: "bash", zsh: "bash", fish: "fish",
    json: "json", jsonc: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    html: "html", css: "css", scss: "scss", less: "less",
    md: "markdown", mdx: "mdx",
    xml: "xml", svg: "xml",
    prisma: "prisma", graphql: "graphql", gql: "graphql",
  }
  return map[ext.toLowerCase()] ?? null
}

// Derive shiki lang from a filename (e.g. "relay.ts" → "ts"). Understands the
// Dockerfile special case. Returns `fallback` when we can't recognize it, so
// the agent's explicit lang still wins if the user keeps the extension intact.
export function langFromFilename(filename: string, fallback: string): string {
  if (!filename) return fallback
  const lower = filename.toLowerCase().trim()
  if (lower === "dockerfile" || lower.endsWith(".dockerfile")) return "docker"
  const dot = filename.lastIndexOf(".")
  if (dot < 0) return fallback
  return extToLang(filename.slice(dot + 1)) ?? fallback
}

export function defaultFilename(block: CodeBlock): string {
  if (block.filename && block.filename.trim().length > 0) return block.filename
  return `snippet.${langToExt(block.lang)}`
}

// An input that renders as plain text but stays editable. Width grows with
// value via a CSS trick (grid area + invisible measurer), mirroring ray.so's
// DefaultFrame.module.css filename control.
export const EditableFilename = forwardRef<
  HTMLInputElement,
  {
    value: string
    onChange: (v: string) => void
    placeholder?: string
    color?: string
    fontFamily?: string
    fontSize?: number
    underline?: boolean
  }
>(function EditableFilename(
  { value, onChange, placeholder = "Untitled", color, fontFamily, fontSize, underline = false },
  ref,
) {
  return (
    <span
      className="relative inline-grid items-center whitespace-pre"
      style={{ color, fontFamily, fontSize }}
    >
      <span
        aria-hidden
        className="invisible"
        style={{ gridArea: "1 / 1" }}
      >
        {value.length > 0 ? value : placeholder}
      </span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        tabIndex={0}
        size={1}
        className={`bg-transparent border-none outline-none p-0 m-0 w-full placeholder:opacity-60 ${underline ? "border-b" : ""}`}
        style={{
          gridArea: "1 / 1",
          color: "inherit",
          font: "inherit",
          borderColor: underline ? "currentColor" : undefined,
        }}
      />
    </span>
  )
})

export function themeCssVars(t: CodeTheme): React.CSSProperties {
  return {
    "--cb-bg": t.bg,
    "--cb-fg": t.fg,
    "--cb-muted": t.muted,
    "--cb-keyword": t.keyword,
    "--cb-string": t.string,
    "--cb-number": t.number,
    "--cb-comment": t.comment,
    "--cb-function": t.function,
    "--cb-variable": t.variable,
    "--cb-type": t.type,
    "--cb-punctuation": t.punctuation,
  } as React.CSSProperties
}

const SHIKI_THEME = {
  name: "ray-css-vars",
  type: "dark" as const,
  colors: { "editor.background": "#00000000", "editor.foreground": "#e4e4e7" },
  tokenColors: [
    { scope: ["comment"], settings: { foreground: "var(--cb-comment)" } },
    { scope: ["keyword", "storage", "keyword.control"], settings: { foreground: "var(--cb-keyword)" } },
    { scope: ["string", "string.quoted"], settings: { foreground: "var(--cb-string)" } },
    { scope: ["constant.numeric", "constant.language"], settings: { foreground: "var(--cb-number)" } },
    { scope: ["entity.name.function", "support.function"], settings: { foreground: "var(--cb-function)" } },
    { scope: ["variable"], settings: { foreground: "var(--cb-variable)" } },
    { scope: ["entity.name.type", "support.type", "support.class"], settings: { foreground: "var(--cb-type)" } },
    { scope: ["punctuation"], settings: { foreground: "var(--cb-punctuation)" } },
  ],
}

export function useShikiHtml(code: string, lang: string) {
  const [html, setHtml] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { codeToHtml } = await import("shiki")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const out = await codeToHtml(code, { lang, theme: SHIKI_THEME as any })
        if (!cancelled) setHtml(out)
      } catch {
        if (!cancelled) setHtml(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, lang])
  return html
}

export function HighlightedCode({
  code,
  lang,
  theme,
  withLineNumbers,
}: {
  code: string
  lang: string
  theme: CodeTheme
  withLineNumbers?: boolean
}) {
  const html = useShikiHtml(code, lang)
  const font = FONT_STACKS[theme.font ?? "jetbrains-mono"]
  const lines = code.split("\n")
  return (
    <div
      className="text-[13px] leading-[1.55] flex"
      style={{ fontFamily: font, padding: "12px 16px" }}
    >
      {withLineNumbers && (
        <div
          aria-hidden
          className="shrink-0 pr-3 text-right select-none tabular-nums"
          style={{ color: "var(--cb-muted)", opacity: 0.5, fontFamily: font }}
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}
      {/*
        Soft-wrap like VS Code / GitHub: break on whitespace, keep identifiers
        intact. `overflow-wrap: anywhere` is the escape hatch for long
        unbreakable runs (URLs, base64) so they don't overflow the frame.
      */}
      <div
        className={
          "flex-1 min-w-0 " +
          "[&_pre]:!bg-transparent [&_pre]:!m-0 [&_code]:!bg-transparent " +
          "[&_pre]:!font-[inherit] " +
          "[&_pre]:!whitespace-pre-wrap [&_code]:!whitespace-pre-wrap"
        }
        style={{
          wordBreak: "normal",
          overflowWrap: "anywhere",
        }}
      >
        {html ? (
          <div
            style={{ fontFamily: font }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre
            className="whitespace-pre-wrap"
            style={{
              fontFamily: font,
              color: "var(--cb-fg)",
              wordBreak: "normal",
              overflowWrap: "anywhere",
            }}
          >
            {code}
          </pre>
        )}
      </div>
    </div>
  )
}

// Copy / edit / PNG export overlay. `onEdit`, if provided, highlights/focuses
// whatever element carries data-filename-input inside the same frame.
export function FrameActions({
  frameId,
  code,
  filenameInputRef,
  downloadName,
}: {
  frameId: string
  code: string
  filenameInputRef?: React.RefObject<HTMLInputElement | null>
  downloadName?: string
}) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {}
  }

  async function downloadPng() {
    const frame = document.getElementById(frameId)
    if (!frame) return
    setDownloading(true)
    try {
      const { toPng } = await import("html-to-image")
      const dataUrl = await toPng(frame as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: "transparent",
        cacheBust: true,
      })
      const a = document.createElement("a")
      a.href = dataUrl
      const safe = (downloadName || "snippet").replace(/[^\w.\-]+/g, "_")
      a.download = safe.endsWith(".png") ? safe : `${safe}.png`
      a.click()
    } catch {}
    setDownloading(false)
  }

  function focusFilename() {
    const input = filenameInputRef?.current
    if (!input) return
    input.focus()
    input.select()
  }

  return (
    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
      {filenameInputRef && (
        <button
          type="button"
          onClick={focusFilename}
          className="h-7 px-2 rounded-md bg-black/40 backdrop-blur text-white/80 hover:text-white flex items-center gap-1 text-[11px]"
          title="Rename"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
            <path d="m15 5 4 4" />
          </svg>
          rename
        </button>
      )}
      <button
        type="button"
        onClick={copyCode}
        className="h-7 px-2 rounded-md bg-black/40 backdrop-blur text-white/80 hover:text-white flex items-center gap-1 text-[11px]"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
        {copied ? "copied" : "copy"}
      </button>
      <button
        type="button"
        onClick={downloadPng}
        disabled={downloading}
        className="h-7 px-2 rounded-md bg-black/40 backdrop-blur text-white/80 hover:text-white flex items-center gap-1 text-[11px] disabled:opacity-50"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" x2="12" y1="15" y2="3" />
        </svg>
        {downloading ? "…" : "png"}
      </button>
    </div>
  )
}

export function makeFrameId(lang: string, code: string) {
  return `code-frame-${lang}-${code.length}`
}
