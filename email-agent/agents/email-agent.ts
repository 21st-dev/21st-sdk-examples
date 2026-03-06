import { readFileSync } from "fs"
import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

let sandboxEnvLoaded = false

function loadSandboxEnv() {
  if (sandboxEnvLoaded) return
  sandboxEnvLoaded = true

  try {
    const raw = readFileSync("/home/user/.env", "utf-8")
    for (const line of raw.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (!match) continue

      const key = match[1].trim()
      const value = match[2].trim()
      if (!process.env[key]) process.env[key] = value
    }
  } catch {
    // Sandbox .env is optional in local/dev contexts.
  }
}

function getEnv(name: string): string {
  if (process.env[name]) return process.env[name] as string
  loadSandboxEnv()
  return process.env[name] ?? ""
}

type AgentMailConfigResult =
  | { ok: true; apiKey: string; inboxId: string }
  | { ok: false; error: string }

function getAgentMailConfig(): AgentMailConfigResult {
  const apiKey = getEnv("AGENTMAIL_API_KEY")
  const inboxId = getEnv("AGENTMAIL_INBOX_ID")

  if (!apiKey) return { ok: false, error: "AGENTMAIL_API_KEY is not configured" }
  if (!inboxId) return { ok: false, error: "AGENTMAIL_INBOX_ID is not configured" }

  return { ok: true, apiKey, inboxId }
}

type AgentMailConfig = Extract<AgentMailConfigResult, { ok: true }>

type ApiResult =
  | { ok: true; data: unknown }
  | { ok: false; status?: number; error: unknown }

async function parseResponse(response: Response): Promise<unknown> {
  const raw = await response.text()

  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return raw
  }
}

function authHeaders(config: AgentMailConfig) {
  return {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  }
}

async function sendMessage(
  config: AgentMailConfig,
  input: { to: string; subject: string; text: string; html?: string },
): Promise<ApiResult> {
  try {
    const response = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(config.inboxId)}/messages/send`,
      {
        method: "POST",
        headers: authHeaders(config),
        body: JSON.stringify({
          to: input.to,
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        }),
      },
    )

    const parsed = await parseResponse(response)
    if (!response.ok) return { ok: false, status: response.status, error: parsed || "AgentMail send failed" }
    return { ok: true, data: parsed }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function readMessages(config: AgentMailConfig, limit: number): Promise<ApiResult> {
  try {
    const response = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(config.inboxId)}/messages?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
      },
    )

    const parsed = await parseResponse(response)
    if (!response.ok) return { ok: false, status: response.status, error: parsed || "AgentMail read failed" }
    return { ok: true, data: parsed }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

async function replyToMessage(
  config: AgentMailConfig,
  input: { messageId: string; text: string; html?: string; replyAll?: boolean },
): Promise<ApiResult> {
  try {
    const response = await fetch(
      `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(config.inboxId)}/messages/${encodeURIComponent(input.messageId)}/reply`,
      {
        method: "POST",
        headers: authHeaders(config),
        body: JSON.stringify({
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
          ...(input.replyAll ? { reply_all: true } : {}),
        }),
      },
    )

    const parsed = await parseResponse(response)
    if (!response.ok) return { ok: false, status: response.status, error: parsed || "AgentMail auto reply failed" }
    return { ok: true, data: parsed }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

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
  messageId: z
    .string()
    .optional()
    .describe("Specific message_id to reply to; if omitted, reply to latest inbound"),
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

const emailAgentTools = {
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

export default agent({
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions",
  maxTurns: 12,
  systemPrompt: `You are an email operations copilot for early-stage teams.

Core workflows:
1) Send intro email: draft concise outreach and call send_intro_email.
2) Review inbox: call read_inbox when user asks to check responses.
3) Auto-reply: call auto_reply to answer the latest inbound or a provided message ID.

Rules:
- Keep responses concise and execution-focused.
- Do not invent product claims or customer facts.
- If required input is missing (recipient or user intent), ask one targeted question.
- After each send_intro_email call, respond with one short status line.
- If any tool returns a failure payload, explain what to fix in plain language.`,
  tools: emailAgentTools,
})
