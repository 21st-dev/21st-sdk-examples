import type { CustomToolRendererProps } from "@21st-sdk/react"

function parseOutput(output: unknown): Record<string, unknown> | null {
  if (!output) return null
  if (typeof output === "string") {
    try {
      return JSON.parse(output)
    } catch {
      return { text: output }
    }
  }
  if (Array.isArray(output)) {
    const textItem = (output as Array<{ type?: string; text?: string }>).find(
      (item) => item.type === "text",
    )
    if (textItem?.text) {
      try {
        return JSON.parse(textItem.text)
      } catch {
        return { text: textItem.text }
      }
    }
  }
  if (typeof output === "object" && output !== null && "text" in output) {
    try {
      return JSON.parse((output as { text: string }).text)
    } catch {
      return output as Record<string, unknown>
    }
  }
  return output as Record<string, unknown>
}

export function SaveNoteRenderer({ status, output }: CustomToolRendererProps) {
  const data = parseOutput(output)
  const note = data?.note as Record<string, unknown> | undefined

  return (
    <div className="px-3.5 py-2.5 bg-green-950 border border-green-900 rounded-lg text-[13px]">
      <div className="text-green-400 font-bold mb-1">Save Note</div>
      {status === "pending" && <span className="text-yellow-400">Saving...</span>}
      {status === "success" && note && (
        <div>
          <div className="text-lime-400">Saved: {note.title as string}</div>
          {Array.isArray(note.tags) && note.tags.length > 0 && (
            <div className="text-neutral-500 text-[11px] mt-1">
              Tags: {note.tags.join(", ")}
            </div>
          )}
        </div>
      )}
      {status === "error" && <span className="text-red-400">Failed to save</span>}
    </div>
  )
}

export function SearchNotesRenderer({ status, output }: CustomToolRendererProps) {
  const data = parseOutput(output)

  return (
    <div className="px-3.5 py-2.5 bg-indigo-950 border border-indigo-900 rounded-lg text-[13px]">
      <div className="text-indigo-400 font-bold mb-1">Search Notes</div>
      {status === "pending" && <span className="text-yellow-400">Searching...</span>}
      {status === "success" && (
        <div className="text-indigo-300">
          Found {(data?.count as number) ?? 0} note
          {(data?.count as number) !== 1 ? "s" : ""}
        </div>
      )}
      {status === "error" && <span className="text-red-400">Search failed</span>}
    </div>
  )
}

export function ListNotesRenderer({ status, output }: CustomToolRendererProps) {
  const data = parseOutput(output)

  return (
    <div className="px-3.5 py-2.5 bg-indigo-950 border border-indigo-900 rounded-lg text-[13px]">
      <div className="text-indigo-400 font-bold mb-1">List Notes</div>
      {status === "pending" && <span className="text-yellow-400">Loading...</span>}
      {status === "success" && (
        <div className="text-indigo-300">
          {(data?.count as number) ?? 0} note
          {(data?.count as number) !== 1 ? "s" : ""} found
        </div>
      )}
      {status === "error" && <span className="text-red-400">Failed to load</span>}
    </div>
  )
}

export function UpdateNoteRenderer({ status }: CustomToolRendererProps) {
  return (
    <div className="px-3.5 py-2.5 bg-yellow-950 border border-yellow-900 rounded-lg text-[13px]">
      <div className="text-yellow-400 font-bold mb-1">Update Note</div>
      {status === "pending" && <span className="text-yellow-400">Updating...</span>}
      {status === "success" && <span className="text-lime-400">Note updated</span>}
      {status === "error" && <span className="text-red-400">Update failed</span>}
    </div>
  )
}

export function DeleteNoteRenderer({ status }: CustomToolRendererProps) {
  return (
    <div className="px-3.5 py-2.5 bg-red-950 border border-red-900 rounded-lg text-[13px]">
      <div className="text-red-400 font-bold mb-1">Delete Note</div>
      {status === "pending" && <span className="text-yellow-400">Deleting...</span>}
      {status === "success" && <span className="text-lime-400">Note deleted</span>}
      {status === "error" && <span className="text-red-400">Delete failed</span>}
    </div>
  )
}

export function TagFilterRenderer({ status, output }: CustomToolRendererProps) {
  const data = parseOutput(output)

  return (
    <div className="px-3.5 py-2.5 bg-purple-950 border border-purple-900 rounded-lg text-[13px]">
      <div className="text-purple-400 font-bold mb-1">Filter by Tag</div>
      {status === "pending" && <span className="text-yellow-400">Filtering...</span>}
      {status === "success" && (
        <div className="text-purple-300">
          {(data?.count as number) ?? 0} note
          {(data?.count as number) !== 1 ? "s" : ""} with tag &quot;{data?.tag as string}&quot;
        </div>
      )}
      {status === "error" && <span className="text-red-400">Filter failed</span>}
    </div>
  )
}
