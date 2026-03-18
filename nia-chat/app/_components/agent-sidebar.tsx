"use client"

import { useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"

const Logo21st = () => (
  <svg className="h-4 w-auto" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="21st logo">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M358.333 0C381.345 0 400 18.6548 400 41.6667V295.833C400 298.135 398.134 300 395.833 300H270.833C268.532 300 266.667 301.865 266.667 304.167V395.833C266.667 398.134 264.801 400 262.5 400H41.6667C18.6548 400 0 381.345 0 358.333V304.72C0 301.793 1.54269 299.081 4.05273 297.575L153.76 207.747C157.159 205.708 156.02 200.679 152.376 200.065L151.628 200H4.16667C1.86548 200 0 198.135 0 195.833V104.167C0 101.865 1.86548 100 4.16667 100H162.5C164.801 100 166.667 98.1345 166.667 95.8333V4.16667C166.667 1.86548 168.532 0 170.833 0H358.333ZM170.833 100C168.532 100 166.667 101.865 166.667 104.167V295.833C166.667 298.135 168.532 300 170.833 300H262.5C264.801 300 266.667 298.135 266.667 295.833V104.167C266.667 101.865 264.801 100 262.5 100H170.833Z"
      fill="currentColor"
    />
  </svg>
)

const BookIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-zinc-500">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
)

const DiscordIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-zinc-500">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
)

const MenuIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const FOOTER_LINK = "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-black/50 dark:text-white/50 transition-[background-color,transform] duration-150 ease-out hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-black/80 dark:hover:text-white/80 active:scale-[0.97]"

interface AgentSidebarProps {
  partnerLogo?: ReactNode
  partnerDocsUrl?: string
  partnerDocsLabel?: string
  children?: ReactNode
}

function SidebarHeader({
  partnerLogo,
  onClose,
}: {
  partnerLogo?: ReactNode
  onClose?: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-3 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
      <div className="flex items-center gap-1.5 text-foreground shrink-0">
        <Logo21st />
        <span className="text-sm font-medium">21st</span>
      </div>

      {partnerLogo && (
        <>
          <span className="text-[10px] font-medium text-black/20 dark:text-white/20 select-none">×</span>
          <div className="flex items-center text-foreground shrink-0 min-w-0 overflow-hidden">
            {partnerLogo}
          </div>
        </>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-black/40 dark:text-white/40 transition-[background-color,transform] duration-150 ease-out hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-black/80 dark:hover:text-white/80 active:scale-[0.97] shrink-0"
          aria-label="Close menu"
        >
          <XIcon />
        </button>
      )}
    </div>
  )
}

function SidebarFooter({
  partnerDocsUrl,
  partnerDocsLabel,
}: {
  partnerDocsUrl?: string
  partnerDocsLabel?: string
}) {
  return (
    <div className="border-t border-black/[0.06] dark:border-white/[0.06] px-2 py-2 space-y-0.5 shrink-0">
      <Link href="https://21st.dev/agents/docs" target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
        <BookIcon />
        <span>21st Agents SDK docs</span>
      </Link>
      {partnerDocsUrl && (
        <Link href={partnerDocsUrl} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
          <BookIcon />
          <span>{partnerDocsLabel}</span>
        </Link>
      )}
      <Link href="https://discord.gg/yn3pzMb7VR" target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
        <DiscordIcon />
        <span>Support on Discord</span>
      </Link>
    </div>
  )
}

export function AgentSidebar({ partnerLogo, partnerDocsUrl, partnerDocsLabel = "Partner docs", children }: AgentSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex h-screen w-[260px] shrink-0 flex-col border-r border-black/[0.06] dark:border-white/[0.06] bg-[hsl(var(--background))]">
        <SidebarHeader partnerLogo={partnerLogo} />
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {children}
        </div>
        <SidebarFooter partnerDocsUrl={partnerDocsUrl} partnerDocsLabel={partnerDocsLabel} />
      </aside>

      {/* ── Mobile topbar (in document flow, h-12) ──────── */}
      <div className="flex md:hidden h-12 shrink-0 items-center gap-2 px-3 border-b border-black/[0.06] dark:border-white/[0.06] bg-[hsl(var(--background))]">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-black/60 dark:text-white/60 transition-[background-color,transform] duration-150 ease-out hover:bg-black/[0.05] dark:hover:bg-white/[0.05] hover:text-[hsl(var(--foreground))] active:scale-[0.97]"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <div className="flex items-center gap-1.5 text-[hsl(var(--foreground))]">
          <Logo21st />
          <span className="text-sm font-medium">21st</span>
        </div>
        {partnerLogo && (
          <>
            <span className="text-[10px] text-black/20 dark:text-white/20 select-none">×</span>
            <div className="text-[hsl(var(--foreground))] min-w-0 overflow-hidden">{partnerLogo}</div>
          </>
        )}
      </div>

      {/* ── Mobile backdrop ──────────────────────────────── */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Mobile drawer ────────────────────────────────── */}
      <aside
        className={`md:hidden fixed left-0 top-0 bottom-0 w-[280px] z-50 flex flex-col border-r border-black/[0.06] dark:border-white/[0.06] bg-[hsl(var(--background))] transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarHeader partnerLogo={partnerLogo} onClose={() => setMobileOpen(false)} />
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {children}
        </div>
        <SidebarFooter partnerDocsUrl={partnerDocsUrl} partnerDocsLabel={partnerDocsLabel} />
      </aside>
    </>
  )
}

/** Sidebar section with an optional label */
export function SidebarSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      {label && (
        <p className="px-2 text-[10px] font-medium uppercase tracking-widest text-black/25 dark:text-white/25 pb-0.5">
          {label}
        </p>
      )}
      {children}
    </section>
  )
}

/** A clickable prompt button for the sidebar */
export function SidebarPromptButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-black/[0.04] dark:bg-white/[0.04] px-3 py-2 text-sm text-black/60 dark:text-white/60 transition-[background-color,border-color,color,transform] duration-150 ease-out hover:border-black/[0.14] dark:hover:border-white/[0.14] hover:bg-black/[0.07] dark:hover:bg-white/[0.07] hover:text-black/90 dark:hover:text-white/90 active:scale-[0.97]"
    >
      {children}
    </button>
  )
}
