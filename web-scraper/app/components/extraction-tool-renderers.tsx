import type { CustomToolRendererProps } from "@21st-sdk/react"

function parseOutput(output: unknown): Record<string, unknown> | null {
  if (!output) return null
  if (typeof output === "string") {
    try {
      return JSON.parse(output)
    } catch {
      return { text: output }
    }
  }
  if (Array.isArray(output)) {
    const textPart = (output as Array<{ type?: string; text?: string }>).find(
      (item) => item.type === "text",
    )
    if (!textPart?.text) return null
    try {
      return JSON.parse(textPart.text)
    } catch {
      return { text: textPart.text }
    }
  }
  if (typeof output === "object") return output as Record<string, unknown>
  return null
}

export function BrowserUseExtractRenderer({ status, output }: CustomToolRendererProps) {
  const data = parseOutput(output)
  const rowCount = Array.isArray(data?.data) ? data.data.length : 0

  return (
    <div className="px-3.5 py-2.5 bg-blue-950 border border-blue-900 rounded-lg text-[13px]">
      <div className="text-blue-300 font-bold mb-1">Browser Use Extraction</div>
      {status === "pending" && <span className="text-yellow-300">Running browser task...</span>}
      {status === "success" && (
        <div className="text-blue-200">
          Collected {rowCount} row{rowCount === 1 ? "" : "s"}
        </div>
      )}
      {status === "error" && <span className="text-red-300">Extraction failed</span>}
    </div>
  )
}

export function SubmitExtractionRenderer({ status, output }: CustomToolRendererProps) {
  const data = parseOutput(output)
  const rowCount = Array.isArray(data?.data) ? data.data.length : 0
  const notes = typeof data?.notes === "string" ? data.notes : null

  return (
    <div className="px-3.5 py-2.5 bg-emerald-950 border border-emerald-900 rounded-lg text-[13px]">
      <div className="text-emerald-300 font-bold mb-1">Final Structured Result</div>
      {status === "pending" && <span className="text-yellow-300">Preparing final payload...</span>}
      {status === "success" && (
        <div className="space-y-1">
          <div className="text-emerald-200">
            {rowCount} item{rowCount === 1 ? "" : "s"} ready
          </div>
          {notes && <div className="text-neutral-300 text-[11px]">Notes: {notes}</div>}
        </div>
      )}
      {status === "error" && <span className="text-red-300">Submission failed</span>}
    </div>
  )
}
