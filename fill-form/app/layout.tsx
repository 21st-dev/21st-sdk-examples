import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "21st Fill Form Agent",
  description: "AI coding agent powered by 21st SDK",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
