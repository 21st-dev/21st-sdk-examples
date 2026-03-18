import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Web Scraper - Browser Use",
  description: "Extract structured data from dynamic websites using Browser Use Cloud",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
