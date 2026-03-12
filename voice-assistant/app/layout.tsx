import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "21st Voice Assistant",
  description: "Voice AI assistant manager powered by 21st SDK and Vapi",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
