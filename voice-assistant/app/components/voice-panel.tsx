"use client"

import { useEffect, useRef, useState } from "react"

type CallStatus = "idle" | "connecting" | "active"

interface TranscriptEntry {
  role: "user" | "assistant"
  text: string
}

const ASSISTANT_CONFIG = {
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en",
  },
  model: {
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    messages: [
      {
        role: "system",
        content:
          "You are a helpful voice assistant. Keep responses concise and conversational — 1 to 3 sentences. Do not use markdown, bullet points, or code blocks.",
      },
    ],
  },
  voice: {
    provider: "11labs",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
  },
}

function MicIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

function StopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  )
}

function MicOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}

export function VoicePanel() {
  const [status, setStatus] = useState<CallStatus>("idle")
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const vapiRef = useRef<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript])

  async function startCall() {
    setError(null)
    setStatus("connecting")
    try {
      const { default: Vapi } = await import("@vapi-ai/web")
      const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_KEY!)
      vapiRef.current = vapi

      vapi.on("call-start", () => setStatus("active"))
      vapi.on("call-end", () => {
        setStatus("idle")
        vapiRef.current = null
      })
      vapi.on("error", (e: any) => {
        console.error("[vapi] error:", JSON.stringify(e), e)
        const msg = e?.message ?? e?.error?.message ?? e?.errorMsg ?? JSON.stringify(e)
        setError(msg || "Call error")
        setStatus("idle")
        vapiRef.current = null
      })
      vapi.on("message", (msg: any) => {
        if (msg.type === "transcript" && msg.transcriptType === "final") {
          setTranscript((prev) => [...prev, { role: msg.role, text: msg.transcript }])
        }
      })

      await vapi.start(ASSISTANT_CONFIG as any)
    } catch (e: any) {
      setError(e?.message ?? "Failed to start call")
      setStatus("idle")
    }
  }

  function endCall() {
    vapiRef.current?.stop()
    setStatus("idle")
  }

  function toggleMute() {
    if (!vapiRef.current) return
    const next = !isMuted
    vapiRef.current.setMuted(next)
    setIsMuted(next)
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100">
      {/* Controls */}
      <div className="flex items-center justify-center gap-4 py-8 border-b border-neutral-900">
        <div className="relative">
          {status === "active" && (
            <>
              <span className="absolute inset-0 rounded-full bg-white opacity-5 animate-ping" />
              <span className="absolute -inset-2 rounded-full bg-white opacity-[0.03] animate-ping [animation-delay:0.4s]" />
            </>
          )}
          <button
            onClick={status === "idle" ? startCall : endCall}
            disabled={status === "connecting"}
            className={`relative z-10 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200
              ${status === "idle" ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white" : ""}
              ${status === "connecting" ? "bg-neutral-800 text-neutral-500 animate-pulse cursor-not-allowed" : ""}
              ${status === "active" ? "bg-white text-neutral-950 hover:bg-neutral-200" : ""}
            `}
          >
            {status === "active" ? <StopIcon /> : <MicIcon />}
          </button>
        </div>

        {status === "active" && (
          <button
            onClick={toggleMute}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
              ${isMuted ? "bg-red-500/20 text-red-400" : "bg-neutral-800 text-neutral-400 hover:text-neutral-200"}`}
          >
            <MicOffIcon />
          </button>
        )}

        <span className="text-xs text-neutral-500 min-w-[80px]">
          {status === "idle" && "Click to talk"}
          {status === "connecting" && "Connecting..."}
          {status === "active" && (isMuted ? "Muted" : "Listening")}
        </span>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {transcript.length === 0 ? (
          <p className="text-neutral-700 text-xs text-center select-none">
            Transcript will appear here
          </p>
        ) : (
          transcript.map((entry, i) => (
            <div key={i} className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[75%] text-sm leading-relaxed ${entry.role === "user" ? "text-neutral-200" : "text-neutral-400"}`}>
                {entry.role === "assistant" && (
                  <span className="block text-[10px] text-neutral-600 mb-1 uppercase tracking-wider">Assistant</span>
                )}
                {entry.text}
              </p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
