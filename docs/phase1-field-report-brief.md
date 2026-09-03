# W+R Field Report Tool — Phase 1 Build Brief

**Scope:** Type A field observation reports only. Offline-first PWA. No backend required.
**Deliverable:** An engineer captures items on site and generates a formatted W+R `.docx` field report.

---

## 1. Goal and Boundaries

**In scope**
- Create a project and a numbered visit
- Capture numbered items with grid reference, item type, directive text, detail references, photos
- Optional hold-to-record voice memo per item, stored and playable
- Review and edit items back at the office
- Generate a `.docx` field report matching the W+R template
- Everything works with no network connection

**Out of scope for Phase 1**
- AI drafting of any kind
- Cross-report carry-forward of open items
- Photo annotation
- Assessment report types
- Server, accounts, multi-device sync

**Optional add-on (build only after the core works):** voice transcription via a single serverless endpoint. See §7.

---

## 2. Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- `vite-plugin-pwa` (Workbox) — installable, offline app shell
- **Dexie.js** — IndexedDB for all records and photo/audio blobs
- **docxtemplater** + **PizZip** + `docxtemplater-image-module-free` — runs entirely client-side
- `file-saver` for download
- `exifr` for photo EXIF
- `react-zoom-pan-pinch` for viewing a floor plan (view only in Phase 1)
- MediaRecorder API for audio (no library)

No backend. No auth. Single-user, single-device.

---

## 3. Data Model (Dexie)

```ts
interface Project {
  id: string;                    // uuid
  jobNumber: string;             // "24-087"
  name: string;                  // "MHHS Athletic Improvements"
  location: string;              // "San Marcos, CA"
  clientFirm: string;            // "tBP/Architecture"
  clientCity: string;            // "Solana Beach, CA"
  clientAttn: string;            // "Chuck Forte"
  gridLetters: string[];         // ["A","B","C","D"]
  gridNumbers: string[];         // ["1","2","3","4","5","6"]
  sheets: Sheet[];
  elementPresets: string[];      // learned autocomplete: "mechanical well", "SE tower"
  createdAt: number;
}

interface Sheet {
  sheetNumber: string;           // "S4.1"
  title?: string;                // "Framing Details"
  documentSet: string;           // "Permit Set" | "CCD 002" | "As-Built"
  details: { number: string; title?: string }[];   // [{number:"5", title:"Strap at Blocking"}]
}

interface Visit {
  id: string;
  projectId: string;
  reportNumber: number;          // 1, 2, 3 — gapless per project
  visitDate: string;             // ISO date of the site visit
  reportDate: string;            // ISO date the report is issued
  purpose: string;               // "review the P/T cables at the tennis courts prior to pouring concrete"
  generalState: string;          // optional opening context paragraph
  attendees: { name: string; firm: string }[];       // → PRESENT block
  engineerName: string;          // "David Maestas"
  engineerTitle: string;         // "Principal"
  engineerCredential: string;    // "SE"
  nextObservation: string;       // "Prior to pour-strip concrete pour. Tentatively 10/20/25."
  status: 'draft' | 'complete';
  createdAt: number;
}

interface Item {
  id: string;
  visitId: string;
  sequenceNumber: number;        // display order, reorderable
  gridRef: string;               // "4-A", "grids 4-1 and 4-A", "grid 6"
  elementRef: string;            // "SE corner of mechanical well"
  levelRef: string;              // "high roof", "slab on grade"
  itemType: ItemType;
  bodyText: string;              // the item as it will appear in the report
  detailRefs: DetailRef[];
  measurements: { label: string; value: string; unit: string }[];
  photoIds: string[];
  audioId?: string;
  transcript?: string;           // populated only if §7 is built
  createdAt: number;
  updatedAt: number;
}

type ItemType =
  | 'deficiency'          // correct it
  | 'acceptable'          // acceptable as-is, possibly with condition
  | 'requires-rfi'
  | 'requires-ccd'
  | 'info-requested'      // asks another party to confirm or provide
  | 'not-observable'      // couldn't be seen at time of visit
  | 'progress-note';

interface DetailRef {
  raw: string;                   // "5/S4.1"
  detailNumber: string;          // "5"
  sheetNumber: string;           // "S4.1"
  documentSet?: string;          // "CCD 002"
  validated: boolean;            // matched against Project.sheets
}

interface Photo {
  id: string;
  visitId: string;
  itemId?: string;
  blob: Blob;                    // full, downscaled to 2000px long edge
  thumbBlob: Blob;               // 300px
  label: string;                 // "Photo #1" — assigned at report generation
  caption: string;
  exifTimestamp?: number;
  orientationCorrected: boolean;
  includeInReport: boolean;
  orderIndex: number;
}

interface AudioNote {
  id: string;
  itemId: string;
  blob: Blob;                    // audio/webm or audio/mp4
  durationSec: number;
  createdAt: number;
}
```

