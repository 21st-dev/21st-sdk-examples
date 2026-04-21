import "./globals.css"
import "@21st-sdk/react/styles.css"

export const metadata = {
  title: "Canvas Template — 21st SDK",
  description: "AI canvas demo built on 21st SDK",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  )
}
