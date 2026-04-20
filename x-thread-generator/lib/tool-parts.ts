// Helpers for working with streamed tool-call parts coming out of the agent
// SDK. Kept pure (no React), so they're trivial to unit-test and reuse.

export const SYSTEM_NOTE_PREFIX = "[[[SYSTEM NOTE:"
export const SYSTEM_NOTE_SUFFIX = "]]]"

// Strip the hidden "[[[SYSTEM NOTE: ...]]]" from what the user sees in the chat.
export function stripSystemNotePrefix(text: string): string {
  if (!text.startsWith(SYSTEM_NOTE_PREFIX)) return text
  const i = text.indexOf(SYSTEM_NOTE_SUFFIX)
  if (i === -1) return text
  return text.slice(i + SYSTEM_NOTE_SUFFIX.length).trimStart()
}

// True if a message part looks like a tool-call for the given tool name.
export function isToolPartNamed(part: unknown, toolName: string): boolean {
  if (!part || typeof part !== "object") return false
  const p = part as { type?: unknown; toolName?: unknown }
  const t = typeof p.type === "string" ? p.type : ""
  const n = typeof p.toolName === "string" ? p.toolName : ""
  return `${t} ${n}`.includes(toolName)
}

export type ToolPart = {
  toolCallId?: string
  preliminary: boolean
  output: unknown
  result: unknown
}

// Narrow an unknown message part into the pieces we care about, if it matches
// the given tool name. Returns null otherwise.
export function asToolPart(part: unknown, toolName: string): ToolPart | null {
  if (!isToolPartNamed(part, toolName)) return null
  const m = part as Record<string, unknown>
  return {
    toolCallId: typeof m.toolCallId === "string" ? m.toolCallId : undefined,
    preliminary: typeof m.preliminary === "boolean" ? m.preliminary : false,
    output: m.output,
    result: m.result,
  }
}

// The SDK may hand us the tool output in several shapes:
//   • string
//   • { type: "text", text } array
//   • { "0": "a", "1": "b" } numeric-keyed object
//   • { text: string } | { content: [{ type: "text", text }] }
// Normalize to a single joined string.
export function extractJsonText(output: unknown): string | null {
  if (typeof output === "string") return output
  if (Array.isArray(output)) {
    const parts: string[] = []
    for (const item of output) {
      if (typeof item === "string") parts.push(item)
      else if (item && typeof item === "object") {
        const p = item as { type?: unknown; text?: unknown }
        if (p.type === "text" && typeof p.text === "string") parts.push(p.text)
      }
    }
    return parts.length ? parts.join("") : null
  }
  if (!output || typeof output !== "object") return null
  const numeric = Object.entries(output)
    .filter(([k, v]) => /^\d+$/.test(k) && typeof v === "string")
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  if (numeric.length > 0) return numeric.map(([, v]) => v).join("")
  const o = output as { text?: unknown; content?: unknown }
  if (typeof o.text === "string") return o.text
  if (Array.isArray(o.content)) {
    for (const item of o.content) {
      const p = item as { type?: unknown; text?: unknown }
      if (p && typeof p === "object" && p.type === "text" && typeof p.text === "string") {
        return p.text
      }
    }
  }
  return null
}
