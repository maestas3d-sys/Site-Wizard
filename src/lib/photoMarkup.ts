import type { PhotoAnnotation } from '../types/photo'

/** Palette offered in the markup tool tray (design handoff, screen 7). */
export const MARKUP_COLORS: { name: string; hex: string }[] = [
  { name: 'Red', hex: '#A13D33' },
  { name: 'Ochre', hex: '#D9A441' },
  { name: 'White', hex: '#FFFFFF' },
]

export const MARKUP_DEFAULT_COLOR = MARKUP_COLORS[0].hex

/** A drag shorter than this is a tap, not a shape — discarded on release. */
export const MARKUP_MIN_DRAG_PX = 10

/** Stroke width scales with the photo's own natural pixel width (not its
 * on-screen display size), so annotations drawn on a small preview still
 * look right full-size in the report — "about 1.4% of the image width"
 * (design handoff). Since annotation coordinates and this width are both
 * in the same natural-pixel space, an SVG using that space as its viewBox
 * scales the stroke correctly at any display size for free; the canvas
 * rasterizer (reportImages.ts) uses the same number directly in pixels. */
export function computeMarkupStrokeWidth(naturalWidth: number): number {
  return naturalWidth * 0.014
}

interface ArrowGeometry {
  /** Line runs from the shape's start point to just short of the tip, so
   * the arrowhead triangle doesn't get drawn on top of a doubled-up stroke. */
  lineEnd: { x: number; y: number }
  tip: { x: number; y: number }
  /** The other two corners of the arrowhead triangle (the tip is the third). */
  headBase: [{ x: number; y: number }, { x: number; y: number }]
}

/** Round-capped line + a filled triangle head, matching the prototype's
 * math exactly: head length is 4.5x the stroke width, the two base corners
 * sit ±0.45 radians off the line's own angle. */
export function computeArrowGeometry(shape: PhotoAnnotation, strokeWidth: number): ArrowGeometry {
  const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1)
  const headLength = strokeWidth * 4.5
  const headPoint = (deltaAngle: number) => ({
    x: shape.x2 - headLength * Math.cos(angle + deltaAngle),
    y: shape.y2 - headLength * Math.sin(angle + deltaAngle),
  })
  return {
    lineEnd: {
      x: shape.x2 - Math.cos(angle) * headLength * 0.6,
      y: shape.y2 - Math.sin(angle) * headLength * 0.6,
    },
    tip: { x: shape.x2, y: shape.y2 },
    headBase: [headPoint(0.45), headPoint(-0.45)],
  }
}

interface CircleGeometry {
  cx: number
  cy: number
  rx: number
  ry: number
}

export function computeCircleGeometry(shape: PhotoAnnotation): CircleGeometry {
  return {
    cx: (shape.x1 + shape.x2) / 2,
    cy: (shape.y1 + shape.y2) / 2,
    rx: Math.abs(shape.x2 - shape.x1) / 2,
    ry: Math.abs(shape.y2 - shape.y1) / 2,
  }
}
