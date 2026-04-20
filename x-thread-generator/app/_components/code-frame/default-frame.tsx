"use client"

// Generic ray-so-style frame: gradient padding, rounded window with rings,
// mac traffic-light dots in a grid-aligned header, editable file name in the
// center slot (mirrors DefaultFrame.module.css from raycast/ray-so).

import { useRef, useState } from "react"
import { PADDING_CLASS, type CodeTheme } from "../code-themes"
import {
  type CodeBlock,
  type CodeSettings,
  defaultFilename,
  EditableFilename,
  FileIconTile,
  FrameActions,
  HighlightedCode,
  langFromFilename,
  makeFrameId,
  resolveLineNumbers,
  resolvePadding,
  themeCssVars,
} from "./shared"

const PATTERN_BG: Record<string, string> = {
  diagonal:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'><path d='M-10 10 L10 -10 M0 40 L40 0 M30 50 L50 30' stroke='white' stroke-opacity='0.14' stroke-width='1' fill='none'/></svg>\")",
  grid:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><path d='M32 0H0v32' stroke='white' stroke-opacity='0.12' stroke-width='1' fill='none'/></svg>\")",
  noise:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.12 0'/></filter><rect width='120' height='120' filter='url(%23n)'/></svg>\")",
}

const RADIUS_PX: Record<string, string> = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "22px",
}

export function DefaultFrame({
  block,
  theme,
  codeSettings,
}: {
  block: CodeBlock
  theme: CodeTheme
  codeSettings?: CodeSettings
}) {
  const [filename, setFilename] = useState(defaultFilename(block))
  const filenameRef = useRef<HTMLInputElement | null>(null)
  const framePadding = PADDING_CLASS[resolvePadding(theme, codeSettings, "md")]
  const pattern = theme.pattern ?? "none"
  const radius = RADIUS_PX[theme.windowRadius ?? "lg"]
  const chrome = theme.chrome ?? "dots"
  const showBg = codeSettings?.showBackground ?? true
  const showFileIcon = codeSettings?.showFileIcon ?? true
  const frameId = makeFrameId(block.lang, block.code)
  // Renaming the file (e.g. "relay.ts" → "relay.py") re-highlights via shiki.
  const effectiveLang = langFromFilename(filename, block.lang)

  const windowBoxShadow =
    theme.windowBorder === "none"
      ? "none"
      : theme.windowBorder === "glow"
      ? "0 0 0 1px rgba(255,255,255,0.06), 0 0 0 1.5px rgba(0,0,0,0.4), 0 0 40px rgba(255,255,255,0.05)"
      : theme.windowBorder === "strong"
      ? "0 0 0 1px rgba(255,255,255,0.12), 0 0 0 1.5px rgba(0,0,0,0.4)"
      : "0 0 0 1px rgba(255,255,255,0.06), 0 0 0 1.5px rgba(0,0,0,0.3)"

  return (
    <div
      className={`relative mt-2 group/code overflow-hidden ${framePadding}`}
      style={{
        ...themeCssVars(theme),
        background: showBg ? theme.frame : "transparent",
        borderRadius: "18px",
      }}
    >
      {pattern !== "none" && PATTERN_BG[pattern] && showBg && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: PATTERN_BG[pattern] }}
        />
      )}

      <div
        id={frameId}
        className="relative flex flex-col min-h-[88px]"
        style={{
          background: "var(--cb-bg)",
          borderRadius: radius,
          boxShadow: windowBoxShadow,
          paddingTop: chrome === "none" ? 0 : "10px",
        }}
      >
        {chrome === "dots" && (
          <div className="grid h-6 items-center gap-3 px-4" style={{ gridTemplateColumns: "60px 1fr 60px" }}>
            <div className="flex gap-[9px]">
              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }} />
              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }} />
              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }} />
            </div>
            <div className="flex items-center justify-center gap-1.5 text-[12px] font-medium leading-3 tracking-[0.32px]">
              {showFileIcon && <FileIconTile filename={filename} size={14} />}
              <EditableFilename
                ref={filenameRef}
                value={filename}
                onChange={setFilename}
                placeholder="Untitled-1"
                color="var(--cb-muted)"
                fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
                fontSize={12}
              />
            </div>
            <span />
          </div>
        )}

        {chrome === "minimal" && (
          <div className="flex h-6 items-center justify-center gap-1.5 px-4">
            {showFileIcon && <FileIconTile filename={filename} size={14} />}
            <EditableFilename
              ref={filenameRef}
              value={filename}
              onChange={setFilename}
              placeholder="Untitled-1"
              color="var(--cb-muted)"
              fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
              fontSize={12}
            />
          </div>
        )}

        {chrome === "branded" && (
          <div className="flex h-9 items-center gap-2 px-3">
            {showFileIcon && <FileIconTile filename={filename} size={18} />}
            <EditableFilename
              ref={filenameRef}
              value={filename}
              onChange={setFilename}
              placeholder="Untitled"
              color="var(--cb-fg)"
              fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
              fontSize={13}
            />
            <span
              className="ml-auto text-[11px] shrink-0 lowercase"
              style={{ color: "var(--cb-muted)", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
            >
              {effectiveLang}
            </span>
          </div>
        )}

        <HighlightedCode
          code={block.code}
          lang={effectiveLang}
          theme={theme}
          withLineNumbers={resolveLineNumbers(theme, codeSettings, false)}
        />
      </div>

      <FrameActions
        frameId={frameId}
        code={block.code}
        filenameInputRef={chrome !== "none" ? filenameRef : undefined}
        downloadName={filename}
      />
    </div>
  )
}
