#!/usr/bin/env node
/**
 * Turns the firm's real field-report .docx into the tagged template the app
 * fills at generation time (public/templates/field-report-template.docx).
 * This is a one-time authoring step, not part of the app or its build — run
 * it again only if W+R sends an updated source template.
 *
 * Prerequisite: Word fragments paragraph text across many <w:r> elements
 * (revision ids, spell-check markers), which makes the exact-string matches
 * below unreliable against a fresh export. Run the docx skill's run-merger
 * on the source file first:
 *
 *   unzip docs/templates/field-report-template.docx -d /tmp/merge-work
 *   python3 <docx-skill>/scripts/merge_runs.py /tmp/merge-work
 *   cd /tmp/merge-work && zip -Xrq /tmp/merged-template.docx . && cd -
 *   node scripts/prepare-report-template.mjs /tmp/merged-template.docx
 *
 * What this does NOT handle: photos. The photo appendix (page break +
 * caption + image per photo) is assembled entirely at report-generation
 * time in src/lib/reportGeneration.ts, by splicing raw OOXML + media files
 * + relationships into the *rendered* docx — docxtemplater never sees a
 * photo tag, because inserting binary media isn't something a text tag can
 * do, and it lets generation-time code size each image correctly instead of
 * baking a fixed size into the template.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import PizZip from 'pizzip'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('Usage: node scripts/prepare-report-template.mjs <merged-source.docx>')
  process.exit(1)
}
const outputPath = resolve(repoRoot, 'public/templates/field-report-template.docx')

const zip = new PizZip(readFileSync(inputPath))
let xml = zip.file('word/document.xml').asText()

/** Replaces `search` with `replace`, throwing unless it occurs exactly once. */
function replaceOnce(source, search, replace) {
  const count = source.split(search).length - 1
  if (count !== 1) {
    throw new Error(`Expected exactly 1 occurrence, found ${count}:\n${search.slice(0, 120)}`)
  }
  return source.replace(search, replace)
}

function deleteOnce(source, search) {
  return replaceOnce(source, search, '')
}

// --- Title: "F I E L D   R E P O R T   #1" -> "...#{reportNumber}" ---
xml = replaceOnce(
  xml,
  'F I E L D   R E P O R T   #1',
  'F I E L D   R E P O R T   #{reportNumber}',
)

// --- TO: / ATTN: block ---
xml = replaceOnce(xml, '<w:t>Architect</w:t>', '<w:t>{clientFirm}</w:t>')
// Project has no separate street-address field; clientCity fills this line
// ("Solana Beach, CA"), matching the brief's own placeholder set.
xml = replaceOnce(xml, '<w:t>Address</w:t>', '<w:t>{clientCity}</w:t>')
xml = replaceOnce(
  xml,
  '<w:t xml:space="preserve"> Name</w:t>',
  '<w:t xml:space="preserve"> {clientAttn}</w:t>',
)

// --- DATE: / PROJECT: / LOCATION: / W+R JOB #: ---
xml = replaceOnce(xml, '<w:t>June 4, 2024</w:t>', '<w:t>{reportDate}</w:t>')
xml = replaceOnce(xml, '<w:t>Project</w:t>', '<w:t>{projectName}</w:t>')
xml = replaceOnce(xml, '<w:t>San Diego, CA</w:t>', '<w:t>{location}</w:t>')
xml = replaceOnce(xml, '<w:t>21-065</w:t>', '<w:t>{jobNumber}</w:t>')

