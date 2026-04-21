"use client"

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  Rectangle2d,
  T,
  type RecordProps,
  type TLBaseShape,
} from "tldraw"

/**
 * ImageShape — a lightweight reference image shape. When the user drops an
 * image on the canvas, we store its data-URL here so it can be serialized
 * into the chat body as visual context for the agent.
 */
export type ImageShape = TLBaseShape<
  "reference-image",
  {
    w: number
    h: number
    src: string
    alt: string
  }
>

export class ImageShapeUtil extends BaseBoxShapeUtil<ImageShape> {
  static override type = "reference-image" as const

  static override props: RecordProps<ImageShape> = {
    w: T.number,
    h: T.number,
    src: T.string,
    alt: T.string,
  }

  override canResize = () => true
  override isAspectRatioLocked = () => true

  override getDefaultProps(): ImageShape["props"] {
    return { w: 320, h: 240, src: "", alt: "" }
  }

  override getGeometry(shape: ImageShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override component(shape: ImageShape) {
    const { src, alt, w, h } = shape.props
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          borderRadius: 8,
          overflow: "hidden",
          background: "#09090b",
          border: "1px solid #262626",
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              color: "#525252",
            }}
          >
            (empty image)
          </div>
        )}
      </HTMLContainer>
    )
  }

  override indicator(shape: ImageShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={8} />
  }
}
