import { createAnTokenHandler } from "@21st-sdk/nextjs/server"

export const POST = createAnTokenHandler({
  apiKey: process.env.AN_API_KEY!,
})