// --- PRESENT: block ---
// The template ships 3 example attendee lines as 3 separate static
// paragraphs. Rather than lean on docxtemplater's paragraph-loop semantics
// (which repeats *every* paragraph in the loop body per item — awkward
// here, since only the first line carries the "PRESENT:" label), the whole
// block becomes one raw-XML anchor. Generation-time code builds the exact
// paragraphs itself (first line styled like the original first line, each
// subsequent attendee styled like the original continuation lines) and
// injects them via docxtemplater's `{@tag}` raw-XML insertion.
xml = replaceOnce(
  xml,
  '<w:p w14:paraId="0B3B4ED8" w14:textId="524AC230" w:rsidR="00FA124C" w:rsidRDefault="00142561" w:rsidP="00907295"><w:pPr><w:widowControl w:val="0"/><w:tabs><w:tab w:val="left" w:pos="1620"/><w:tab w:val="left" w:pos="3960"/><w:tab w:val="left" w:pos="6210"/></w:tabs><w:ind w:left="1800" w:hanging="1800"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr><w:t>PRESENT:</w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr><w:tab/><w:t>Name, W+R</w:t></w:r></w:p>',
  '<w:p w14:paraId="0B3B4ED8" w14:textId="524AC230" w:rsidR="00FA124C" w:rsidRDefault="00142561" w:rsidP="00907295"><w:pPr><w:widowControl w:val="0"/><w:tabs><w:tab w:val="left" w:pos="1620"/><w:tab w:val="left" w:pos="3960"/><w:tab w:val="left" w:pos="6210"/></w:tabs><w:ind w:left="1800" w:hanging="1800"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr><w:t>{@presentBlock}</w:t></w:r></w:p>',
)
xml = deleteOnce(
  xml,
  '<w:p w14:paraId="1BDEF1BD" w14:textId="23F2C32A" w:rsidR="003323A3" w:rsidRDefault="003323A3" w:rsidP="00907295"><w:pPr><w:widowControl w:val="0"/><w:tabs><w:tab w:val="left" w:pos="1620"/><w:tab w:val="left" w:pos="3960"/><w:tab w:val="left" w:pos="6210"/></w:tabs><w:ind w:left="1800" w:hanging="1800"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:bCs/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:bCs/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr><w:t>Name, IOR</w:t></w:r></w:p>',
)
xml = deleteOnce(
  xml,
  '<w:p w14:paraId="3817C9CC" w14:textId="0DE0DD28" w:rsidR="003323A3" w:rsidRPr="003323A3" w:rsidRDefault="003323A3" w:rsidP="00907295"><w:pPr><w:widowControl w:val="0"/><w:tabs><w:tab w:val="left" w:pos="1620"/><w:tab w:val="left" w:pos="3960"/><w:tab w:val="left" w:pos="6210"/></w:tabs><w:ind w:left="1800" w:hanging="1800"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:bCs/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:bCs/><w:snapToGrid w:val="0"/><w:sz w:val="24"/></w:rPr><w:tab/><w:t xml:space="preserve">Name, Contractor</w:t></w:r></w:p>',
)

// --- Opening paragraph: date + purpose, composed as one sentence in JS ---
xml = replaceOnce(
  xml,
  '<w:t>Date and purpose of observation.</w:t>',
  '<w:t>{openingStatement}</w:t>',
)

// --- General state (optional): wrap the lead-in + value as an if-block.
// generalState is a plain string, so {#generalState} is docxtemplater's
// boolean-section form (show once if truthy, omit if empty) — not a loop. ---
xml = replaceOnce(
  xml,
  '<w:t xml:space="preserve">At the time of the observation, construction progress was as follows: </w:t>',
  '<w:t xml:space="preserve">{#generalState}At the time of the observation, construction progress was as follows: </w:t>',
)
// First "Construction Progress" line becomes the value; its numPr (a
// bulleted-list numbering the source template applied here) is dropped —
// generalState is one prose paragraph, not a list.
xml = replaceOnce(
  xml,
  '<w:p w14:paraId="1755B9BF" w14:textId="4CAC6E0B" w:rsidR="00437B39" w:rsidRDefault="0037138A" w:rsidP="00437B39"><w:pPr><w:widowControl w:val="0"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="22"/></w:numPr><w:tabs><w:tab w:val="left" w:pos="700"/><w:tab w:val="left" w:pos="3960"/><w:tab w:val="left" w:pos="5490"/></w:tabs><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>Construction Progress</w:t></w:r></w:p>',
  '<w:p w14:paraId="1755B9BF" w14:textId="4CAC6E0B" w:rsidR="00437B39" w:rsidRDefault="0037138A" w:rsidP="00437B39"><w:pPr><w:widowControl w:val="0"/><w:tabs><w:tab w:val="left" w:pos="700"/><w:tab w:val="left" w:pos="3960"/><w:tab w:val="left" w:pos="5490"/></w:tabs><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>{generalState}{/generalState}</w:t></w:r></w:p>',
)
// Second "Construction Progress" example line — not needed, delete.
xml = deleteOnce(
  xml,
  '<w:p w14:paraId="6623354B" w14:textId="1A621CE4" w:rsidR="005C4936" w:rsidRPr="00F86437" w:rsidRDefault="0037138A" w:rsidP="00437B39"><w:pPr><w:widowControl w:val="0"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="22"/></w:numPr><w:tabs><w:tab w:val="left" w:pos="700"/><w:tab w:val="left" w:pos="3960"/><w:tab w:val="left" w:pos="5490"/></w:tabs><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>Construction Progress</w:t></w:r></w:p>',
)

