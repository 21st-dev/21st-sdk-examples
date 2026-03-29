import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "Docs Assistant",
  description: "AI-powered documentation assistant via llms.txt",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
