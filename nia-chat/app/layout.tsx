import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Nia Chat",
  description: "GitHub repository chat powered by Nia MCP and 21st SDK",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
