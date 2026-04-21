"use client"

import {
  Tldraw,
  createShapeId,
  type Editor,
  type TLShapeId,
} from "tldraw"
import "tldraw/tldraw.css"
import { useCallback, useImperativeHandle, useRef } from "react"
import { VariantShapeUtil, type VariantShape } from "./variant-shape"
import { ImageShapeUtil, type ImageShape } from "./image-shape"

export type CanvasHandle = {
  /** Create a new variant shape (or update one with the same routePath). */
  upsertVariantPreview: (url: string, label: string, routePath: string) => void
  /** Add a variant shape for a brand-new route, positioned next to the others. */
  addVariantPreview: (url: string, label: string, routePath: string) => void
  /** Return brief metadata for every shape currently on the canvas. */
  listShapeBriefs: () => ShapeBrief[]
  /** Return briefs only for currently selected shapes. */
  listSelectedBriefs: () => ShapeBrief[]
  /** Pan+zoom so the given shape fills the viewport, and select it. */
  focusShape: (id: string) => void
  /** Remove a shape by id. */
  deleteShape: (id: string) => void
  /** Deselect a specific shape (removes it from selection). */
  deselectShape: (id: string) => void
}

export type ShapeBrief = {
  id: string
  type: string
  x: number
  y: number
  w?: number
  h?: number
  text?: string
  selected?: boolean
  /** For "reference-image" shapes — user-supplied alt / filename. */
  imageAlt?: string
  /** For "variant" shapes — the app route this iframe points at. */
  routePath?: string
}

const customShapeUtils = [VariantShapeUtil, ImageShapeUtil]

function slugToShapeId(routePath: string): TLShapeId {
  const slug = routePath === "/" ? "root" : routePath.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "root"
  return createShapeId(`variant-${slug}`)
}

function findVariantShape(
  editor: Editor,
  routePath: string,
): VariantShape | undefined {
  const id = slugToShapeId(routePath)
  return editor.getShape(id) as VariantShape | undefined
}

