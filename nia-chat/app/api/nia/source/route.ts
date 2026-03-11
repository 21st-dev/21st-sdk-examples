import { NiaSDK } from "nia-ai-ts"
import { NextRequest, NextResponse } from "next/server"

const sdk = process.env.NIA_API_KEY
  ? new NiaSDK({ apiKey: process.env.NIA_API_KEY })
  : null

function normalizeRepository(input: string) {
  const trimmed = input.trim().replace(/\.git$/, "")

  try {
    const url = new URL(trimmed)
    if (url.hostname !== "github.com") {
      throw new Error("Only github.com repositories are supported")
    }

    const [owner, repo] = url.pathname.split("/").filter(Boolean)
    if (!owner || !repo) {
      throw new Error("Enter a full GitHub repository URL")
    }

    return `${owner}/${repo}`
  } catch {
    if (/^[^/\s]+\/[^/\s]+$/.test(trimmed)) {
      return trimmed
    }

    throw new Error("Enter a GitHub repository as owner/repo or a github.com URL")
  }
}

export async function POST(req: NextRequest) {
  if (!sdk) {
    return NextResponse.json(
      { error: "NIA_API_KEY is not configured on the Next.js server" },
      { status: 500 },
    )
  }

  try {
    const body = (await req.json()) as { repository?: string }
    if (!body.repository) {
      return NextResponse.json({ error: "repository is required" }, { status: 400 })
    }

    const repository = normalizeRepository(body.repository)

    try {
      const resolved = await sdk.sources.resolve(repository, "repository")
      return NextResponse.json({
        repository,
        sourceId: resolved.id,
        created: false,
      })
    } catch {}

    const created = await sdk.sources.create({
      type: "repository",
      repository,
      wait_for: 30,
    })

    return NextResponse.json({
      repository,
      sourceId: created.id,
      status: created.status ?? null,
      created: true,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare repository" },
      { status: 500 },
    )
  }
}
