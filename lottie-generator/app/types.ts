export type LottieAnimation = Record<string, unknown> & {
  v: string
  fr: number
  ip: number
  op: number
  w: number
  h: number
  layers: Array<Record<string, unknown>>
}

export type RenderLottiePayload = {
  name: string
  description: string | null
  width: number
  height: number
  frameRate: number
  durationSeconds: number
  layerCount: number
  animation: LottieAnimation
}
