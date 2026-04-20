"use client"

// Tweet attachments — video (native-style inline player look) and link
// (OG card). File attachments aren't supported here because X/Twitter
// doesn't render native file cards in feeds.
//
// VideoCard aesthetic ported from
//   21st-private-1/apps/web/app/(news)/news/post/[id]/post-detail.tsx
// (DirectVideoPlayer) — rounded container, centered big play button,
// progress track + played portion, duration pill bottom-left.

export type Attachment =
  | {
      kind: "video"
      title?: string
      domain?: string
      thumbnail?: string
      duration?: string
      url?: string
    }
  | {
      kind: "link"
      title: string
      description?: string
      domain?: string
      image?: string
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
  }
}

// News-style inline video preview (mirrors apps/web/news DirectVideoPlayer).
// When `url` is provided, renders a real <video> that auto-plays muted on
// mount — same behavior as X's native timeline videos. Falls back to a
// gradient + centered play button when no url / poster is available.
function VideoCard({
  url,
  thumbnail,
  duration,
  domain,
}: Extract<Attachment, { kind: "video" }>) {
  return (
    <div className="mt-2 relative overflow-hidden rounded-2xl border border-neutral-200/50 dark:border-white/5 bg-black aspect-video select-none">
      {url ? (
        <video
          src={url}
          poster={thumbnail}
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 30%, #3730a3 0%, #0c4a6e 40%, #0a0a0a 100%)",
          }}
        />
      )}

      {/* Centered play button only when we have no real <video> playing */}
      {!url && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-white translate-x-[1px]"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}

      {/* Bottom gradient for legibility of overlays */}
      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

      {/* Time pill bottom-left (shown regardless; matches the news player) */}
      {duration && (
        <div
          className="absolute bottom-2 left-3 flex items-center rounded bg-black/75 backdrop-blur-sm pointer-events-none"
          style={{ padding: "0.5px 6px", height: 18 }}
        >
          <span className="text-[11px] font-mono text-white/90 leading-none">
            {duration}
          </span>
        </div>
      )}

      {/* Domain chip bottom-right — how Twitter labels external sources */}
      {domain && (
        <div
          className="absolute bottom-2 right-3 flex items-center rounded bg-black/50 backdrop-blur-sm pointer-events-none"
          style={{ padding: "0.5px 6px", height: 18 }}
        >
          <span className="text-[11px] text-white/80 leading-none">
            {domain}
          </span>
        </div>
      )}
    </div>
  )
}

// Horizontal OG link card: small square thumb on the left, title /
// description / domain on the right. Matches how a shared article renders
// in the X timeline.
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
          <img
            src={image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
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
