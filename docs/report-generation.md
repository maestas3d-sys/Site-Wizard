# Report generation

How a Visit becomes a `.docx` field report, entirely client-side, against the real W+R template.

## Two phases

**Template preparation** (one-time, done by a human, not part of the app or its build):
`docs/templates/field-report-template.docx` (the firm's real template, unmodified) is turned into
`public/templates/field-report-template.docx` (the tagged template the app actually renders
against) by `scripts/prepare-report-template.mjs`. Re-run this only if W+R sends an updated
source template — see the script's header comment for the exact steps, which start with the
docx skill's run-merger (Word fragments paragraph text across many `<w:r>` elements, which makes
the script's exact-string matches unreliable against a fresh, unmerged export).

**Report generation** (runtime, `src/lib/reportGeneration.ts`): given a `visitId` and a closing-
statement choice, gathers the Project/Visit/Items/Photos from Dexie, fetches the tagged template,
fills it with `docxtemplater`, splices in the photo appendix, and returns a `Blob` + filename for
`downloadBlob.ts` to save.

## Why raw-XML blocks instead of docxtemplater loops

The PRESENT: (attendees) and item-list blocks are built as hand-written OOXML strings
(`reportTemplateBlocks.ts`) and inserted via docxtemplater's `{@tag}` (unescaped raw-XML
insertion), not `{#tag}...{/tag}` loops. A docxtemplater paragraph-loop repeats *every* paragraph
in its body once per array element — fine for a uniform list, wrong here: only the *first*
attendee shares a line with the "PRESENT:" label, and each item needs a "N.) " prefix plus a
blank spacer paragraph between entries, none of which a straight repeat produces. Building the
paragraphs directly, matching the source template's original formatting byte-for-byte, sidesteps
the mismatch entirely — verified empirically (a standalone render test) before it went anywhere
near the real template.

Anything inserted this way is user-typed text landing in a hand-built XML string, so it's always
passed through `xmlEscape.ts` first — an attendee name or item body containing `&` or `<` would
otherwise corrupt the document.

`generalState` (an optional prose paragraph) uses a real docxtemplater conditional instead:
`{#generalState}...{/generalState}` around the lead-in + value. Since `generalState` is a plain
string, not an array, docxtemplater's section syntax degrades to "show once if truthy, omit if
falsy" — exactly an if-block, no loop involved.

## Why no image module

`docxtemplater-image-module-free` pulls in an old `xmldom` with a critical-severity,
no-fix-available XML vulnerability. Since the template needed hand-editing for the raw-XML blocks
above anyway, photos are handled the same way but one step later: `reportImages.ts` runs *after*
docxtemplater has rendered the text, and directly manipulates the resulting zip —

1. decodes each photo's natural dimensions (`createImageBitmap`) and computes a display size that
   fits the page (max 580px wide, max 700px tall — the tall-photo cap is what prevents a portrait
   phone photo from overflowing the page, which the brief specifically calls out as a risk),
2. adds the photo as `word/media/reportPhotoN.jpeg` and a matching relationship,
3. builds the `<w:drawing>` XML by hand and splices a page-break + caption + image paragraph
   sequence in — right before the document's final `<w:sectPr>` (which must stay the very last
   thing in `<w:body>`; the first working version inserted before `</w:sectPr>` instead of
   `<w:sectPr`, landing new paragraphs *inside* the section properties element and failing XSD
   validation — caught by that validation, not by eyeballing the output).

Only photos flagged `includeInReport` are used, ordered by the item they belong to (in report
order) and then by position within that item.

## House style

`houseStyle.ts` applies "two spaces after every period" to composed prose (item body text, the
opening sentence, general state, next observation) at generation time only — never to what's
stored, so the editor always shows normal single-space text. The regex only matches a period
followed by a space or tab, never a newline, so paragraph breaks survive, and a decimal like
`0.020` is never touched (there's no space after that period to match).

## Closing statement

The brief's two boilerplate variants ("conforms" vs. "conforms, although still a
work-in-progress") aren't derived from any stored field — there's no clean signal for "is this
visit's construction complete" in the data model — so the choice is made fresh at generation time
on the Visit Detail screen, defaulting to "work in progress" since that's the common case for an
active field visit.

## Verification

Every check in this doc was run against the actual generated output, not just reasoned about:
XSD schema validation (`docx` skill's `validate.py`), an independent `python-docx` open-and-read
pass, and a full headless-browser pass through the real UI (project → visit → items with a photo
→ generate → download), with the resulting file's text and image dimensions asserted against
what the input data should produce. LibreOffice's own docx import is broken in this sandbox
(fails on any file), so there's no rendered-PDF screenshot of a generated report — the structural
and content verification above is the substitute.
