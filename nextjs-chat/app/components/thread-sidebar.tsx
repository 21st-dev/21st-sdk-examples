import type { ThreadItem } from "../types"

interface ThreadSidebarProps {
  threads: ThreadItem[]
  activeThreadId: string | null
  onSelectThread: (threadId: string) => void
  onNewThread: () => void
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
}: ThreadSidebarProps) {
  return (
    <aside className="w-64 flex flex-col h-full border-r border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={onNewThread}
          className="w-full px-3 py-2 text-sm rounded-md text-neutral-900 transition-colors bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          + New Thread
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {threads.map((thread) => (
          <button
            key={thread.id}
            onClick={() => onSelectThread(thread.id)}
            className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
              thread.id === activeThreadId
                ? "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            {thread.name || "Untitled"}
          </button>
        ))}
      </div>
    </aside>
  )
}
