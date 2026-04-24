/** Shape of an in-flight / completed render. Shared by LivePreview, ChatPanel,
 * and the editor shell so everyone agrees on the status vocabulary. */

export type RenderStatus = "idle" | "rendering" | "done" | "error"

export interface RenderUpload {
  backend: string
  bytes: number
  elapsedMs: number
}

export interface RenderState {
  url: string | null
  status: RenderStatus
  errorMessage: string | null
  upload: RenderUpload | null
}

export const INITIAL_RENDER: RenderState = {
  url: null,
  status: "idle",
  errorMessage: null,
  upload: null,
}
