import type PizZip from 'pizzip'
import type { Photo } from '../types/photo'
import { computeArrowGeometry, computeCircleGeometry, computeMarkupStrokeWidth } from './photoMarkup'
import { escapeXml } from './xmlEscape'

/**
 * Splices the photo appendix directly into a *rendered* docx's zip — media
 * files, relationships, and `<w:drawing>` XML — rather than through
 * docxtemplater. A text tag can't add binary media or relationships to the
 * package, and doing this after render means each image can be sized from
 * its own decoded dimensions instead of a fixed size baked into the
 * template (the exact portrait-photo-overflows-the-page problem the brief
 * calls out).
 */

const EMU_PER_PIXEL = 9525 // 914400 EMU/inch ÷ 96 px/inch
const TARGET_WIDTH_PX = 580 // fits the template's ~6.25in usable page width
const MAX_HEIGHT_PX = 700 // leaves room for the caption on one page

function computeDisplaySize(naturalWidth: number, naturalHeight: number): { width: number; height: number } {
  const widthScale = TARGET_WIDTH_PX / naturalWidth
  let width = TARGET_WIDTH_PX
  let height = Math.round(naturalHeight * widthScale)
  if (height > MAX_HEIGHT_PX) {
    const heightScale = MAX_HEIGHT_PX / height
    height = MAX_HEIGHT_PX
    width = Math.round(width * heightScale)
  }
  return { width, height }
}

async function decodeDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob)
  try {
    return { width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

/** Draws a photo's markup (arrows/circles) onto a fresh canvas copy of it,
 * using the exact same geometry math as the live overlay (PhotoAnnotationsOverlay)
 * so what an engineer drew in the field is what shows up in the report —
 * never the original blob, which stays untouched in Dexie regardless of
 * how this report generation goes. Returns the burned-in JPEG plus its
 * (unchanged) natural dimensions, so the caller doesn't need a second
 * decode just to size the drawing. */
async function rasterizeAnnotations(
  photo: Photo,
): Promise<{ arrayBuffer: ArrayBuffer; width: number; height: number }> {
  const bitmap = await createImageBitmap(photo.blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')
    ctx.drawImage(bitmap, 0, 0)

    const strokeWidth = computeMarkupStrokeWidth(bitmap.width)
    ctx.lineCap = 'round'
    for (const shape of photo.annotations ?? []) {
      ctx.strokeStyle = shape.color
      ctx.fillStyle = shape.color
      ctx.lineWidth = strokeWidth
      if (shape.kind === 'circle') {
        const c = computeCircleGeometry(shape)
        ctx.beginPath()
        // A degenerate (near-zero) radius is a valid ellipse arg but draws
        // nothing useful — floor it slightly so a tiny circle still shows.
        ctx.ellipse(c.cx, c.cy, Math.max(c.rx, 0.5), Math.max(c.ry, 0.5), 0, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        const arrow = computeArrowGeometry(shape, strokeWidth)
        ctx.beginPath()
        ctx.moveTo(shape.x1, shape.y1)
        ctx.lineTo(arrow.lineEnd.x, arrow.lineEnd.y)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(arrow.tip.x, arrow.tip.y)
        ctx.lineTo(arrow.headBase[0].x, arrow.headBase[0].y)
        ctx.lineTo(arrow.headBase[1].x, arrow.headBase[1].y)
        ctx.closePath()
        ctx.fill()
      }
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
        'image/jpeg',
        0.9,
      )
    })
    return { arrayBuffer: await blob.arrayBuffer(), width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

function buildDrawingXml(relId: string, docPrId: number, widthPx: number, heightPx: number): string {
  const cx = widthPx * EMU_PER_PIXEL
  const cy = heightPx * EMU_PER_PIXEL
  return (
    '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    '<wp:effectExtent l="0" t="0" r="0" b="0"/>' +
    `<wp:docPr id="${docPrId}" name="Picture ${docPrId}"/>` +
    '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    `<pic:nvPicPr><pic:cNvPr id="0" name="Picture ${docPrId}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  )
}

/** Mutates `zip` in place, appending one page per photo after the letter body. */
export async function injectPhotos(zip: PizZip, photos: Photo[]): Promise<void> {
  if (photos.length === 0) return

  const relsPath = 'word/_rels/document.xml.rels'
  const relsFile = zip.file(relsPath)
  if (!relsFile) throw new Error(`${relsPath} missing from template`)
  let relsXml = relsFile.asText()

  const paragraphs: string[] = []
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    const hasMarkup = (photo.annotations?.length ?? 0) > 0
    const { arrayBuffer, width: naturalWidth, height: naturalHeight } = hasMarkup
      ? await rasterizeAnnotations(photo)
      : await (async () => {
          const [buf, dims] = await Promise.all([photo.blob.arrayBuffer(), decodeDimensions(photo.blob)])
          return { arrayBuffer: buf, width: dims.width, height: dims.height }
        })()
    const { width, height } = computeDisplaySize(naturalWidth, naturalHeight)

    const relId = `rIdReportPhoto${i + 1}`
    const mediaName = `reportPhoto${i + 1}.jpeg`
    zip.file(`word/media/${mediaName}`, arrayBuffer)
    relsXml = relsXml.replace(
      '</Relationships>',
      `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`,
    )

    const caption = photo.caption.trim()
    const label = `Photo #${i + 1}${caption ? `: ${escapeXml(caption)}` : ''}`
    const pageBreak = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
    // Three blank body-text-sized lines so the caption doesn't sit tight
    // against the top margin on a fresh page.
    const topSpacer =
      '<w:p><w:pPr><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:sz w:val="22"/></w:rPr></w:pPr></w:p>'.repeat(
        3,
      )
    const captionPara =
      '<w:p><w:pPr><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:sz w:val="22"/></w:rPr></w:pPr>' +
      `<w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">${label}</w:t></w:r></w:p>`
    // docPr ids should be unique document-wide; 1000+ keeps clear of the
    // header logo's own (small, sequential) id.
    const imagePara = `<w:p>${buildDrawingXml(relId, 1000 + i, width, height)}</w:p>`

    paragraphs.push(pageBreak, topSpacer, captionPara, imagePara)
  }

  zip.file(relsPath, relsXml)

  const documentFile = zip.file('word/document.xml')
  if (!documentFile) throw new Error('word/document.xml missing from template')
  const documentXml = documentFile.asText()
  // The document's final <w:sectPr> is a direct child of <w:body>, after
  // every <w:p> — new paragraphs belong immediately *before* its opening
  // tag. (Earlier <w:sectPr> elements exist too, each embedded inside a
  // paragraph's <w:pPr> to mark a mid-document section break, but this is
  // the last one in the file, so lastIndexOf finds the right one.)
  const insertAt = documentXml.lastIndexOf('<w:sectPr')
  if (insertAt === -1) {
    throw new Error('Could not find the document section properties to insert the photo appendix before')
  }
  const patchedXml =
    documentXml.slice(0, insertAt) + paragraphs.join('') + documentXml.slice(insertAt)
  zip.file('word/document.xml', patchedXml)
}
