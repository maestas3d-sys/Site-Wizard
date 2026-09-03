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

Later phases add `docxtemplater`, `exifr`, `react-zoom-pan-pinch`, `vite-plugin-pwa`, and
optionally a single serverless transcription endpoint — see the Phase 1 brief for the full stack
and build order.

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
  db/          Dexie schema (db.ts) and per-entity data access (projects.ts, …)
  lib/         small framework-free helpers (id gen, item-type metadata, detail-ref
               parsing, remembered engineer defaults)
  components/
    ui/        generic form primitives (Field, Button, Section)
    visit/     visit-setup-specific editors (attendees)
    item/      item-capture-specific editors (item type chips, measurements)
  pages/       route-level screens
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
- [ ] 3. Photo capture, downscale, EXIF orientation, thumbnails
- [ ] 4. Detail reference parsing, autocomplete, validation — needs a source to validate
      against now that the sheet index is gone; revisit scope when this comes up
- [ ] 5. docx template and client-side generation — first end-to-end milestone
- [ ] 6. Voice memo record, store, play back
- [ ] 7. PWA shell, service worker, install, offline verification
- [ ] 8. Optional: transcription endpoint and post-processing
