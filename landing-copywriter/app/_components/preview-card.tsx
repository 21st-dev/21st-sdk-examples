export type Voice = "plain" | "bold" | "playful"

export type CopyBlock = {
  heroTitle: string
  heroSubtitle: string
  features: { title: string; body: string }[]
  ctaLabel: string
}

const VOICE_LABELS: Record<Voice, string> = {
  plain: "Plain",
  bold: "Bold",
  playful: "Playful",
}

export function PreviewCard({
  voice,
  copy,
  onRegenerate,
  isLoading,
}: {
  voice: Voice
  copy: CopyBlock | null
  onRegenerate: () => void
  isLoading?: boolean
}) {
  return (
    <div className="relative rounded-md border border-neutral-200 dark:border-neutral-800 overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-[10px] font-medium uppercase tracking-widest text-neutral-500">
          {VOICE_LABELS[voice]} voice
        </p>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isLoading}
          className="rounded-md border border-neutral-200 bg-white px-2 py-0.5 text-[11px] text-neutral-700 hover:border-neutral-300 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:border-neutral-600"
        >
          Regenerate
        </button>
      </div>
      <div>
        {!copy && <EmptyBody />}
        {copy && voice === "plain" && <PlainBody copy={copy} />}
        {copy && voice === "bold" && <BoldBody copy={copy} />}
        {copy && voice === "playful" && <PlayfulBody copy={copy} />}
      </div>
    </div>
  )
}

function EmptyBody() {
  return (
    <div className="flex h-40 items-center justify-center text-xs text-neutral-400">
      Waiting for copy…
    </div>
  )
}

function PlainBody({ copy }: { copy: CopyBlock }) {
  return (
    <div className="bg-white p-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <h3 className="font-serif text-2xl font-semibold leading-tight">{copy.heroTitle}</h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{copy.heroSubtitle}</p>
      <button className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300">
        {copy.ctaLabel}
      </button>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        {copy.features.map((f, i) => (
          <div key={i}>
            <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100">{f.title}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function BoldBody({ copy }: { copy: CopyBlock }) {
  return (
    <div className="bg-neutral-950 p-6 text-white">
      <h3 className="text-3xl font-black uppercase leading-none tracking-tight">
        {copy.heroTitle}
      </h3>
      <p className="mt-3 text-sm font-medium text-neutral-300">{copy.heroSubtitle}</p>
      <button className="mt-4 rounded-md bg-yellow-400 px-5 py-2 text-xs font-bold uppercase tracking-wide text-neutral-950 hover:bg-yellow-300">
        {copy.ctaLabel}
      </button>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-neutral-800 pt-4">
        {copy.features.map((f, i) => (
          <div key={i}>
            <p className="text-xs font-bold uppercase tracking-wide text-yellow-400">{f.title}</p>
            <p className="mt-0.5 text-[11px] text-neutral-300">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlayfulBody({ copy }: { copy: CopyBlock }) {
  return (
    <div className="bg-gradient-to-br from-rose-50 via-white to-indigo-50 p-6 dark:from-rose-950/30 dark:via-neutral-950 dark:to-indigo-950/30">
      <h3 className="text-2xl font-semibold leading-tight text-neutral-900 dark:text-neutral-100">
        <span aria-hidden>✨ </span>
        {copy.heroTitle}
      </h3>
      <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{copy.heroSubtitle}</p>
      <button className="mt-4 rounded-3xl bg-gradient-to-r from-rose-500 to-indigo-500 px-5 py-2 text-xs font-semibold text-white hover:from-rose-400 hover:to-indigo-400">
        {copy.ctaLabel} →
      </button>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {copy.features.map((f, i) => (
          <div key={i} className="rounded-2xl bg-white/60 p-2.5 backdrop-blur dark:bg-neutral-900/60">
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{f.title}</p>
            <p className="mt-0.5 text-[11px] text-neutral-700 dark:text-neutral-300">{f.body}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
