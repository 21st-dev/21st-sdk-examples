import type { ChatSession } from "../types"

interface ThreadSidebarProps {
  threads: ChatSession[]
  activeThreadId: string | null
  currentTheme: "light" | "dark"
  onSelectThread: (threadId: string) => void
  onNewThread: () => void
  onDeleteThread: (threadId: string) => void
  onToggleTheme: () => void
}

function ThemeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      className={className}
      style={{ transform: "rotate(-45deg)" }}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M5 20L19 5" />
      <path d="M16 9L22 13.8528" />
      <path d="M12.4128 12.4059L19.3601 18.3634" />
      <path d="M8 15.6672L15 21.5" />
    </svg>
  )
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  currentTheme,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onToggleTheme,
}: ThreadSidebarProps) {
  return (
    <aside className="flex h-full min-h-0 w-72 flex-col border-r border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="border-b border-[hsl(var(--border))] px-2 pb-3 pt-2">
        <button
          onClick={onNewThread}
          className="an-focus-btn flex h-8 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--foreground)/0.08)] active:scale-[0.97]"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M8 3.25v9.5" />
            <path d="M3.25 8h9.5" />
          </svg>
          <span className="font-medium">New Thread</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3">
        <div className="mb-1 flex h-4 items-center px-2">
          <h3 className="text-xs font-medium text-[hsl(var(--muted-foreground))]">
            Recent
          </h3>
        </div>
        <div className="space-y-0.5">
          {threads.map((thread) => (
            <div
              key={thread.id}
              className={`group relative w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 ${
                thread.id === activeThreadId
                  ? "bg-[hsl(var(--foreground)/0.05)] text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--foreground)/0.05)] hover:text-[hsl(var(--foreground))]"
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectThread(thread.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate">{thread.name || "Untitled"}</div>
                </button>
                <button
                  onClick={() => onDeleteThread(thread.id)}
                  className={`an-focus-btn shrink-0 leading-none text-[hsl(var(--muted-foreground))] transition-[opacity,transform,color] duration-150 ease-out hover:text-[hsl(var(--foreground))] ${
                    thread.id === activeThreadId
                      ? "opacity-100 scale-100"
                      : "pointer-events-none scale-95 opacity-0 group-hover:pointer-events-auto group-hover:scale-100 group-hover:opacity-100"
                  }`}
                  aria-label={`Delete ${thread.name || "chat"}`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  >
                    <path d="M4 4l8 8" />
                    <path d="M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end p-2">
        <button
          onClick={onToggleTheme}
          className="an-focus-btn flex h-7 w-7 items-center justify-center rounded-md text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.5)] hover:text-[hsl(var(--foreground))] active:scale-[0.97]"
          aria-label={
            currentTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
        >
          <ThemeIcon className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
