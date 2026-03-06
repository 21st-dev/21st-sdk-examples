import { v } from "convex/values"
import { query, mutation } from "./_generated/server"

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("notes").order("desc").collect()
  },
})

export const search = query({
  args: { query: v.string() },
  handler: async (ctx, { query: searchQuery }) => {
    const byTitle = await ctx.db
      .query("notes")
      .withSearchIndex("search_title", (q) => q.search("title", searchQuery))
      .collect()

    const byContent = await ctx.db
      .query("notes")
      .withSearchIndex("search_content", (q) => q.search("content", searchQuery))
      .collect()

    // Deduplicate results
    const seen = new Set<string>()
    const results = []
    for (const note of [...byTitle, ...byContent]) {
      if (!seen.has(note._id)) {
        seen.add(note._id)
        results.push(note)
      }
    }
    return results
  },
})

export const getByTag = query({
  args: { tag: v.string() },
  handler: async (ctx, { tag }) => {
    const allNotes = await ctx.db.query("notes").order("desc").collect()
    return allNotes.filter((note) =>
      note.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
    )
  },
})

export const create = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { title, content, tags }) => {
    const now = Date.now()
    const id = await ctx.db.insert("notes", {
      title,
      content,
      tags: tags ?? [],
      createdAt: now,
      updatedAt: now,
    })
    return id
  },
})

export const update = mutation({
  args: {
    id: v.id("notes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { id, title, content, tags }) => {
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error(`Note ${id} not found`)

    await ctx.db.patch(id, {
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(tags !== undefined && { tags }),
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const existing = await ctx.db.get(id)
    if (!existing) throw new Error(`Note ${id} not found`)
    await ctx.db.delete(id)
  },
})

export const removeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const notes = await ctx.db.query("notes").collect()
    await Promise.all(notes.map((note) => ctx.db.delete(note._id)))
    return { removed: notes.length }
  },
})
