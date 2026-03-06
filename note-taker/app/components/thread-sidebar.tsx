import type { ThreadItem } from "../types"
import { NotesSidebarContent } from "./notes-panel"

interface ThreadSidebarProps {
  threads: ThreadItem[]
  activeThreadId: string | null
  onSelectThread: (threadId: string) => void
  onNewThread: () => void
  view: "threads" | "notes"
  onViewChange: (view: "threads" | "notes") => void
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  view,
  onViewChange,
}: ThreadSidebarProps) {
  return (
    <aside className="w-72 border-r border-neutral-800 flex flex-col h-full bg-neutral-950">
      <div className="p-3 border-b border-neutral-800 space-y-3">
        <div className="grid grid-cols-2 gap-2 rounded-md bg-neutral-900 p-1">
          <button
            onClick={() => onViewChange("notes")}
            className={`px-3 py-2 text-sm rounded transition-colors ${
              view === "notes"
                ? "bg-neutral-700 text-white"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Notes
          </button>
          <button
            onClick={() => onViewChange("threads")}
            className={`px-3 py-2 text-sm rounded transition-colors ${
              view === "threads"
                ? "bg-neutral-700 text-white"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Threads
          </button>
        </div>

        {view === "threads" && (
          <button
            onClick={onNewThread}
            className="w-full px-3 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
          >
            + New Thread
          </button>
        )}
      </div>

      {view === "threads" ? (
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => onSelectThread(thread.id)}
              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                thread.id === activeThreadId
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              }`}
            >
              {thread.name || "Untitled"}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <NotesSidebarContent />
        </div>
      )}
    </aside>
  )
}
