/**
 * Conventions the editor layers on top of the plain chat transport.
 *
 * Two kinds of wrapper markers:
 *  - SYSTEM_NOTE: out-of-band metadata (like the current project snapshot)
 *    prepended to the user message before it reaches the agent, so the agent
 *    always sees the latest state. Stripped before display.
 *  - SILENT: UI-initiated commands (e.g. "render this"). The agent reads
 *    them, but we hide them from the visible chat so plumbing does not
 *    clutter the conversation.
 */

export const SYSTEM_NOTE_PREFIX = "[[[SYSTEM NOTE:"
export const SYSTEM_NOTE_SUFFIX = "]]]"
export const SILENT_PREFIX = "[[[UI-ACTION:"
export const SILENT_SUFFIX = "]]]"

/** Strip a leading `[[[SYSTEM NOTE: ... ]]]` envelope from a display message. */
export function stripSystemNotePrefix(text: string): string {
  if (!text.startsWith(SYSTEM_NOTE_PREFIX)) return text
  const i = text.indexOf(SYSTEM_NOTE_SUFFIX)
  if (i === -1) return text
  return text.slice(i + SYSTEM_NOTE_SUFFIX.length).trimStart()
}

/** A message should be hidden from the visible chat when its (possibly
 * note-wrapped) body starts with the silent-action marker. */
export function isSilentMessage(text: string): boolean {
  const body = stripSystemNotePrefix(text)
  return body.startsWith(SILENT_PREFIX)
}

/** Wrap arbitrary metadata as a SYSTEM_NOTE block suitable for the outbound
 * user message. Used by the chat bridge to inject the current project. */
export function formatSystemNote(body: string): string {
  return `${SYSTEM_NOTE_PREFIX} ${body} ${SYSTEM_NOTE_SUFFIX}`
}

/** Wrap a silent UI-action marker + human description. */
export function formatSilentAction(label: string, instruction: string): string {
  return `${SILENT_PREFIX} ${label} ${SILENT_SUFFIX} ${instruction}`
}
