export type ReviewComment = {
  id: string
  file: string
  line: number
  severity: "critical" | "warning" | "nit"
  category: "correctness" | "security" | "performance" | "style"
  title: string
  body: string
}

const SEV_STYLES: Record<ReviewComment["severity"], string> = {
  critical: "border-red-500/40 bg-red-500/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  nit: "border-zinc-400/40 bg-zinc-400/5",
}

const SEV_DOT: Record<ReviewComment["severity"], string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  nit: "bg-zinc-400",
}

export function CommentCard({ comment }: { comment: ReviewComment }) {
  return (
    <div className={`rounded-md border px-3 py-2 text-xs ${SEV_STYLES[comment.severity]}`}>
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${SEV_DOT[comment.severity]}`} />
        <span className="font-medium text-neutral-900 dark:text-neutral-100">{comment.title}</span>
        <span className="ml-auto rounded border border-neutral-300 px-1 py-0.5 text-[10px] uppercase tracking-wide text-neutral-500 dark:border-neutral-700">
          {comment.category}
        </span>
      </div>
      <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed">{comment.body}</p>
    </div>
  )
}
