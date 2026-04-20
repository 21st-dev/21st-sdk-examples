"use client"

// Tailwind ray-so frame: deep-navy #0f172a bg, dark translucent window with
// subtle dots + faded gridlines extending past the window, tiny translucent
// controls, and a blurred sky→pink gradient streak beneath.
// Ported from ray-so/.../TailwindFrame.module.css (trimmed display-p3 etc.).

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

export function TailwindFrame({
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
      style={{ ...themeCssVars(theme), background: showBg ? "#0f172a" : "transparent" }}
    >
      {/* extending gridlines */}
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: "1.5rem",
          left: "-1rem",
          right: "-1rem",
          height: 1,
          background: "rgba(255,255,255,0.1)",
          WebkitMaskImage:
            "linear-gradient(to left, transparent, white 4rem, white calc(100% - 4rem), transparent)",
          maskImage:
            "linear-gradient(to left, transparent, white 4rem, white calc(100% - 4rem), transparent)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          bottom: "1.5rem",
          left: "-1rem",
          right: "-1rem",
          height: 1,
          background: "rgba(255,255,255,0.1)",
          WebkitMaskImage:
            "linear-gradient(to left, transparent, white 4rem, white calc(100% - 4rem), transparent)",
          maskImage:
            "linear-gradient(to left, transparent, white 4rem, white calc(100% - 4rem), transparent)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: "-1rem",
          bottom: "-1rem",
          left: "1.5rem",
          width: 1,
          background: "rgba(255,255,255,0.1)",
          WebkitMaskImage:
            "linear-gradient(to top, transparent, white 4rem, white calc(100% - 4rem), transparent)",
          maskImage:
            "linear-gradient(to top, transparent, white 4rem, white calc(100% - 4rem), transparent)",
        }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: "-1rem",
          bottom: "-1rem",
          right: "1.5rem",
          width: 1,
          background: "rgba(255,255,255,0.1)",
          WebkitMaskImage:
            "linear-gradient(to top, transparent, white 4rem, white calc(100% - 4rem), transparent)",
          maskImage:
            "linear-gradient(to top, transparent, white 4rem, white calc(100% - 4rem), transparent)",
        }}
      />

      <div
        id={frameId}
        className="relative"
        style={{
          background: "rgb(30, 41, 59)",
          border: "1px solid rgba(210,241,255,0.25)",
          borderRadius: 8,
        }}
      >
        <div
          className="flex items-center gap-1.5 px-3"
          style={{
            height: 34,
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgb(71, 85, 105)" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgb(71, 85, 105)" }} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "rgb(71, 85, 105)" }} />
        </div>

        <HighlightedCode
          code={block.code}
          lang={block.lang}
          theme={{ ...theme, font: "fira-code" }}
          withLineNumbers={resolveLineNumbers(theme, codeSettings, true)}
        />
      </div>

      {/* blurred gradient streak below the window */}
      <div
        aria-hidden
        className="absolute left-[20px] right-[20px] bottom-1 h-8 overflow-hidden"
      >
        <div
          className="h-0.5 w-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(56,189,248,0) 0%, rgb(14,165,233) 32%, rgba(236,72,153,0.3) 67%, rgba(236,72,153,0) 100%)",
            filter: "blur(4px)",
          }}
        />
      </div>

      <FrameActions frameId={frameId} code={block.code} />
    </div>
  )
}
