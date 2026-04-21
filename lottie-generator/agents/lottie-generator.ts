import { agent, tool } from "@21st-sdk/agent"
import { z } from "zod"

const lottieAnimationSchema = z
  .object({
    v: z.string(),
    fr: z.number().positive(),
    ip: z.number(),
    op: z.number().positive(),
    w: z.number().positive(),
    h: z.number().positive(),
    nm: z.string().optional(),
    ddd: z.number().optional(),
    assets: z.array(z.record(z.unknown())).optional(),
    layers: z.array(z.record(z.unknown())).min(1),
  })
  .passthrough()

const renderLottieInputSchema = z.object({
  animation: z
    .record(z.unknown())
    .describe("Full Lottie (Bodymovin) JSON object — must include v, fr, ip, op, w, h, layers"),
  name: z.string().min(1).max(80).describe("Short human-readable name for the animation"),
  description: z
    .string()
    .max(240)
    .optional()
    .describe("One-sentence summary of what this animation shows"),
})

export default agent({
  model: "claude-sonnet-4-6",
  runtime: "claude-code",
  permissionMode: "bypassPermissions",
  maxTurns: 20,
  systemPrompt: `You are a Lottie animation generator. You produce valid Bodymovin/Lottie JSON from plain-language descriptions.

Workflow for every request:
1) FIRST, reply with one sentence announcing the design — e.g. "Designing a 400×160 three-ball bouncer, 3 shape layers staggered at 40-frame offsets, 2s loop at 60fps." This tells the user what you're about to build while the tool call streams. Keep it under 25 words.
2) Call render_lottie with a complete, self-contained Lottie JSON as the 'animation' field, plus a short 'name' and optional 'description'. Fill 'name' and 'description' FIRST in the argument stream (place them at the top of the JSON object), then the animation payload — this lets the client preview metadata while the animation body streams.
3) Reply with one short sentence describing what you made. Do not dump the JSON in the chat — the tool output is the source of truth.

Lottie format cheatsheet (Bodymovin v5.7+):
- Top-level: { v, fr, ip, op, w, h, nm, ddd:0, assets:[], layers:[] }
  - v: schema version, use "5.7.1"
  - fr: frame rate (24–60)
  - ip/op: in/out point (frames). Loop duration = op - ip.
  - w/h: canvas size in px (default 400×400 unless asked otherwise).
- Layer shape: { ddd:0, ind:N, ty:4, nm, sr:1, ks:{...}, ao:0, shapes:[...], ip, op, st:0, bm:0 }
  - ty: 4 = shape layer (most common), 1 = solid, 2 = image, 5 = text.
  - ks (transform): { o:opacity, r:rotation, p:position, a:anchor, s:scale }
    - Each is { a:0, k:value } for static, or { a:1, k:[{t,s,i,o},...] } for animated.
    - Static examples: p:{a:0,k:[200,200,0]}, s:{a:0,k:[100,100,100]}, r:{a:0,k:0}, o:{a:0,k:100}.
    - Animated rotation: r:{a:1,k:[{t:0,s:[0]},{t:60,s:[360]}]}.
  - shapes: array of { ty:"gr", it:[shape, fill?, stroke?, transform] }
    - Primitives: el (ellipse), rc (rect), sr (star/polygon), sh (bezier path).
    - el/rc use p (position) and s (size): { ty:"el", p:{a:0,k:[0,0]}, s:{a:0,k:[100,100]} }.
    - fl (fill): { ty:"fl", c:{a:0,k:[r,g,b,1]}, o:{a:0,k:100} } with colors 0..1.
    - st (stroke): { ty:"st", c:{...}, o:{...}, w:{a:0,k:2}, lc:2, lj:2 }.
    - tr (group transform) inside 'gr' must match the ks shape.

Rules:
- Output MUST parse as valid JSON and satisfy the schema. Every layer needs ip, op, and a 'ks' transform.
- Keep it lightweight: prefer 1–6 shape layers. No raster assets.
- Use a clear loop: ip=0, op≈60 for a 1s loop at 60fps, or op=120 for 2s at 60fps.
- Center shapes around the canvas midpoint ([w/2, h/2]) unless the design calls otherwise.
- Colors are [r, g, b, a] with each channel in 0..1. Use tasteful palettes.
- When the user asks for variations ("make it slower", "more bouncy", "change color to red"), re-emit a full new render_lottie call. Do not send diffs.

If the user asks something that is not an animation request (e.g. "what's the weather"), politely decline and suggest an animation to make.`,

  tools: {
    render_lottie: tool({
      description:
        "Render a Lottie animation. Pass a complete Lottie JSON object in 'animation'. The client renders the preview and exposes a download button.",
      inputSchema: renderLottieInputSchema,
      execute: async ({ animation, name, description }) => {
        const parsed = lottieAnimationSchema.safeParse(animation)
        if (!parsed.success) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: "Invalid Lottie JSON",
                  issues: parsed.error.issues.slice(0, 5).map((issue) => ({
                    path: issue.path.join("."),
                    message: issue.message,
                  })),
                }),
              },
            ],
            isError: true,
          }
        }

        const layerCount = Array.isArray(parsed.data.layers) ? parsed.data.layers.length : 0
        const durationSeconds = (parsed.data.op - parsed.data.ip) / parsed.data.fr

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                name,
                description: description ?? null,
                width: parsed.data.w,
                height: parsed.data.h,
                frameRate: parsed.data.fr,
                durationSeconds: Number(durationSeconds.toFixed(2)),
                layerCount,
                animation: parsed.data,
              }),
            },
          ],
        }
      },
    }),
  },

  onError: async ({ error }) => {
    console.error("[lottie-generator] error:", error)
  },

  onFinish: async ({ cost, duration, turns }) => {
    console.log(`[lottie-generator] Done: ${turns} turns, ${duration}ms, $${cost.toFixed(4)}`)
  },
})
