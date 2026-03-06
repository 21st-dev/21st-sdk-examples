import { tool } from "@21st-sdk/agent"
import {
  browserUseExtractInputSchema,
  runBrowserUseExtraction,
  submitExtractionInputSchema,
  normalizeExtractionResult,
  textResult,
} from "./browser-use"
import { getBrowserUseConfig } from "./env"

export const webScraperTools = {
  browser_use_extract: tool({
    description:
      "Use Browser Use Cloud to open a URL in a real browser and extract structured data from dynamic pages.",
    inputSchema: browserUseExtractInputSchema,
    execute: async ({ url, request }) => {
      const config = getBrowserUseConfig()
      if (!config.ok) return textResult({ error: config.error }, true)
      return runBrowserUseExtraction(config, { url, request })
    },
  }),
  submit_extraction: tool({
    description:
      "Submit final structured extraction payload for the current scraping request. Call exactly once per request.",
    inputSchema: submitExtractionInputSchema,
    execute: async ({ url, request, data, notes }) => {
      const normalized = normalizeExtractionResult(
        { url, request, data, notes: notes ?? null },
        url,
        request,
      )
      return textResult(normalized)
    },
  }),
}
