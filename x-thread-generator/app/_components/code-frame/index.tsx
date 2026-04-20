"use client"

// Dispatcher. Picks a branded frame for themes where ray-so has a bespoke
// design (Vercel, Supabase, Tailwind, OpenAI, Resend); falls back to
// DefaultFrame otherwise. All frames accept the same props.

import type { CodeTheme } from "../code-themes"
import { DefaultFrame } from "./default-frame"
import { OpenAIFrame } from "./openai-frame"
import { ResendFrame } from "./resend-frame"
import { SupabaseFrame } from "./supabase-frame"
import { TailwindFrame } from "./tailwind-frame"
import { VercelFrame } from "./vercel-frame"
import type { CodeBlock, CodeSettings } from "./shared"
import { DEFAULT_CODE_SETTINGS } from "./shared"

export type { CodeBlock, CodeSettings }
export { DEFAULT_CODE_SETTINGS }

export function CodeFrame({
  block,
  theme,
  codeSettings,
}: {
  block: CodeBlock
  theme: CodeTheme
  codeSettings?: CodeSettings
}) {
  switch (theme.id) {
    case "vercel":
      return <VercelFrame block={block} theme={theme} codeSettings={codeSettings} />
    case "supabase":
      return <SupabaseFrame block={block} theme={theme} codeSettings={codeSettings} />
    case "tailwind":
      return <TailwindFrame block={block} theme={theme} codeSettings={codeSettings} />
    case "openai":
      return <OpenAIFrame block={block} theme={theme} codeSettings={codeSettings} />
    case "resend":
      return <ResendFrame block={block} theme={theme} codeSettings={codeSettings} />
    default:
      return <DefaultFrame block={block} theme={theme} codeSettings={codeSettings} />
  }
}
