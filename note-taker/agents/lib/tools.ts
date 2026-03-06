import { tool } from "@21st-sdk/agent"
import { z } from "zod"
import { getConvexConfig } from "./env"
import { convexQuery, convexMutation, textResult } from "./convex"

/** Typed note shape returned by Convex. */
interface ConvexNote {
  _id: string
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
}

/** Format a Convex note document for agent output. */
function formatNote(n: ConvexNote) {
  return {
    id: n._id,
    title: n.title,
    content: n.content,
    tags: n.tags,
    createdAt: new Date(n.createdAt).toISOString(),
    updatedAt: new Date(n.updatedAt).toISOString(),
  }
}

export const noteTools = {
  save_note: tool({
    description:
      "Save a new note. Use when the user wants to remember something or create a note.",
    inputSchema: z.object({
      title: z.string().describe("Short, descriptive title for the note"),
      content: z.string().describe("Full content/details of the note"),
      tags: z
        .array(z.string())
        .optional()
        .describe('Relevant tags like "deadline", "meeting", "todo", "idea", "project"'),
    }),
    execute: async ({ title, content, tags }) => {
      const config = getConvexConfig()
      if (!config.ok) return textResult({ error: config.error }, true)

      try {
        const id = await convexMutation(config, "notes:create", {
          title,
          content,
          tags: tags ?? [],
        })
        return textResult({
          success: true,
          message: "Note saved",
          note: { id, title, content, tags: tags ?? [] },
        })
      } catch (error) {
        return textResult({ error: `Failed to save note: ${error}` }, true)
      }
    },
  }),

  search_notes: tool({
    description:
      "Search notes by keyword. Use when the user wants to find notes, check deadlines, recall information.",
    inputSchema: z.object({
      query: z.string().describe("Search query to find matching notes by title or content"),
    }),
    execute: async ({ query }) => {
      const config = getConvexConfig()
      if (!config.ok) return textResult({ error: config.error }, true)

      try {
        const notes = await convexQuery(config, "notes:search", { query })
        return textResult({
          count: notes.length,
          notes: notes.map(formatNote),
        })
      } catch (error) {
        return textResult({ error: `Failed to search notes: ${error}` }, true)
      }
    },
  }),

  list_notes: tool({
    description: "List all notes. Use when the user wants to see all their notes.",
    inputSchema: z.object({}),
    execute: async () => {
      const config = getConvexConfig()
      if (!config.ok) return textResult({ error: config.error }, true)

      try {
        const notes = await convexQuery(config, "notes:list")
        return textResult({
          count: notes.length,
          notes: notes.map(formatNote),
        })
      } catch (error) {
        return textResult({ error: `Failed to list notes: ${error}` }, true)
      }
    },
  }),

  get_notes_by_tag: tool({
    description:
      "Get notes filtered by tag. Use when the user asks about a category like deadlines, todos, meetings.",
    inputSchema: z.object({
      tag: z.string().describe('Tag to filter by, e.g. "deadline", "todo", "meeting"'),
    }),
    execute: async ({ tag }) => {
      const config = getConvexConfig()
      if (!config.ok) return textResult({ error: config.error }, true)

      try {
        const notes = await convexQuery(config, "notes:getByTag", { tag })
        return textResult({
          tag,
          count: notes.length,
          notes: notes.map(formatNote),
        })
      } catch (error) {
        return textResult({ error: `Failed to get notes by tag: ${error}` }, true)
      }
    },
  }),

  update_note: tool({
    description:
      "Update an existing note. Requires the note ID (search for it first).",
    inputSchema: z.object({
      id: z.string().describe("The note ID (from search results)"),
      title: z.string().optional().describe("New title (if changing)"),
      content: z.string().optional().describe("New content (if changing)"),
      tags: z.array(z.string()).optional().describe("New tags (if changing)"),
    }),
    execute: async ({ id, title, content, tags }) => {
      const config = getConvexConfig()
      if (!config.ok) return textResult({ error: config.error }, true)

      try {
        await convexMutation(config, "notes:update", {
          id,
          ...(title !== undefined && { title }),
          ...(content !== undefined && { content }),
          ...(tags !== undefined && { tags }),
        })
        return textResult({ success: true, message: "Note updated", id })
      } catch (error) {
        return textResult({ error: `Failed to update note: ${error}` }, true)
      }
    },
  }),

  delete_note: tool({
    description:
      "Delete a note. Requires the note ID (search for it first).",
    inputSchema: z.object({
      id: z.string().describe("The note ID to delete (from search results)"),
    }),
    execute: async ({ id }) => {
      const config = getConvexConfig()
      if (!config.ok) return textResult({ error: config.error }, true)

      try {
        await convexMutation(config, "notes:remove", { id })
        return textResult({ success: true, message: "Note deleted", id })
      } catch (error) {
        return textResult({ error: `Failed to delete note: ${error}` }, true)
      }
    },
  }),
}
