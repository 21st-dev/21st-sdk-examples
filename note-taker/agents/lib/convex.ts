import type { ConvexConfigResult } from "./env"

/** Wraps a value as an MCP-compatible text content result. */
export function textResult(data: object, isError?: boolean) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    ...(isError && { isError: true }),
  }
}

/** Call a Convex query function via HTTP. */
export async function convexQuery(
  config: Extract<ConvexConfigResult, { ok: true }>,
  fnName: string,
  args: object = {},
) {
  const res = await fetch(`${config.url}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: fnName, args }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Convex query ${fnName} failed (${res.status}): ${err || "<empty response>"}`)
  }
  const data = await res.json()
  return data.value
}

/** Call a Convex mutation function via HTTP. */
export async function convexMutation(
  config: Extract<ConvexConfigResult, { ok: true }>,
  fnName: string,
  args: object = {},
) {
  const res = await fetch(`${config.url}/api/mutation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: fnName, args }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Convex mutation ${fnName} failed (${res.status}): ${err || "<empty response>"}`)
  }
  const data = await res.json()
  return data.value
}
