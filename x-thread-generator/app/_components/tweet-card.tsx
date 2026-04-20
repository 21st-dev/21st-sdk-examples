"use client"

import { type CodeTheme } from "./code-themes"
import { CodeFrame, type CodeBlock, type CodeSettings } from "./code-frame"
import {
  TweetAttachment,
  type Attachment,
} from "./tweet-attachment"

export type { CodeBlock, CodeSettings }
export type Tweet = {
  text: string
  codeBlock?: CodeBlock
  attachment?: Attachment
}

// Deterministic mock engagement. Hook (index 0) gets the biggest numbers;
// last tweet decent; middle tweets declining. Small jitter keyed on the
// tweet's text length so it stays stable across re-renders.
function mockEngagement(index: number, total: number, text: string) {
  const isHook = index === 0
  const isLast = index === total - 1 && total > 1
  const base = isHook ? 2100 : isLast ? 840 : Math.max(180, 1800 - index * 240)
  const jitter = (text.length * 37 + index * 13) % 400
  return {
    replies: Math.floor(base * 0.025) + Math.floor(jitter * 0.04),
    reposts: Math.floor(base * 0.12) + Math.floor(jitter * 0.08),
    likes: Math.floor(base * 0.82) + jitter,
    views: Math.floor(base * 62) + jitter * 12,
  }
}

function fmt(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
}

const IconReply = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)
const IconRepost = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
)
const IconLike = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
  </svg>
)
const IconViews = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18" /><path d="M7 12v5" /><path d="M12 8v9" /><path d="M17 4v13" />
  </svg>
)
function Action({
  icon,
  count,
  hoverColor,
}: {
  icon: React.ReactNode
  count?: string | number
  hoverColor: string
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      className={`flex items-center gap-1 -m-1.5 p-1.5 rounded-full transition-colors ${hoverColor}`}
    >
      {icon}
      {count !== undefined && <span className="text-[13px] leading-4 tabular-nums">{count}</span>}
    </button>
  )
}

interface TweetCardProps {
  index: number
  total: number
  tweet: Tweet
  isLast: boolean
  codeTheme: CodeTheme
  codeSettings?: CodeSettings
}

export function TweetCard({
  index,
  total,
  tweet,
  isLast,
  codeTheme,
  codeSettings,
}: TweetCardProps) {
  const chars = tweet.text.length
  const over = chars > 280
  const stats = mockEngagement(index, total, tweet.text)

  return (
    <article className="group relative flex gap-3 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
      <div className="relative flex flex-col items-center shrink-0">
        <div
          className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white shadow-inner"
          style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 400 400"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M358.333 0C381.345 0 400 18.6548 400 41.6667V295.833C400 298.135 398.134 300 395.833 300H270.833C268.532 300 266.667 301.865 266.667 304.167V395.833C266.667 398.134 264.801 400 262.5 400H41.6667C18.6548 400 0 381.345 0 358.333V304.72C0 301.793 1.54269 299.081 4.05273 297.575L153.76 207.747C157.159 205.708 156.02 200.679 152.376 200.065L151.628 200H4.16667C1.86548 200 0 198.135 0 195.833V104.167C0 101.865 1.86548 100 4.16667 100H162.5C164.801 100 166.667 98.1345 166.667 95.8333V4.16667C166.667 1.86548 168.532 0 170.833 0H358.333ZM170.833 100C168.532 100 166.667 101.865 166.667 104.167V295.833C166.667 298.135 168.532 300 170.833 300H262.5C264.801 300 266.667 298.135 266.667 295.833V104.167C266.667 101.865 264.801 100 262.5 100H170.833Z"
            />
          </svg>
        </div>
        {!isLast && (
          <div className="mt-1 flex-1 w-[2px] bg-neutral-200 dark:bg-neutral-800 min-h-[12px]" />
        )}
      </div>

      <div className="flex-1 min-w-0 pb-1">
        <header className="flex items-baseline gap-1 text-[15px] leading-5">
          <span className="font-bold text-neutral-900 dark:text-white truncate">you</span>
          <span className="text-neutral-500 truncate">@you</span>
          <span className="text-neutral-500">·</span>
          <span className="text-neutral-500">now</span>
          <span className="ml-auto text-[13px] text-neutral-500 tabular-nums shrink-0">{index + 1}/{total}</span>
        </header>

        {tweet.text && (
          <div className="mt-0.5 text-[15px] leading-5 text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap break-words">
            {tweet.text}
          </div>
        )}

        {tweet.codeBlock && (
          <CodeFrame
            block={tweet.codeBlock}
            theme={codeTheme}
            codeSettings={codeSettings}
          />
        )}

        {tweet.attachment && <TweetAttachment attachment={tweet.attachment} />}

        <div className="mt-2 text-[12px] tabular-nums">
          <span className={over ? "text-red-500" : "text-neutral-400"}>{chars}</span>
          <span className="text-neutral-400">/280</span>
        </div>

        <footer className="mt-2 flex items-center gap-10 text-neutral-500 max-w-[425px]">
          <Action icon={<IconReply />} count={fmt(stats.replies)} hoverColor="hover:bg-sky-500/10 hover:text-sky-500" />
          <Action icon={<IconRepost />} count={fmt(stats.reposts)} hoverColor="hover:bg-emerald-500/10 hover:text-emerald-500" />
          <Action icon={<IconLike />} count={fmt(stats.likes)} hoverColor="hover:bg-pink-500/10 hover:text-pink-500" />
          <Action icon={<IconViews />} count={fmt(stats.views)} hoverColor="hover:bg-sky-500/10 hover:text-sky-500" />
        </footer>
      </div>
    </article>
  )
}
