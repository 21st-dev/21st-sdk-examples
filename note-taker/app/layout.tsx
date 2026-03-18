import type { Metadata } from "next"
import { ConvexClientProvider } from "./convex-provider"
import "./globals.css"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "21st Note Taker Agent",
  description: "Hackathon-ready Next.js + 21st SDK + Convex note-taking agent template",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  )
}
