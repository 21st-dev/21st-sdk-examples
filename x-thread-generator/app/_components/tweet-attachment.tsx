"use client"

// Tweet attachments — link / video / file preview cards shown under the
// tweet body, styled to match Twitter's OG/video/file cards.

import { badgeFromFilename } from "@/lib/file-icons"

export type Attachment =
  | {
      kind: "video"
      title: string
      domain?: string
      thumbnail?: string   // image URL; if missing, a gradient fallback
      duration?: string    // "4:32"
      url?: string
    }
  | {
      kind: "link"
      title: string
      description?: string
      domain?: string
      image?: string       // OG image; if missing, a colored letter tile
      url?: string
    }
  | {
      kind: "file"
      filename: string
      size?: string        // "1.2 MB"
      mime?: string        // "application/pdf"
      pages?: number
      url?: string
    }

interface Props {
  attachment: Attachment
}

export function TweetAttachment({ attachment }: Props) {
  switch (attachment.kind) {
    case "video":
      return <VideoCard {...attachment} />
    case "link":
      return <LinkCard {...attachment} />
    case "file":
      return <FileCard {...attachment} />
  }
}

// ── Video card: 16:9 thumbnail with play overlay, duration badge, dark footer.
function VideoCard({
  title,
  domain,
  thumbnail,
  duration,
}: Extract<Attachment, { kind: "video" }>) {
  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-black">
      <div className="relative aspect-video w-full">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 30% 30%, #4338ca 0%, #0ea5e9 40%, #0b1220 100%)",
            }}
          />
        )}

        {/* vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent" />

        {/* play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm ring-1 ring-white/20">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-white translate-x-[1px]">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </div>

        {/* duration badge */}
        {duration && (
          <span className="absolute right-2 bottom-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">
            {duration}
          </span>
        )}
      </div>

      <div className="px-3 py-2 bg-neutral-100 dark:bg-neutral-900">
        <div className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1">
          {title}
        </div>
        {domain && (
          <div className="text-[11px] text-neutral-500 mt-0.5">
            From {domain}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Link card: horizontal, small thumb + title + description + domain.
function LinkCard({
  title,
  description,
  domain,
  image,
}: Extract<Attachment, { kind: "link" }>) {
  const initial = (title || domain || "?").charAt(0).toUpperCase()
  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 flex">
      <div className="relative shrink-0 w-[130px] aspect-square bg-neutral-200 dark:bg-neutral-800">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)",
            }}
          >
            {initial}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 px-3 py-2 flex flex-col justify-center">
        {domain && (
          <div className="text-[11px] text-neutral-500 truncate">{domain}</div>
        )}
        <div className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2 mt-0.5">
          {title}
        </div>
        {description && (
          <div className="text-[12px] text-neutral-500 leading-snug line-clamp-2 mt-0.5">
            {description}
          </div>
        )}
      </div>
    </div>
  )
}

// ── File card: icon tile + filename + meta (size, pages).
function FileCard({
  filename,
  size,
  mime,
  pages,
}: Extract<Attachment, { kind: "file" }>) {
  const badge = badgeFromFilename(filename)
  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 flex items-center gap-3 p-3">
      <div
        className="shrink-0 h-12 w-10 rounded flex items-center justify-center text-[10px] font-bold relative"
        style={{ background: badge.bg, color: badge.fg ?? "#ffffff" }}
      >
        <span className="absolute top-1 right-1 h-2 w-2 rounded-sm bg-white/30" />
        {badge.label}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100 truncate">
          {filename}
        </div>
        <div className="text-[11px] text-neutral-500 flex items-center gap-1.5">
          {size && <span>{size}</span>}
          {size && pages && <span>·</span>}
          {pages && <span>{pages} page{pages === 1 ? "" : "s"}</span>}
          {!size && !pages && mime && <span className="truncate">{mime}</span>}
        </div>
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-neutral-400">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
    </div>
  )
}

