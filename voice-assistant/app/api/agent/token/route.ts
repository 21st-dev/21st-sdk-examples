import { createTokenHandler } from "@21st-sdk/nextjs/server"

export const POST = createTokenHandler({
  apiKey: process.env.API_KEY_21ST!,
})
