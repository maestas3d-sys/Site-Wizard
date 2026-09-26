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

type Point = { x: number; y: number }

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distance(p, a)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy })
}

/** A shape's two endpoints double as its drag handles once selected — "start"
 * is (x1,y1), "end" is (x2,y2), for both arrows and circles (whose corners
 * define its bounding box). Existing shapes can be resized by dragging
 * either one, not just redrawn from scratch. */
export type ShapeHandle = 'start' | 'end'

/** Which handle of `shape`, if any, `point` (image space) is within `radius`
 * of — checked before body-drag so a handle always wins over a move. */
export function hitTestHandle(point: Point, shape: PhotoAnnotation, radius: number): ShapeHandle | null {
  if (distance(point, { x: shape.x1, y: shape.y1 }) <= radius) return 'start'
  if (distance(point, { x: shape.x2, y: shape.y2 }) <= radius) return 'end'
  return null
}

/** Whether `point` falls on/inside `shape` closely enough to grab it for a
 * move — a line-distance test for arrows, an interior test (with a little
 * tolerance added to the radii, so the edge is forgiving too) for circles. */
export function hitTestShapeBody(point: Point, shape: PhotoAnnotation, tolerance: number): boolean {
  if (shape.kind === 'arrow') {
    return distanceToSegment(point, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) <= tolerance
  }
  const c = computeCircleGeometry(shape)
  const rx = c.rx + tolerance
  const ry = c.ry + tolerance
  if (rx <= 0 || ry <= 0) return distance(point, { x: c.cx, y: c.cy }) <= tolerance
  const nx = (point.x - c.cx) / rx
  const ny = (point.y - c.cy) / ry
  return nx * nx + ny * ny <= 1
}

export function translateShape(shape: PhotoAnnotation, dx: number, dy: number): PhotoAnnotation {
  return { ...shape, x1: shape.x1 + dx, y1: shape.y1 + dy, x2: shape.x2 + dx, y2: shape.y2 + dy }
}

export function moveHandle(shape: PhotoAnnotation, handle: ShapeHandle, point: Point): PhotoAnnotation {
  return handle === 'start' ? { ...shape, x1: point.x, y1: point.y } : { ...shape, x2: point.x, y2: point.y }
}
