# Site Wizard

A field capture and report generation tool for W+R structural engineers. Engineers capture
numbered observations — grid reference, item type, photos, an optional voice memo — during a
site visit, then generate a formatted `.docx` field report back at the office.

**Phase 1 scope:** offline-first PWA, no backend, no AI. See
[`docs/phase1-field-report-brief.md`](docs/phase1-field-report-brief.md) for the full build brief
and [`docs/templates/field-report-template.docx`](docs/templates/field-report-template.docx) for
the real W+R template the report generator targets. `site-visit-app-spec.md` at the repo root is
the earlier, broader brainstorm — later phases (backend, sync, AI drafting) draw from it once
Phase 1 is solid.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS v4
- **Dexie.js** — IndexedDB for all records and photo/audio blobs, single-user/single-device
- React Router (`HashRouter`, so a static, backend-free deploy needs no server rewrite rules)
- `dexie-react-hooks` for live-updating queries
- `exifr` — reads EXIF DateTimeOriginal off captured/imported photos before they're re-encoded

Photos are downscaled to a 2000px-long-edge JPEG plus a 300px thumbnail via
`createImageBitmap(file, { imageOrientation: 'from-image' })` + canvas — EXIF orientation is
corrected by physically rotating the pixels at that point, not by carrying the tag forward, so
nothing downstream (Word included) needs to interpret it.

- `docxtemplater` + `pizzip` — client-side .docx generation against the real W+R template
  (`public/templates/field-report-template.docx`). No image module: the free one pulls in an
  unpatched critical-severity transitive vulnerability (xmldom, no fix available), so photos are
  inserted by hand-splicing OOXML into the rendered zip instead — see
  [`docs/report-generation.md`](docs/report-generation.md).

Voice memos use the browser's own `MediaRecorder` + Web Audio (`AnalyserNode` for the live level
meter) — no dependency needed. Mime type is feature-detected (opus-in-webm where supported,
mp4 on Safari), and microphone access is requested on first hold, not at app launch.

- `vite-plugin-pwa` — service worker (precaches the app shell *and* `public/templates/`, since
  report generation `fetch()`s the template and would otherwise break offline), web manifest,
  and install-to-home-screen support for iOS and Android.

Later phases add `react-zoom-pan-pinch` and optionally a single serverless transcription
endpoint — see the Phase 1 brief for the full stack and build order.

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build     # typecheck + production build
npm run preview   # serve the production build locally
npm run lint       # oxlint
```

## Project structure

```
src/
  types/       Project, Visit, Item, Photo, AudioNote — the Phase 1 data model
  db/          Dexie schema (db.ts) and per-entity data access (projects.ts, …, plus
               itemDrafts.ts for the item-capture crash-recovery snapshot)
  lib/         small framework-free helpers — id gen, item-type metadata, detail-ref parsing,
               remembered engineer defaults, photo downscale/orientation/thumbnail, audio mime
               detection, and the report generation pipeline (reportGeneration.ts +
               reportDates/houseStyle/reportTemplateBlocks/reportImages/xmlEscape/downloadBlob)
  components/
    ui/        generic form primitives (Field, Button, Section)
    visit/     visit-setup-specific editors (attendees)
    item/      item-capture-specific editors (item type chips, measurements, photo capture,
               hold-to-record voice memo)
  pages/       route-level screens
public/
  templates/   the tagged report template docxtemplater renders against (generated —
               see docs/report-generation.md, do not hand-edit)
scripts/
  prepare-report-template.mjs   regenerates public/templates/ from docs/templates/
```

**Grid picker / sheet index:** dropped from Project Setup — see the note in the build-order
list below. `Project.gridLetters`/`gridNumbers`/`sheets` stay in the data model for a possible
future "upload a sheet, tap to calibrate" flow, but nothing currently writes to them; grid and
detail references are free text on the item.

## Build order

Tracking the Phase 1 brief's build order:

- [x] 1. Dexie schema, project CRUD, ~~grid and sheet index setup~~
      — dropped per feedback: not worth the setup cost for the input it fed. Revisit as a
      manual "upload a sheet, tap to calibrate" flow if it turns out to be worth it — no OCR/AI,
      that would blow Phase 1's no-AI scope and isn't reliable on hand-drawn/CAD grid labels
      anyway.
- [x] 2. Visit creation, item capture with typed fields, item list
- [x] 3. Photo capture, downscale, EXIF orientation, thumbnails
- [~] 4. ~~Detail reference parsing, autocomplete, validation~~ — skipped per feedback,
      not needed. Detail references stay plain free text with no validation source.
- [x] 5. docx template and client-side generation — first end-to-end milestone. See
      [`docs/report-generation.md`](docs/report-generation.md) for how the template is
      prepared and how generation-time code fills it, including the photo appendix.
- [x] 6. Voice memo record, store, play back — hold-to-record with slide-up-to-lock,
      a live amplitude meter, haptic pulses, and a 1-second accidental-tap discard.
      Optional throughout; hidden entirely (not disabled) if the mic is denied or
      unavailable, and the typed body-text field is always the complete path on its own.
- [x] 7. PWA shell, service worker, install, offline verification. Verified with a
      headless-browser pass that matches the brief's own acceptance criterion: load online once
      (service worker precaches), go fully offline (`context.setOffline(true)`), then complete an
      entire visit — project, visit, an item with a photo *and* a voice memo, generate and
      download the `.docx` — with zero network requests succeeding at any point.
- [~] 8. Transcription endpoint and post-processing — skipped for now per feedback (optional
      in the brief; revisit if it turns out to be needed).

**Item draft autosave / crash recovery** (brief §8, acceptance criterion #7 — "force-quit
mid-item: the draft is recovered on relaunch"), flagged as a gap after step 7, is now built too:
Item Capture debounce-autosaves a full snapshot (typed fields, photos, voice memo — everything,
via the same Dexie-native-Blob approach as the rest of the form) to a dedicated `itemDrafts`
table on every change. A deliberate navigation away (Save, or the back link) clears it; a crash
or force-quit skips that cleanup, so the draft is offered for recovery — with a "Recovered an
unsaved draft" banner and a Discard option — the next time that item's form opens, new or
mid-edit. Verified by literally closing the page mid-type (no React cleanup runs, the same as a
real crash) and confirming the reopened form recovers exactly what was typed, for both new items
and edits, while deliberate navigation and a real save each correctly leave nothing behind to
recover.