// --- Items block: "During the visit..." lead-in stays static/unconditional
// (a report with zero items is a rare edge case; itemsBlock handles it
// gracefully). The 3 example items + their spacer paragraphs are replaced
// by one raw-XML anchor — generation-time code builds "{n}.) {bodyText}"
// per item, matching this block's exact spacer rhythm. ---
xml = replaceOnce(
  xml,
  '<w:p w14:paraId="1D3D532D" w14:textId="77777777" w:rsidR="00437B39" w:rsidRPr="008E0165" w:rsidRDefault="00437B39" w:rsidP="00437B39"><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr></w:p><w:p w14:paraId="506F2BE6" w14:textId="01278BB3" w:rsidR="007E51B0" w:rsidRPr="0052394B" w:rsidRDefault="007E51B0" w:rsidP="007E51B0"><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>-Item 1</w:t></w:r></w:p><w:p w14:paraId="53F3F4D0" w14:textId="77777777" w:rsidR="007E51B0" w:rsidRDefault="007E51B0" w:rsidP="007E51B0"><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr></w:p><w:p w14:paraId="5103BCBB" w14:textId="54577173" w:rsidR="007E51B0" w:rsidRDefault="007E51B0" w:rsidP="007E51B0"><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>-Item 2</w:t></w:r></w:p><w:p w14:paraId="1E6818AD" w14:textId="77777777" w:rsidR="007E51B0" w:rsidRDefault="007E51B0" w:rsidP="007E51B0"><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr></w:p><w:p w14:paraId="54B620F0" w14:textId="7E58ACB1" w:rsidR="007E51B0" w:rsidRDefault="007E51B0" w:rsidP="007E51B0"><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>-Item 3</w:t></w:r></w:p><w:p w14:paraId="7E9D4F3B" w14:textId="77777777" w:rsidR="00437B39" w:rsidRDefault="00437B39" w:rsidP="00437B39"><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr></w:p>',
  '<w:p><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>{@itemsBlock}</w:t></w:r></w:p>',
)

// --- Closing boilerplate ---
xml = replaceOnce(
  xml,
  '<w:t>Generally, the work observed appeared to conform to the construction documents, except as noted above.</w:t>',
  '<w:t>{closingStatement}</w:t>',
)

// --- Signature block ---
xml = replaceOnce(xml, '<w:t>Name</w:t>', '<w:t>{engineerName}, {engineerCredential}</w:t>')
xml = replaceOnce(xml, '<w:t>Title</w:t>', '<w:t>{engineerTitle}</w:t>')

// --- Next Observation: append the value in a second, non-bold run ---
xml = replaceOnce(
  xml,
  '<w:p w14:paraId="151C4FF6" w14:textId="34069139" w:rsidR="0037138A" w:rsidRPr="0037138A" w:rsidRDefault="0037138A" w:rsidP="003109D3"><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:bCs/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:bCs/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>Next Observation:</w:t></w:r></w:p>',
  '<w:p w14:paraId="151C4FF6" w14:textId="34069139" w:rsidR="0037138A" w:rsidRPr="0037138A" w:rsidRDefault="0037138A" w:rsidP="003109D3"><w:pPr><w:widowControl w:val="0"/><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:bCs/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:b/><w:bCs/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">Next Observation: </w:t></w:r><w:r><w:rPr><w:rFonts w:ascii="Futura Bk BT" w:hAnsi="Futura Bk BT"/><w:snapToGrid w:val="0"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>{nextObservation}</w:t></w:r></w:p>',
)

zip.file('word/document.xml', xml)

// Photos are re-encoded as JPEG at capture time; the template only ships a
// PNG default. Register jpeg now so generation-time code can add media
// files without also having to patch content types.
const contentTypesPath = '[Content_Types].xml'
let contentTypes = zip.file(contentTypesPath).asText()
if (!contentTypes.includes('Extension="jpeg"')) {
  contentTypes = contentTypes.replace(
    '<Default Extension="png" ContentType="image/png"/>',
    '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>',
  )
  zip.file(contentTypesPath, contentTypes)
}

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }))
console.log(`Wrote ${outputPath}`)