---

## 4. Screens

### 4.1 Project List → Project Setup
Create a project with job number, name, location, client block. Then:
- **Grid setup:** enter letter lines and number lines as comma-separated values. Generates the picker.
- **Sheet index:** manual entry in Phase 1. Add sheet number, document set, and detail numbers. Tedious but one-time per project, and it powers the autocomplete that makes field capture fast.

### 4.2 Visit Setup
Report number auto-increments per project. Visit date, report date, purpose, attendees (name + firm, add rows), next observation. Engineer defaults are remembered from last use.

**Pre-visit cache check:** before the engineer leaves the office, show a clear "Ready for offline use" confirmation once the project data is cached.

### 4.3 Item Capture — the screen that matters

Single scrolling sheet, large targets, high contrast. Field conditions assumed: gloves, direct sunlight, one hand occupied.

Order of controls:

1. **Grid reference** — two-column picker, letter lines and number lines, tap one from each. Selected pair renders as "4-A". A "range" toggle lets you pick two pairs to produce "grids 4-1 and 4-A". Free-text override always available.

2. **Element / level** — single text field with autocomplete from `Project.elementPresets`. Anything typed that isn't in the list gets added to it, so the second item of a visit is faster than the first.

3. **Voice memo** — see §5.

4. **Item type** — seven chips, single select. Default to `deficiency` (most common).

5. **Body text** — multiline. This is the item as it will read in the report. If a transcript exists it seeds this field, but the engineer always edits it. Never generated, never locked.

6. **Detail references** — text input with autocomplete. Typing `5/S4` filters `Project.sheets`. On commit, parse into a `DetailRef` and mark validated or not. Unvalidated references are kept as typed and shown with a warning icon — **never auto-corrected**.

7. **Photos** — camera capture and gallery import. Multiple per item. Downscale to 2000px long edge, generate 300px thumb, correct EXIF orientation on write.

8. **Measurements** — optional, add-row, `{label, value, unit}`.

Footer: **Save & Add Another** (primary) and **Save & Close**.

### 4.4 Item List / Review
- Reorderable list (drag handle) — order drives report numbering
- Inline edit
- Item type shown as a colored chip
- Audio playback inline
- Photo thumbnails with caption editing and an include-in-report toggle
- Unvalidated detail references surfaced as a review warning banner

### 4.5 Generate Report
Preview of the assembled report, then **Generate .docx**. Photos are labeled "Photo #1..N" in appendix order at generation time, and body-text references to them are left exactly as the engineer wrote them.

---

## 5. Voice Memo — Hold to Record

Optional throughout. Some engineers will never use it; the typed path must be equally complete and must never feel like the fallback.

**Interaction**
- Large circular button, press and hold to record, release to stop
- Haptic pulse on start and stop
- Live waveform or amplitude meter while recording — proves it's working without the engineer watching a timer
- Elapsed seconds displayed
- **Slide up to lock** — releases the finger while recording continues, for when the engineer needs the hand. Tap to stop.
- On release: playback bar with re-record and delete. Nothing is committed until the item is saved.
- Recordings under 1 second are discarded silently as accidental taps

**Framing**
Label the control **"Dictate note"**, not "Record." The intended use is the engineer describing what they see, not capturing a conversation with others. That framing keeps the feature comfortable to use in front of a contractor and sidesteps the question of recording other people's speech, which in California is worth avoiding by design rather than by policy.

**Storage**
- MediaRecorder to `audio/webm;codecs=opus` where supported, `audio/mp4` on Safari — feature-detect, don't assume
- Store the blob in Dexie against the item
- Audio is retained permanently and stays playable during desk review, whether or not transcription is ever added

**Permissions**
Request microphone access on first use only, not at app launch. If denied, hide the control and carry on — the app must be fully functional without it.

---

## 6. Report Generation (client-side)

