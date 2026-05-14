"use client"

import { Suspense } from "react"
import { VoicePanel } from "./components/voice-panel"
import "@21st-sdk/react/styles.css"

export default function Home() {
  return (
    <Suspense fallback={<main className="h-screen flex items-center justify-center bg-neutral-950" />}>
      <main className="h-screen bg-neutral-950">
        <VoicePanel />
      </main>
    </Suspense>
  )
}
