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
  lib/         small framework-free helpers (id generation, grid-line parsing)
  components/
    ui/        generic form primitives (Field, Button, Section)
    project/   project-setup-specific editors (grid lines, sheet index)
  pages/       route-level screens
```

## Build order

Tracking the Phase 1 brief's build order:

- [x] 1. Dexie schema, project CRUD, grid and sheet index setup
- [ ] 2. Visit creation, item capture with typed fields, item list
- [ ] 3. Photo capture, downscale, EXIF orientation, thumbnails
- [ ] 4. Detail reference parsing, autocomplete, validation
- [ ] 5. docx template and client-side generation — first end-to-end milestone
- [ ] 6. Voice memo record, store, play back
- [ ] 7. PWA shell, service worker, install, offline verification
- [ ] 8. Optional: transcription endpoint and post-processing
