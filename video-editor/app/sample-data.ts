import type { Asset } from "./lib/project"

/**
 * Public Shotstack-hosted demo assets — still open, still small. We reuse
 * them because rendering needs short, fast-to-download files.
 */
export const SAMPLE_ASSETS: Array<Omit<Asset, "id">> = [
  {
    kind: "video",
    url: "https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/footage/beach-overhead.mp4",
    label: "beach-overhead",
    duration: null,
  },
  {
    kind: "video",
    url: "https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/footage/skater.hd.mp4",
    label: "skater",
    duration: null,
  },
  {
    kind: "video",
    url: "https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/footage/table-mountain.mp4",
    label: "table-mountain",
    duration: null,
  },
  {
    kind: "video",
    url: "https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/footage/night-sky.mp4",
    label: "night-sky",
    duration: null,
  },
  {
    kind: "video",
    url: "https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/footage/city-timelapse.mp4",
    label: "city-timelapse",
    duration: null,
  },
  {
    kind: "image",
    url: "https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/images/earth.jpg",
    label: "earth.jpg",
    duration: 0,
  },
  {
    kind: "audio",
    url: "https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/music/disco.mp3",
    label: "disco.mp3",
    duration: null,
  },
  {
    kind: "audio",
    url: "https://shotstack-assets.s3.ap-southeast-2.amazonaws.com/music/freepd/motions.mp3",
    label: "motions.mp3",
    duration: null,
  },
]

export interface SamplePrompt {
  title: string
  prompt: string
}

export const SAMPLE_PROMPTS: SamplePrompt[] = [
  {
    title: "Quick reel",
    prompt:
      "Put beach-overhead (first 5s) and skater (first 5s) back-to-back on V1 and add disco.mp3 on A1 at 30% volume. Then render a preview.",
  },
  {
    title: "Title card",
    prompt:
      "Put table-mountain on V1 for 6s with a 'Wander' text overlay at the bottom. Render a preview.",
  },
  {
    title: "Vertical short",
    prompt:
      "Switch output to 9:16. Put skater on V1 for 8s and motions.mp3 on A1 at 40% volume. Preview it.",
  },
  {
    title: "Image zoom",
    prompt:
      "Put earth.jpg on V1 for 6 seconds and add motions.mp3 on A1. Preview.",
  },
  {
    title: "Two-segment story",
    prompt:
      "On V1: beach-overhead 0-4s with 'Morning' bottom text, then city-timelapse 4-8s with 'Evening' bottom text. A1: disco.mp3 at 25% volume for the full 8s. Render preview.",
  },
  {
    title: "Clear everything",
    prompt: "Clear the timeline so I can start over.",
  },
]
