/**
 * Typed adapter over the raw `UIMessage.parts` the agent SDK surfaces.
 *
 * The agent emits tool calls like `update_timeline`, `probe_asset`, and
 * `render_project`. The SDK represents them as open-ended objects whose shape
 * varies across versions (`type: "tool-foo"` vs `toolName: "foo"`, etc.). We
 * funnel every tool-related part through `parseToolEvents` so the UI layer
 * deals with a stable discriminated union instead of JSON spelunking.
 */
import type { UIMessage } from "ai"
import type { Op } from "./project-ops"

export interface RenderSuccess {
  url: string
  backend: string
  bytes: number
  elapsedMs: number
}

export interface ProbeInfo {
  duration: number | null
  width: number | null
  height: number | null
  hasAudio: boolean | null
}

export type ToolEvent =
  | { kind: "update_timeline"; callId: string; ops: Op[] }
  | { kind: "probe_asset"; callId: string; url: string; info: ProbeInfo }
  | { kind: "probe_error"; callId: string; error: string }
  | { kind: "render_pending"; callId: string }
  | ({ kind: "render_done"; callId: string } & RenderSuccess)
  | { kind: "render_error"; callId: string; error: string }

export function parseToolEvents(messages: UIMessage[]): ToolEvent[] {
  const events: ToolEvent[] = []
  for (const message of messages) {
    for (const part of message.parts) {
      const event = parsePart(part)
      if (event) events.push(event)
    }
  }
  return events
}

// ───────────────── internals ─────────────────

interface RawToolPart {
  type: string
  toolName?: string
  state?: string
  toolCallId?: string
  preliminary?: boolean
  input?: unknown
  output?: unknown
  result?: unknown
}

function extractToolPart(part: unknown): RawToolPart | null {
  if (!part || typeof part !== "object") return null
  const m = part as Record<string, unknown>
  if (typeof m.type !== "string") return null
  const toolName = typeof m.toolName === "string" ? m.toolName : undefined
  if (!m.type.startsWith("tool-") && !toolName) return null
  return {
    type: m.type,
    toolName,
    state: typeof m.state === "string" ? m.state : undefined,
    toolCallId: typeof m.toolCallId === "string" ? m.toolCallId : undefined,
    preliminary: typeof m.preliminary === "boolean" ? m.preliminary : undefined,
    input: m.input,
    output: m.output,
    result: m.result,
  }
}

function parsePart(part: unknown): ToolEvent | null {
  const tp = extractToolPart(part)
  if (!tp || !tp.toolCallId) return null
  const name = tp.toolName ?? tp.type.replace(/^tool-/, "")

  if (matchTool(name, "update_timeline")) {
    const body = parseToolJson(tp.output ?? tp.result)
    const ops = body?.ops
    if (!Array.isArray(ops)) return null
    return { kind: "update_timeline", callId: tp.toolCallId, ops: ops as Op[] }
  }

  if (matchTool(name, "probe_asset")) {
    const body = parseToolJson(tp.output ?? tp.result)
    if (!body) return null
    if (typeof body.url === "string") {
      return {
        kind: "probe_asset",
        callId: tp.toolCallId,
        url: body.url,
        info: {
          duration: numberOrNull(body.duration),
          width: numberOrNull(body.width),
          height: numberOrNull(body.height),
          hasAudio: typeof body.hasAudio === "boolean" ? body.hasAudio : null,
        },
      }
    }
    if (typeof body.error === "string") {
      return { kind: "probe_error", callId: tp.toolCallId, error: body.error }
    }
    return null
  }

  if (matchTool(name, "render_project")) {
    if (isPendingPart(tp)) {
      return { kind: "render_pending", callId: tp.toolCallId }
    }
    const body = parseToolJson(tp.output ?? tp.result)
    if (!body) return null
    if (typeof body.url === "string") {
      return {
        kind: "render_done",
        callId: tp.toolCallId,
        url: body.url,
        backend: typeof body.backend === "string" ? body.backend : "?",
        bytes: numberOr(body.bytes, 0),
        elapsedMs: numberOr(body.elapsedMs, 0),
      }
    }
    if (typeof body.error === "string") {
      return { kind: "render_error", callId: tp.toolCallId, error: body.error }
    }
  }

  return null
}

function isPendingPart(tp: RawToolPart): boolean {
  return (
    tp.state === "input-available" ||
    tp.state === "streaming" ||
    tp.preliminary === true ||
    (tp.output === undefined && tp.result === undefined)
  )
}

function matchTool(name: string, want: string): boolean {
  return (
    name === want ||
    name.endsWith(`-${want}`) ||
    name.endsWith(`__${want}`) ||
    name.includes(want)
  )
}

function parseToolJson(output: unknown): Record<string, unknown> | null {
  const text = extractToolText(output)
  if (!text) return null
  try {
    const value = JSON.parse(text)
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function extractToolText(output: unknown): string | null {
  if (typeof output === "string") return output
  if (Array.isArray(output)) {
    const t = (output as Array<{ type?: string; text?: string }>).find(
      (p) => p?.type === "text" && typeof p.text === "string",
    )
    return t?.text ?? null
  }
  if (output && typeof output === "object") {
    const m = output as { text?: unknown; content?: unknown }
    if (typeof m.text === "string") return m.text
    if (Array.isArray(m.content)) {
      const t = (m.content as Array<{ type?: string; text?: string }>).find(
        (p) => p?.type === "text" && typeof p.text === "string",
      )
      return t?.text ?? null
    }
  }
  return null
}

function numberOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === "number" ? v : fallback
}
