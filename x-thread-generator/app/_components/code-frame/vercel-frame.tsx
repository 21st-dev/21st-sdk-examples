"use client"

// Vercel's ray-so frame: black background with extending horizontal + vertical
// gridlines, four L-shaped corner brackets around the code window.
// Ported directly from ray-so/app/(navigation)/(code)/components/frames/VercelFrame.module.css.

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

export function VercelFrame({
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
      className="relative mt-2 group/code overflow-hidden p-8"
      style={{ ...themeCssVars(theme), background: showBg ? "#000" : "transparent" }}
    >
      <div id={frameId} className="relative" style={{ background: "var(--cb-bg)" }}>
        {/* gridlines: before (top) + after (bottom) horizontals that extend past the window */}
        <span aria-hidden>
          <span
            className="pointer-events-none absolute"
            style={{
              top: 0,
              left: -150,
              width: 1200,
              height: 1,
              background: "#1a1a1a",
            }}
          />
          <span
            className="pointer-events-none absolute"
            style={{
              bottom: 0,
              left: -150,
              width: 1200,
              height: 1,
              background: "#1a1a1a",
            }}
          />
        </span>
        {/* verticals */}
        <span aria-hidden>
          <span
            className="pointer-events-none absolute"
            style={{
              top: -150,
              left: 0,
              width: 1,
              height: "calc(100% + 300px)",
              background: "#1a1a1a",
            }}
          />
          <span
            className="pointer-events-none absolute"
            style={{
              top: -150,
              right: 0,
              width: 1,
              height: "calc(100% + 300px)",
              background: "#1a1a1a",
            }}
          />
        </span>

        {/* corner brackets — each is a 25x25 cross formed by two 1px lines */}
        <CornerBracket position="tl" />
        <CornerBracket position="br" />

        <HighlightedCode
          code={block.code}
          lang={block.lang}
          theme={theme}
          withLineNumbers={resolveLineNumbers(theme, codeSettings, false)}
        />
      </div>

      <FrameActions frameId={frameId} code={block.code} />
    </div>
  )
}

function CornerBracket({ position }: { position: "tl" | "br" }) {
  const pos =
    position === "tl"
      ? { top: -12, left: -12 }
      : { bottom: -12, right: -12 }
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{ ...pos, width: 25, height: 25 }}
    >
      <span
        className="absolute"
        style={{ top: 12, left: 0, width: "100%", height: 1, background: "#515356" }}
      />
      <span
        className="absolute"
        style={{ top: 0, left: 12, width: 1, height: "100%", background: "#515356" }}
      />
    </span>
  )
}
