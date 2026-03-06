import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "21st Email Agent Boilerplate",
  description: "Hackathon-ready Next.js + 21st SDK + AgentMail template for outbound and inbox workflows",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