export function Canvas({
  handleRef,
  onSelectionChange,
  onShapesChange,
}: {
  handleRef: React.MutableRefObject<CanvasHandle | null>
  onSelectionChange?: (briefs: ShapeBrief[]) => void
  onShapesChange?: (briefs: ShapeBrief[]) => void
}) {
  const editorRef = useRef<Editor | null>(null)

  /** Create or update a variant shape by its routePath (unique key). */
  const upsertVariantPreview = useCallback(
    (url: string, label: string, routePath: string) => {
      const editor = editorRef.current
      if (!editor) return
      const id = slugToShapeId(routePath)
      const existing = editor.getShape(id) as VariantShape | undefined
      if (existing) {
        editor.updateShape<VariantShape>({
          id,
          type: "variant",
          props: { ...existing.props, url, label, routePath },
        })
        return
      }
      // Position the new shape relative to existing variant shapes
      // (place each new one 40px below + 40px right of the last).
      const existingVariants = editor
        .getCurrentPageShapes()
        .filter((s) => s.type === "variant") as VariantShape[]
      let x: number
      let y: number
      if (existingVariants.length === 0) {
        const center = editor.getViewportPageBounds().center
        x = center.x - 480
        y = center.y - 300
      } else {
        const last = existingVariants[existingVariants.length - 1]!
        x = last.x + 40
        y = last.y + 40
      }
      editor.createShape<VariantShape>({
        id,
        type: "variant",
        x,
        y,
        props: { w: 960, h: 600, url, label, routePath },
      })
      editor.select(id)
      editor.zoomToSelection({ animation: { duration: 400 } })
    },
    [],
  )

  /** Always creates a new variant shape; no dedupe. Used for "New variant". */
  const addVariantPreview = useCallback(
    (url: string, label: string, routePath: string) => {
      const editor = editorRef.current
      if (!editor) return
      // If one already exists for this routePath, just focus it.
      if (findVariantShape(editor, routePath)) {
        upsertVariantPreview(url, label, routePath)
        return
      }
      upsertVariantPreview(url, label, routePath)
    },
    [upsertVariantPreview],
  )

  const listShapeBriefs = useCallback((): ShapeBrief[] => {
    const editor = editorRef.current
    if (!editor) return []
    const selectedSet = new Set(editor.getSelectedShapeIds())
    return editor.getCurrentPageShapes().map((s) => {
      const bounds = editor.getShapePageBounds(s.id)
      const props = s.props as Record<string, unknown> | undefined
      const textProp = props?.text
      const altProp = props?.alt
      const routePathProp = props?.routePath
      return {
        id: s.id,
        type: s.type,
        x: bounds?.x ?? 0,
        y: bounds?.y ?? 0,
        w: bounds?.w,
        h: bounds?.h,
        text: typeof textProp === "string" ? textProp : undefined,
        imageAlt: typeof altProp === "string" ? altProp : undefined,
        routePath: typeof routePathProp === "string" ? routePathProp : undefined,
        selected: selectedSet.has(s.id),
      }
    })
  }, [])

  const listSelectedBriefs = useCallback(
    () => listShapeBriefs().filter((b) => b.selected),
    [listShapeBriefs],
  )

  const focusShape = useCallback((id: string) => {
    const editor = editorRef.current
    if (!editor) return
    try {
      editor.select(id as TLShapeId)
      editor.zoomToSelection({ animation: { duration: 300 } })
    } catch {}
  }, [])

  const deleteShape = useCallback((id: string) => {
    const editor = editorRef.current
    if (!editor) return
    try {
      editor.deleteShape(id as TLShapeId)
    } catch {}
  }, [])

  const deselectShape = useCallback((id: string) => {
    const editor = editorRef.current
    if (!editor) return
    try {
      const current = editor.getSelectedShapeIds().filter((x) => x !== id)
      editor.setSelectedShapes(current)
    } catch {}
  }, [])

  /** Convert a File to a base64 data URL we can embed directly. */
  const fileToDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }, [])

  useImperativeHandle(
    handleRef,
    () => ({
      upsertVariantPreview,
      addVariantPreview,
      listShapeBriefs,
      listSelectedBriefs,
      focusShape,
      deleteShape,
      deselectShape,
    }),
    [
      upsertVariantPreview,
      addVariantPreview,
      listShapeBriefs,
      listSelectedBriefs,
      focusShape,
      deleteShape,
      deselectShape,
    ],
  )

  return (
    <Tldraw
      inferDarkMode
      shapeUtils={customShapeUtils}
      onMount={(editor) => {
        editorRef.current = editor
        editor.user.updateUserPreferences({ colorScheme: "dark" })

        // Intercept image file drops → create a lightweight ImageShape
        // (instead of tldraw's default "asset" flow). Keeps the canvas's
        // shape model simple and image src serializable to chat context.
        editor.registerExternalContentHandler("files", async ({ files, point }) => {
          const images = files.filter((f) => f.type.startsWith("image/"))
          if (images.length === 0) return
          const basePoint =
            point ?? editor.getViewportPageBounds().center
          let cursor = { x: basePoint.x - 160, y: basePoint.y - 120 }
          for (const file of images) {
            try {
              const dataUrl = await fileToDataUrl(file)
              const img = new Image()
              await new Promise<void>((res, rej) => {
                img.onload = () => res()
                img.onerror = () => rej(new Error("image load"))
                img.src = dataUrl
              })
              const maxSide = 320
              const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
              const w = Math.round(img.width * scale)
              const h = Math.round(img.height * scale)
              editor.createShape<ImageShape>({
                type: "reference-image",
                x: cursor.x,
                y: cursor.y,
                props: { w, h, src: dataUrl, alt: file.name },
              })
              cursor = { x: cursor.x + w + 20, y: cursor.y }
            } catch {
              // Silently skip unreadable files.
            }
          }
        })

        const notify = () => {
          onSelectionChange?.(listSelectedBriefs())
          onShapesChange?.(listShapeBriefs())
        }
        notify()
        // Listen on both session (selection) and document (shape changes).
        const offSession = editor.store.listen(() => notify(), {
          scope: "session",
        })
        const offDoc = editor.store.listen(() => notify(), {
          scope: "document",
        })
        return () => {
          offSession()
          offDoc()
        }
      }}
    />
  )
}
