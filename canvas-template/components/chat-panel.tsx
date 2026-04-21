"use client"

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react"
import { useAtomValue } from "jotai"
import { Chat, useChat } from "@ai-sdk/react"
import { AgentChat } from "@21st-sdk/nextjs"
import { DefaultChatTransport, type UIMessage } from "ai"
import type { ShapeBrief } from "./canvas/canvas"
import { isPlanModeAtom } from "@/lib/ui-atoms"

export type ChatHandle = {
  sendPrompt: (text: string) => void
  messageCount: () => number
}

export function ChatPanel({
  sandboxId,
  threadId,
  getShapes,
  getTheme,
  onDevServerLive,
  onMessageCountChange,
  onMessagesChange,
  handleRef,
}: {
  sandboxId: string
  threadId: string
  getShapes: () => ShapeBrief[]
  getTheme?: () => string
  onDevServerLive: () => void
  onMessageCountChange?: (count: number) => void
  onMessagesChange?: (messages: UIMessage[]) => void
  handleRef?: React.MutableRefObject<ChatHandle | null>
}) {
  const planMode = useAtomValue(isPlanModeAtom)
  // Keep these in refs so the transport body callback always sees the
  // latest values without recreating the Chat instance.
  const planModeRef = useRef(planMode)
  planModeRef.current = planMode
  const themeFnRef = useRef(getTheme)
  themeFnRef.current = getTheme

  const chat = useMemo(
    () =>
      new Chat<UIMessage>({
        id: `${sandboxId}:${threadId}`,
        transport: new DefaultChatTransport({
          api: "/api/chat",
          body: () => ({
            sandboxId,
            threadId,
            shapes: getShapes(),
            planMode: planModeRef.current,
            theme: themeFnRef.current ? themeFnRef.current() : undefined,
          }),
        }),
        onFinish: ({ message }: { message: UIMessage }) => {
          try {
            const serialized = JSON.stringify(message.parts ?? [])
            if (
              serialized.includes("Dev server is up") ||
              serialized.includes("already running on port 3000") ||
              serialized.includes("Preview is now live")
            ) {
              onDevServerLive()
            }
          } catch {}
        },
      }),
    [sandboxId, threadId, getShapes, onDevServerLive],
  )

  const { messages, sendMessage, status, stop, error } = useChat({ chat })

  const handleSend = useCallback(
    (msg: { content: string }) => {
      sendMessage({ text: msg.content })
    },
    [sendMessage],
  )

  useEffect(() => {
    onMessageCountChange?.(messages.length)
    onMessagesChange?.(messages)
  }, [messages, onMessageCountChange, onMessagesChange])

  useImperativeHandle(
    handleRef,
    () => ({
      sendPrompt: (text: string) => sendMessage({ text }),
      messageCount: () => messages.length,
    }),
    [sendMessage, messages.length],
  )

  return (
    <AgentChat
      messages={messages}
      onSend={handleSend}
      status={status}
      onStop={stop}
      error={error ?? undefined}
      colorMode="dark"
    />
  )
}
