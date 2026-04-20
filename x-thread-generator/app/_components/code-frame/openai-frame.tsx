"use client"

// OpenAI ray-so frame: deep navy #121a29 background, #232b41 window with a
// hair-thin white/10 border and a heavy multi-layer drop shadow. No chrome.
// Line numbers in a muted white/20. Ported from OpenAIFrame.module.css.

import { type CodeTheme } from "../code-themes"
import {
  type CodeBlock,
  type CodeSettings,
  FrameActions,
  HighlightedCode,
  makeFrameId,
  resolveLineNumbers,
  themeCssVars,
} from "./shared"

export function OpenAIFrame({
  block,
  theme,
  codeSettings,
}: {
  block: CodeBlock
  theme: CodeTheme
  codeSettings?: CodeSettings
}) {
  const frameId = makeFrameId(block.lang, block.code)
  const showBg = codeSettings?.showBackground ?? true
  return (
    <div
      className="relative mt-2 group/code overflow-hidden p-10"
      style={{ ...themeCssVars(theme), background: showBg ? "#121a29" : "transparent" }}
    >
      <div
        id={frameId}
        className="relative"
        style={{
          background: "#232b41",
          // Right-edge fade in HighlightedCode blends to var(--cb-bg); override
          // so the fade matches the window color, not the theme's token-bg.
          ["--cb-bg" as string]: "#232b41",
          border: "0.5px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          boxShadow:
            "0 100px 89px rgba(0,0,0,0.07), 0 41px 37px rgba(0,0,0,0.05), 0 22px 19px rgba(0,0,0,0.04), 0 12px 11px rgba(0,0,0,0.04), 0 6px 5px rgba(0,0,0,0.03), 0 2px 2px rgba(0,0,0,0.02)",
        }}
      >
        <HighlightedCode
          code={block.code}
          lang={block.lang}
          theme={{ ...theme, font: "ibm-plex-mono" }}
          withLineNumbers={resolveLineNumbers(theme, codeSettings, true)}
        />
      </div>

      <FrameActions frameId={frameId} code={block.code} />
    </div>
  )
}
