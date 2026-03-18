export async function GET() {
  return Response.json({
    apiKey: !!process.env.API_KEY_21ST,
    browserUseKey: !!process.env.BROWSER_USE_API_KEY,
  })
}
