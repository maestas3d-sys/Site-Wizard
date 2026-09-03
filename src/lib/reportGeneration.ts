import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import { db } from '../db/db'
import { listItemsByVisit } from '../db/items'
import type { Item } from '../types/item'
import type { Photo } from '../types/photo'
import type { Project } from '../types/project'
import type { Visit } from '../types/visit'
import { applyTwoSpaceRule } from './houseStyle'
import { injectPhotos } from './reportImages'
import { formatReportDate, formatVisitDateLong } from './reportDates'
import { buildGeneralStateBlockXml, buildItemsBlockXml, buildPresentBlockXml } from './reportTemplateBlocks'

// import.meta.env.BASE_URL is Vite's configured `base`, always ending in
// "/" — a hardcoded leading "/" here would 404 under GitHub Pages, which
// serves this app from a /Site-Wizard/ subpath rather than the root.
const TEMPLATE_URL = `${import.meta.env.BASE_URL}templates/field-report-template.docx`

export type ClosingVariant = 'conforms' | 'work-in-progress'

const CLOSING_STATEMENTS: Record<ClosingVariant, string> = {
  conforms:
    'Generally, the work observed appeared to conform to the construction documents, except as noted above.',
  'work-in-progress':
    'Generally, the work observed appeared to conform to the construction documents, although it was still a work-in-progress.',
}

function buildOpeningStatement(visit: Visit): string {
  const purpose = visit.purpose.trim().replace(/\.+$/, '')
  const sentence = `On ${formatVisitDateLong(visit.visitDate)}, the undersigned visited the site to ${purpose}.`
  return applyTwoSpaceRule(sentence)
}

function buildFilename(project: Project, visit: Visit): string {
  const safeName = project.name.replace(/[\\/:*?"<>|]+/g, ' ').trim()
  const safeJob = project.jobNumber.replace(/[\\/:*?"<>|]+/g, ' ').trim()
  const base = [safeJob, `Field Report ${visit.reportNumber}`, safeName].filter(Boolean).join(' - ')
  return `${base || `Field Report ${visit.reportNumber}`}.docx`
}

/** Photos in report order: grouped by the item they belong to (in item
 * order), then by their position within that item. Only photos flagged
 * includeInReport are considered. */
function orderPhotosForReport(items: Item[], photos: Photo[]): Photo[] {
  const itemOrder = new Map(items.map((item, index) => [item.id, index]))
  return photos
    .filter((p) => p.includeInReport)
    .slice()
    .sort((a, b) => {
      const aOrder = a.itemId !== undefined ? (itemOrder.get(a.itemId) ?? Infinity) : Infinity
      const bOrder = b.itemId !== undefined ? (itemOrder.get(b.itemId) ?? Infinity) : Infinity
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.orderIndex - b.orderIndex
    })
}

/** Maps each item to the 1-indexed appendix numbers of its own photos, in
 * the same order injectPhotos labels them ("Photo #1", "Photo #2", …) —
 * `orderedPhotos` must already be in report order (orderPhotosForReport's
 * output), which is what keeps each item's numbers contiguous. */
function buildPhotoNumbersByItem(orderedPhotos: Photo[]): Map<string, number[]> {
  const map = new Map<string, number[]>()
  orderedPhotos.forEach((photo, index) => {
    if (photo.itemId === undefined) return
    const numbers = map.get(photo.itemId)
    if (numbers) numbers.push(index + 1)
    else map.set(photo.itemId, [index + 1])
  })
  return map
}

export interface GeneratedReport {
  blob: Blob
  filename: string
}

export interface GenerateReportOptions {
  visitId: string
  closingVariant: ClosingVariant
}

export async function generateReport({ visitId, closingVariant }: GenerateReportOptions): Promise<GeneratedReport> {
  const visit = await db.visits.get(visitId)
  if (!visit) throw new Error('Visit not found')
  const project = await db.projects.get(visit.projectId)
  if (!project) throw new Error('Project not found')

  const items = await listItemsByVisit(visitId)
  const allPhotos = await db.photos.where('visitId').equals(visitId).sortBy('orderIndex')
  const photos = orderPhotosForReport(items, allPhotos)
  const photoNumbersByItem = buildPhotoNumbersByItem(photos)

  const templateResponse = await fetch(TEMPLATE_URL)
  if (!templateResponse.ok) {
    throw new Error(`Could not load the report template (${templateResponse.status})`)
  }
  const templateBuffer = await templateResponse.arrayBuffer()

  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })

  doc.render({
    reportNumber: visit.reportNumber,
    clientFirm: project.clientFirm,
    clientCity: project.clientCity,
    clientAttn: project.clientAttn,
    reportDate: formatReportDate(visit.reportDate),
    projectName: project.name,
    location: project.location,
    jobNumber: project.jobNumber,
    presentBlock: buildPresentBlockXml(visit.attendees),
    openingStatement: buildOpeningStatement(visit),
    generalStateBlock: buildGeneralStateBlockXml(visit.generalState),
    itemsBlock: buildItemsBlockXml(items, photoNumbersByItem),
    closingStatement: CLOSING_STATEMENTS[closingVariant],
    engineerName: visit.engineerName,
    engineerCredential: visit.engineerCredential,
    engineerTitle: visit.engineerTitle,
    nextObservation: applyTwoSpaceRule(visit.nextObservation.trim()),
  })

  const renderedZip = doc.getZip()
  await injectPhotos(renderedZip, photos)

  const blob = renderedZip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  return { blob, filename: buildFilename(project, visit) }
}
