import { tool } from "@21st-sdk/agent"
import { z } from "zod"
import { getAgentMailConfig } from "./env"
import { readMessages, replyToMessage, sendMessage } from "./agentmail"

const sendIntroEmailInputSchema = z.object({
  to: z.string().email().describe("Recipient email address"),
  subject: z.string().min(3).max(200).describe("Email subject line"),
  text: z.string().min(10).describe("Plain-text email body"),
  html: z.string().optional().describe("Optional HTML email body"),
})

const readInboxInputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().describe("How many recent messages to fetch"),
})

const autoReplyInputSchema = z.object({
  text: z.string().min(3).describe("Reply text"),
  html: z.string().optional().describe("Optional HTML reply"),
  messageId: z.string().optional().describe("Specific message_id to reply to; if omitted, reply to latest inbound"),
  replyAll: z.boolean().optional().describe("Whether to reply to all recipients"),
})

function toolTextResult(data: object) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
  }
}

function isInboundMessage(fromValue: unknown, inboxId: string): boolean {
  if (typeof fromValue !== "string") return true
  return !fromValue.toLowerCase().includes(inboxId.toLowerCase())
}

export const emailAgentTools = {
  send_intro_email: tool({
    description: "Send an intro/outreach email through AgentMail",
    inputSchema: sendIntroEmailInputSchema,
    execute: async ({ to, subject, text, html }) => {
      const config = getAgentMailConfig()
      if (!config.ok) return toolTextResult({ sent: false, error: config.error })

      const result = await sendMessage(config, { to, subject, text, html })
      if (!result.ok) {
        return toolTextResult({
          sent: false,
          to,
          subject,
          inboxId: config.inboxId,
          status: result.status,
          error: result.error,
        })
      }

      return toolTextResult({
        sent: true,
        to,
        subject,
        inboxId: config.inboxId,
        result: result.data,
      })
    },
  }),
  read_inbox: tool({
    description: "Read recent messages from the configured AgentMail inbox",
    inputSchema: readInboxInputSchema,
    execute: async ({ limit = 10 }) => {
      const config = getAgentMailConfig()
      if (!config.ok) return toolTextResult({ ok: false, error: config.error })

      const result = await readMessages(config, limit)
      if (!result.ok) {
        return toolTextResult({
          ok: false,
          inboxId: config.inboxId,
          status: result.status,
          error: result.error,
        })
      }

      return toolTextResult({
        ok: true,
        inboxId: config.inboxId,
        limit,
        result: result.data,
      })
    },
  }),
  auto_reply: tool({
    description: "Auto-reply to a specific message or the latest inbound message",
    inputSchema: autoReplyInputSchema,
    execute: async ({ text, html, messageId, replyAll = false }) => {
      const config = getAgentMailConfig()
      if (!config.ok) return toolTextResult({ replied: false, error: config.error })

      let targetMessageId = messageId

      if (!targetMessageId) {
        const readResult = await readMessages(config, 20)
        if (!readResult.ok) {
          return toolTextResult({
            replied: false,
            inboxId: config.inboxId,
            status: readResult.status,
            error: readResult.error,
          })
        }

        const messages = (readResult.data as { messages?: Array<Record<string, unknown>> })?.messages || []
        const inbound = messages.find((msg) => isInboundMessage(msg.from, config.inboxId))
        const selected = inbound || messages[0]
        targetMessageId = typeof selected?.message_id === "string" ? selected.message_id : undefined

        if (!targetMessageId) {
          return toolTextResult({
            replied: false,
            inboxId: config.inboxId,
            error: "No message found to reply to",
          })
        }
      }

      const replyResult = await replyToMessage(config, {
        messageId: targetMessageId,
        text,
        html,
        replyAll,
      })

      if (!replyResult.ok) {
        return toolTextResult({
          replied: false,
          inboxId: config.inboxId,
          messageId: targetMessageId,
          status: replyResult.status,
          error: replyResult.error,
        })
      }

      return toolTextResult({
        replied: true,
        inboxId: config.inboxId,
        messageId: targetMessageId,
        result: replyResult.data,
      })
    },
  }),
}