Build a `.docx` template from a real W+R field report file. Do not construct the document from scratch.

**Template placeholders**

```
{clientFirm} {clientCity} {clientAttn}
{reportDate} {projectName} {location} {jobNumber}
{#attendees}{name}, {firm}{/attendees}
{visitDateLong}        // "Tuesday, September 30th, 2025"
{purpose}
{generalState}
{#items}
  {sequenceNumber}.) {bodyText}
{/items}
{closingStatement}
{engineerName}, {engineerCredential}
{engineerTitle}
{nextObservation}
{#photos}
  Photo #{n}: {image}
{/photos}
```

**Standing boilerplate** (stored as constants, inserted verbatim, editable in settings):

> Generally, the work observed appeared to conform to the construction documents, except as noted above.

A second variant for work-in-progress visits:

> Generally, the work observed appeared to conform to the construction documents, although it was still a work-in-progress.

**Formatting rules**
- Two spaces after every period in generated body text
- Items numbered `1.)` `2.)` — matching existing W+R reports
- Photos appended after the signature block, one per page, labeled above the image
- Preserve template letterhead, styles, margins, and the Mira Mesa Blvd footer

Image insertion uses `docxtemplater-image-module-free` with the blob read to ArrayBuffer. Watch image sizing — set explicit width and let height scale, or portrait phone photos will overflow the page.

---

## 7. Optional Add-On — Transcription

Build only after §1–6 work end to end.

A single serverless function (Vercel, Netlify, or Cloudflare Worker) that accepts an audio blob and returns text. The API key lives server-side; never in the client.

**Whisper prompt priming is essential.** Without it, W+R vocabulary degrades badly — "CS18" becomes "CS-18" or "CS eighteen," "LSTA9" becomes "LSTA nine," "blkg" becomes "blocking," "shiners" becomes anything. Pass a `prompt` containing:

- A standing glossary constant: `CS16, CS18, LSTA9, LSTA12, LSTA24, HDU, PSCA, GLB, blkg, E.N., shiners, hold-down, drag beam, chaired, pour strip, hairpin, shearwall, diaphragm, sill plate, KH-EZ, tilt-up, out-of-plane`
- The current project's sheet numbers and grid line labels

**Post-processing, applied after transcription:**
- `"five over ess four point one"` → `5/S4.1`
- `"grid four dash A"` / `"grid four A"` → `4-A`
- Validate every extracted reference against `Project.sheets`; flag rather than correct

**Queueing:** transcription requests queue in Dexie and flush when online. The item is fully usable before, during, and after — transcript arrival only seeds a suggestion, and the engineer's typed `bodyText` always wins.

---

## 8. Field Constraints

- Touch targets minimum 48px; primary actions 64px+ (gloves)
- High contrast, dark text on light, no light gray on white (direct sunlight)
- All primary actions reachable one-handed in the lower half of the screen
- No action requires more than one tap to reach from the item capture screen
- Never block on a network call — there won't be one
- Autosave item drafts to Dexie on every field change; a dropped phone must not lose an item

---

## 9. Acceptance Criteria

1. Airplane mode, full visit: create a visit, capture six items with photos and voice memos, generate a `.docx`. No network at any point.
2. Generated `.docx` opens in Word with W+R letterhead, correct header block, correctly numbered items, and a photo appendix.
3. Detail reference `5/S4.1` autocompletes from the sheet index and validates; `9/S9.9` saves as typed with a warning and is not altered.
4. Grid picker produces "4-A" in two taps.
5. Voice memo records, plays back, and survives an app restart.
6. Microphone permission denied: every other feature still works.
7. Force-quit mid-item: the draft is recovered on relaunch.
8. Installs to iOS and Android home screens and launches offline.

---

## 10. Build Order

1. Dexie schema, project CRUD, grid and sheet index setup
2. Visit creation, item capture with typed fields only, item list
3. Photo capture, downscale, EXIF orientation, thumbnails
4. Detail reference parsing, autocomplete, validation
5. docx template and client-side generation — **first end-to-end milestone, test it on a real visit here**
6. Voice memo record, store, play back
7. PWA shell, service worker, install, offline verification
8. Optional: transcription endpoint and post-processing

Step 5 is the checkpoint worth pausing at. A tool that turns typed items into a correctly formatted field report already saves real time, and using it on one actual visit will teach you more about what capture needs than any further specification will.
