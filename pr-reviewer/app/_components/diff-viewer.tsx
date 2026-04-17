import type { PatchFile } from "@/lib/sample-data"
import { CommentCard, type ReviewComment } from "./comment-card"

export function DiffViewer({
  files,
  commentsByFileLine,
}: {
  files: PatchFile[]
  commentsByFileLine: Map<string, ReviewComment[]>
}) {
  return (
    <div className="space-y-4">
      {files.map((file) => (
        <div
          key={file.path}
          className="overflow-hidden rounded-md border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div className="border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 font-mono text-xs text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            {file.path}
          </div>
          <div className="font-mono text-[12px] leading-relaxed">
            {file.patch.map((pl, i) => {
              const bg =
                pl.kind === "add"
                  ? "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                  : pl.kind === "remove"
                  ? "bg-red-500/10 text-red-900 dark:text-red-200"
                  : "text-neutral-700 dark:text-neutral-300"
              const prefix = pl.kind === "add" ? "+" : pl.kind === "remove" ? "-" : " "
              const key = `${file.path}:${pl.line}`
              const comments = commentsByFileLine.get(key) ?? []
              return (
                <div key={i}>
                  <div className={`flex gap-2 px-3 py-0.5 ${bg}`}>
                    <span className="w-10 select-none text-right text-neutral-400">{pl.line}</span>
                    <span className="w-3 select-none">{prefix}</span>
                    <span className="whitespace-pre-wrap break-all">{pl.text || "\u00A0"}</span>
                  </div>
                  {comments.length > 0 && (
                    <div className="space-y-1.5 border-l-2 border-neutral-300 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900">
                      {comments.map((c) => (
                        <CommentCard key={c.id} comment={c} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
