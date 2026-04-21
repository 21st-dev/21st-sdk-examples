export async function GET() {
  return Response.json({
    apiKey: !!process.env.API_KEY_21ST,
    supabase:
      !!process.env.SUPABASE_URL &&
      !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
  })
}
