import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "21st Landing Copywriter Agent",
  description: "Generate hero + features + CTA copy in three voices, live-rendered side by side.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
