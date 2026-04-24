import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "Video Editor - Shotstack",
  description: "Agentic video editor — assemble clips, images, and audio into a rendered MP4 via Shotstack Cloud.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // `dark` sits on <html> so Radix portals (tooltip / context-menu) inherit
  // the dark-mode CSS variables — portals render at document body, outside
  // any in-page React tree, so a nested `.dark` wrapper won't reach them.
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
