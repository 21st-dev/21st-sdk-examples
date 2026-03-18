export async function GET() {
  return Response.json({
    apiKey: !!process.env.API_KEY_21ST,
    niaKey: !!process.env.NIA_API_KEY,
  })
}
