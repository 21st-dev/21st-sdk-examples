export async function GET() {
  return Response.json({
    apiKey: !!process.env.API_KEY_21ST,
    convexUrl: !!process.env.CONVEX_URL,
  })
}
