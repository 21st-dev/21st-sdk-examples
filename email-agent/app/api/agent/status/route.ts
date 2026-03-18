export async function GET() {
  return Response.json({
    apiKey: !!process.env.API_KEY_21ST,
    agentmailKey: !!process.env.AGENTMAIL_API_KEY,
    agentmailInbox: !!process.env.AGENTMAIL_INBOX_ID,
  })
}
