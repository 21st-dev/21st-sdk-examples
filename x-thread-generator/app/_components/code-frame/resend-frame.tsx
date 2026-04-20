"use client"

// Resend ray-so frame: diagonal gradient backdrop, translucent blurred window,
// slim header with filename + lang.

import { useRef, useState } from "react"
import { type CodeTheme } from "../code-themes"
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
  themeCssVars,
} from "./shared"

const GEIST_MONO = `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`

export function ResendFrame({
  block,
  theme,
  codeSettings,
}: {
  block: CodeBlock
  theme: CodeTheme
  codeSettings?: CodeSettings
}) {
  const frameId = makeFrameId(block.lang, block.code)
  const [filename, setFilename] = useState(defaultFilename(block))
  const filenameRef = useRef<HTMLInputElement | null>(null)
  const showBg = codeSettings?.showBackground ?? true
  const showFileIcon = codeSettings?.showFileIcon ?? true
  const effectiveLang = langFromFilename(filename, block.lang)
  return (
    <div
      className="relative mt-2 group/code overflow-hidden p-8"
      style={{
        ...themeCssVars(theme),
        background: showBg
          ? "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(130,170,255,0.12), transparent 70%), linear-gradient(135deg, #232323 0%, #000 100%)"
          : "transparent",
      }}
    >
      <div
        id={frameId}
        className="relative"
        style={{
          background: "hsla(0, 0%, 0%, 0.88)",
          border: "0.5px solid hsla(0, 0%, 24%, 0.6)",
          borderRadius: 8,
          backdropFilter: "blur(6px)",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4"
          style={{
            height: 40,
            borderBottom: "1px solid hsla(0, 0%, 24%, 0.4)",
            background: "hsla(0, 0%, 0%, 0.9)",
            borderTopLeftRadius: 7.5,
            borderTopRightRadius: 7.5,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {showFileIcon && <FileIconTile filename={filename} size={16} />}
            <EditableFilename
              ref={filenameRef}
              value={filename}
              onChange={setFilename}
              placeholder="Untitled"
              color="hsl(0, 0%, 98%)"
              fontFamily={GEIST_MONO}
              fontSize={13}
            />
          </div>
          <span style={{ color: "#898989", fontFamily: GEIST_MONO, fontSize: 13 }}>
            {effectiveLang.toLowerCase()}
          </span>
        </div>

        <HighlightedCode
          code={block.code}
          lang={effectiveLang}
          theme={{ ...theme, font: "geist-mono" }}
          withLineNumbers={resolveLineNumbers(theme, codeSettings, false)}
        />
      </div>

      <FrameActions
        frameId={frameId}
        code={block.code}
        filenameInputRef={filenameRef}
        downloadName={filename}
      />
    </div>
  )
}
