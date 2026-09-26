import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PhotoAnnotation } from '../../types/photo'
import { computeArrowGeometry, computeCircleGeometry, computeMarkupStrokeWidth } from '../../lib/photoMarkup'

interface PhotoAnnotationsOverlayProps {
  /** The photo's own natural pixel size — also the SVG's viewBox, so stroke
   * widths and coordinates scale correctly at any display size. */
  naturalWidth: number
  naturalHeight: number
  annotations: PhotoAnnotation[]
  /** Index into `annotations` of the shape currently selected for editing
   * (markup overlay only) — draws its two endpoints as draggable handles. */
  selectedIndex?: number
  /** Non-interactive by default (thumbnails); pass handlers to make it the
   * live drawing surface (the markup overlay). */
  onPointerDown?: (e: ReactPointerEvent<SVGSVGElement>) => void
  onPointerMove?: (e: ReactPointerEvent<SVGSVGElement>) => void
  onPointerUp?: (e: ReactPointerEvent<SVGSVGElement>) => void
  className?: string
}

/** Renders arrows/circles over a photo as an SVG layer — used both as a
 * read-only "Marked up" hint on thumbnails and, with pointer handlers
 * wired up, as the actual drawing surface in the markup overlay. Kept as
 * one component so the two never draw shapes differently by accident. */
export function PhotoAnnotationsOverlay({
  naturalWidth,
  naturalHeight,
  annotations,
  selectedIndex,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  className,
}: PhotoAnnotationsOverlayProps) {
  const strokeWidth = computeMarkupStrokeWidth(naturalWidth)
  const interactive = !!(onPointerDown || onPointerMove || onPointerUp)
  const selectedShape = selectedIndex !== undefined ? annotations[selectedIndex] : undefined
  const handleRadius = strokeWidth * 2.2

  return (
    <svg
      viewBox={`0 0 ${naturalWidth} ${naturalHeight}`}
      preserveAspectRatio="xMidYMid slice"
      className={`absolute inset-0 h-full w-full ${interactive ? 'touch-none' : 'pointer-events-none'} ${className ?? ''}`}
      style={interactive ? { cursor: 'crosshair' } : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {annotations.map((shape, index) => {
        if (shape.kind === 'circle') {
          const c = computeCircleGeometry(shape)
          return (
            <ellipse
              key={index}
              cx={c.cx}
              cy={c.cy}
              rx={c.rx}
              ry={c.ry}
              fill="none"
              stroke={shape.color}
              strokeWidth={strokeWidth}
            />
          )
        }
        const arrow = computeArrowGeometry(shape, strokeWidth)
        return (
          <g key={index}>
            <line
              x1={shape.x1}
              y1={shape.y1}
              x2={arrow.lineEnd.x}
              y2={arrow.lineEnd.y}
              stroke={shape.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
            <polygon
              points={`${arrow.tip.x},${arrow.tip.y} ${arrow.headBase[0].x},${arrow.headBase[0].y} ${arrow.headBase[1].x},${arrow.headBase[1].y}`}
              fill={shape.color}
            />
          </g>
        )
      })}
      {selectedShape && (
        <>
          <circle
            cx={selectedShape.x1}
            cy={selectedShape.y1}
            r={handleRadius}
            fill="#fff"
            stroke={selectedShape.color}
            strokeWidth={strokeWidth * 0.6}
          />
          <circle
            cx={selectedShape.x2}
            cy={selectedShape.y2}
            r={handleRadius}
            fill="#fff"
            stroke={selectedShape.color}
            strokeWidth={strokeWidth * 0.6}
          />
        </>
      )}
    </svg>
  )
}
