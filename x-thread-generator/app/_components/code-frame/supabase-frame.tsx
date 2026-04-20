"use client"

// Supabase ray-so frame: #121212 background, #171717 window with #292929 border,
// #1f1f1f header bar with filename (underlined, IBM Plex Mono) and language.

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

const IBM_PLEX = `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace`

export function SupabaseFrame({
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
      className="relative mt-2 group/code overflow-hidden p-6"
      style={{ ...themeCssVars(theme), background: showBg ? "#121212" : "transparent" }}
    >
      <div
        id={frameId}
        className="relative"
        style={{
          background: "#171717",
          border: "1px solid #292929",
          borderRadius: 6,
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4"
          style={{
            height: 40,
            borderBottom: "1px solid #292929",
            background: "#1f1f1f",
            borderTopLeftRadius: 5,
            borderTopRightRadius: 5,
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {showFileIcon && <FileIconTile filename={filename} size={18} />}
            <EditableFilename
              ref={filenameRef}
              value={filename}
              onChange={setFilename}
              placeholder="Untitled"
              color="#fafafa"
              fontFamily={IBM_PLEX}
              fontSize={14}
              underline
            />
          </div>
          <span style={{ color: "#898989", fontFamily: IBM_PLEX, fontSize: 14 }}>
            {effectiveLang.toLowerCase()}
          </span>
        </div>

        <HighlightedCode
          code={block.code}
          lang={effectiveLang}
          theme={{ ...theme, font: "ibm-plex-mono" }}
          withLineNumbers={resolveLineNumbers(theme, codeSettings, true)}
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

