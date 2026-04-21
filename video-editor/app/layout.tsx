import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "Video Editor - Shotstack",
  description: "Agentic video editor — assemble clips, images, and audio into a rendered MP4 via Shotstack Cloud.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
