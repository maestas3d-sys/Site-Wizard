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

The PRESENT: (attendees), general-state, and item-list blocks are all built as hand-written OOXML
strings (`reportTemplateBlocks.ts`) and inserted via docxtemplater's `{@tag}` (unescaped raw-XML
insertion), not `{#tag}...{/tag}` loops. A docxtemplater paragraph-loop repeats *every* paragraph
in its body once per array element (or once if truthy / zero times if falsy, for a boolean
section) — fine for a uniform, always-present block, wrong here in two different ways:

- Only the *first* attendee shares a line with the "PRESENT:" label, and each item needs a blank
  spacer paragraph between entries — a straight repeat can't produce either.
- `generalState`'s `{#generalState}...{/generalState}` boolean section was tried first (the
  optional field seemed like a natural fit for docxtemplater's built-in if-block), on the
  assumption that a falsy value omits the section's paragraphs entirely. It doesn't: docxtemplater
  only blanks the runs inside, leaving the paragraphs themselves behind — and the template placed
  an *unconditional* blank line just before that section regardless. Together, leaving the field
  empty (the common case) left 2 blank lines above "During the visit..." instead of the single
  spacer every other optional section in this report uses.

Building the paragraphs directly, matching the source template's original formatting byte-for-byte,
sidesteps both problems: an empty `generalState` now renders nothing at all. Verified empirically
(a standalone render test, and for `generalState` specifically, generating with the field both
empty and filled) before any of it went near the real template.

Anything inserted this way is user-typed text landing in a hand-built XML string, so it's always
passed through `xmlEscape.ts` first — an attendee name or item body containing `&` or `<` would
otherwise corrupt the document.

Item numbering ("1.)", "2.)", …) is a real Word numbered list, not literal "N.) " text: each item
paragraph carries `<w:numPr><w:numId w:val="100"/></w:numPr>`, pointing at a custom list format
(`%1.)`, matching house style) that `scripts/prepare-report-template.mjs` adds to
`word/numbering.xml` when the template is prepared. Word — not this code — renders the number at
display time, so adding or deleting an item paragraph by hand in Word afterward renumbers the rest
automatically, the way a real numbered list should.

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
