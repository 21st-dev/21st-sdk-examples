"use client"

import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { makeFunctionReference } from "convex/server"
import { api } from "@/convex/_generated/api"
import type { Id } from "@/convex/_generated/dataModel"

const hasConvex = !!process.env.NEXT_PUBLIC_CONVEX_URL
const removeAllNotesMutation = makeFunctionReference<
  "mutation",
  Record<string, never>,
  { removed: number }
>("notes:removeAll")

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function NotesList() {
  const notes = useQuery(api.notes.list)
  const removeNote = useMutation(api.notes.remove)
  const removeAllNotes = useMutation(removeAllNotesMutation)
  const [removingId, setRemovingId] = useState<Id<"notes"> | null>(null)
  const [isRemovingAll, setIsRemovingAll] = useState(false)

  if (notes === undefined) {
    return (
      <div className="p-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Loading notes...
      </div>
    )
  }

  if (notes.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
        <p>No notes yet.</p>
        <p className="mt-2 text-neutral-500 dark:text-neutral-500">
          Try saying &quot;Remember: project X deadline is Friday&quot;
        </p>
      </div>
    )
  }

  async function handleRemoveNote(id: Id<"notes">) {
    try {
      setRemovingId(id)
      await removeNote({ id })
    } finally {
      setRemovingId(null)
    }
  }

  async function handleRemoveAll() {
    const confirmed = window.confirm("Remove all saved notes?")
    if (!confirmed) return

    try {
      setIsRemovingAll(true)
      await removeAllNotes({})
    } finally {
      setIsRemovingAll(false)
    }
  }

  return (
    <>
      <div className="pt-3 flex items-center justify-between px-4">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {notes.length} note{notes.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={handleRemoveAll}
          disabled={isRemovingAll}
          className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Remove all
        </button>
      </div>
      <div className="px-2 pt-2 pb-2 space-y-2">
        {notes.map((note) => (
          <div
            key={note._id}
            className="p-3 rounded-lg border transition-colors bg-white border-neutral-200 hover:border-neutral-300 dark:bg-neutral-900 dark:border-neutral-800 dark:hover:border-neutral-700"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-medium truncate text-neutral-900 dark:text-neutral-200">
                {note.title}
              </h3>
              <button
                onClick={() => handleRemoveNote(note._id)}
                disabled={removingId === note._id || isRemovingAll}
                className="shrink-0 text-base leading-none text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                aria-label={`Remove ${note.title}`}
              >
                {removingId === note._id ? "…" : "×"}
              </button>
            </div>
            <p className="text-xs mt-1 line-clamp-2 text-neutral-600 dark:text-neutral-400">
              {note.content}
            </p>
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {note.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[10px] mt-2 text-neutral-500 dark:text-neutral-500">
              {formatDate(note.updatedAt)}
            </p>
          </div>
        ))}
      </div>
    </>
  )
}

export function NotesSidebarContent() {
  return (
    <div className="flex h-full flex-col bg-white dark:bg-neutral-950">
      <div className="flex-1 overflow-y-auto">
        {hasConvex ? (
          <NotesList />
        ) : (
          <div className="p-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
            <p>Convex not configured.</p>
            <p className="mt-2 text-neutral-500 dark:text-neutral-500">
              Set NEXT_PUBLIC_CONVEX_URL in .env.local
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
