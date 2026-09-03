import type PizZip from 'pizzip'
import type { Photo } from '../types/photo'
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
    const [arrayBuffer, dims] = await Promise.all([
      photo.blob.arrayBuffer(),
      decodeDimensions(photo.blob),
    ])
    const { width, height } = computeDisplaySize(dims.width, dims.height)

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
