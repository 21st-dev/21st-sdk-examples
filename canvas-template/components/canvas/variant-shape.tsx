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
 * VariantShape — a tldraw shape that embeds an iframe pointing at the
 * agent's sandbox dev-server. The chrome around the iframe mirrors the
 * 21st canvas variant design: rounded card with traffic-light dots in the
 * header + route label, and a subtle border that activates on selection.
 */
export type VariantShape = TLBaseShape<
  "variant",
  {
    w: number
    h: number
    url: string | null
    label: string
    routePath: string
  }
>

export class VariantShapeUtil extends BaseBoxShapeUtil<VariantShape> {
  static override type = "variant" as const

  static override props: RecordProps<VariantShape> = {
    w: T.number,
    h: T.number,
    url: T.string.nullable(),
    label: T.string,
    routePath: T.string,
  }

  override canResize = () => true
  override canEdit = () => false
  override isAspectRatioLocked = () => false

  override getDefaultProps(): VariantShape["props"] {
    return { w: 960, h: 600, url: null, label: "Preview", routePath: "/" }
  }

  override getGeometry(shape: VariantShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override component(shape: VariantShape) {
    const { url, label, w, h } = shape.props
    const isSelected = this.editor.getSelectedShapeIds().includes(shape.id)

    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: w,
          height: h,
          position: "relative",
          background: "hsl(var(--background))",
          border: `1px solid ${
            isSelected
              ? "hsl(var(--primary))"
              : "hsl(var(--border))"
          }`,
          borderRadius: 10,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: isSelected
            ? "0 0 0 1px hsl(var(--primary) / 0.35), 0 8px 24px -8px hsl(0 0% 0% / 0.4)"
            : "0 6px 20px -8px hsl(0 0% 0% / 0.35)",
          pointerEvents: "all",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <div
          style={{
            flex: "0 0 34px",
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            gap: 10,
            borderBottom: "1px solid hsl(var(--border))",
            fontSize: 11,
            color: "hsl(var(--muted-foreground))",
            background: "hsl(var(--muted) / 0.5)",
            userSelect: "none",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
          <div style={{ display: "flex", gap: 5 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: url ? "#ff5f57" : "hsl(var(--border))",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: url ? "#febc2e" : "hsl(var(--border))",
              }}
            />
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: url ? "#28c840" : "hsl(var(--border))",
              }}
            />
          </div>
          <span
            style={{
              flex: 1,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
          <span style={{ width: 30 }} />
        </div>
        <div style={{ flex: 1, position: "relative" }}>
          {url ? (
            <iframe
              src={url}
              style={{
                width: "100%",
                height: "100%",
                border: 0,
                pointerEvents: "none",
                background: "hsl(var(--background))",
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title={label}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "hsl(var(--muted-foreground))",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  border: "2px solid hsl(var(--border))",
                  borderTopColor: "hsl(var(--muted-foreground))",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span>Waiting for dev server…</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      </HTMLContainer>
    )
  }

  override indicator(shape: VariantShape) {
    return <rect width={shape.props.w} height={shape.props.h} rx={10} />
  }
}
