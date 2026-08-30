# W+R Site Visit App — Build Brief

A field capture and report generation tool for structural engineers. Engineers capture geotagged photos, plan-pinned observations, and voice notes during a site visit; the app assembles them into a draft assessment report in the firm's Word template.

---

## 1. Product Summary

**Primary user:** Licensed structural engineer or EIT performing a site assessment, condition survey, or construction observation visit.

**Core loop:**
1. Create a Visit (tied to a Project, optionally a specific Building/Zone).
2. Capture Observations on site — photo + location + voice note + tags.
3. Return to office; review and edit observations.
4. Generate a Word report draft with an annotated site/plan figure and per-observation write-ups.

**Non-negotiable constraints:**
- Must work fully **offline**. Jobsites frequently have no cell service, and interiors of concrete/tilt-up buildings block GPS.
- Capture must be **fast** — under 10 seconds per observation. If it is slower than opening the camera app, engineers will not use it.
- Report output must be an **editable .docx**, not a locked PDF, so it can be redlined in tracked changes.

---

## 2. Tech Stack

### Client — Offline-First PWA
- **React + TypeScript + Vite**
- **Tailwind CSS** for styling
- **vite-plugin-pwa** (Workbox) for service worker, install prompt, offline shell
- **Dexie.js** (IndexedDB wrapper) for local data and photo blob storage
- **MapLibre GL JS** for the map view; **OpenFreeMap** or **Protomaps** tiles (free, self-hostable, offline-cacheable). Avoid Google Maps — licensing and offline caching are both problems here.
- **react-zoom-pan-pinch** or a custom canvas layer for the floor-plan pin mode
- **exifr** for reading GPS EXIF from imported photos
- **MediaRecorder API** for voice capture

Why PWA over native: single codebase, installs to home screen on iOS and Android, no app store review cycle, and camera/geolocation/microphone are all available via web APIs. The one real tradeoff is background audio recording, which is not needed here.

### Backend
- **Node + Fastify** (or Hono) with **TypeScript**
- **PostgreSQL + PostGIS** for spatial queries; **Prisma** or **Drizzle** as ORM
- **S3-compatible object storage** (AWS S3 or Cloudflare R2) for photos and audio
- **Auth:** Microsoft Entra ID / Azure AD OIDC — the firm is already on Microsoft 365, so this avoids a separate credential set

### AI Services (server-side only; never expose API keys to the client)
- **Transcription:** OpenAI Whisper API, or `whisper.cpp` self-hosted if audio should not leave the firm's control
- **Drafting:** Claude API (`claude-sonnet-4-6` for per-observation drafting, `claude-opus-4-x` for full-report synthesis)

### Document Generation
- **docxtemplater** (Node) with the image and HTML modules, driven by a real W+R `.dotx`/`.docx` template
- Do **not** generate documents from scratch with `python-docx` or raw OOXML. Start from the firm's existing template file so letterhead, styles, margins, and headers survive intact.

---

## 3. Data Model

```
Project
  id, projectNumber (Deltek Vantagepoint project number), name,
  clientName, address, lat, lng, projectType, createdAt

Building
  id, projectId, name ("Building 100"), dscApplicationNumber,
  yearBuilt, constructionType, notes
  # Multi-building campus support is essential — SDUSD/DSA work is
  # organized by building, and each may carry its own DSA app number.

FloorPlan
  id, buildingId, level, imageUrl, imageWidth, imageHeight,
  # Optional georeference for overlaying plan on map:
  originLat, originLng, rotationDeg, scaleMetersPerPixel

Visit
  id, projectId, visitDate, engineerId, weather,
  presentOnSite[], purpose, status (draft|review|complete)

Observation            # the central entity
  id, visitId, buildingId?, floorPlanId?, sequenceNumber,
  # Location — either or both:
  lat, lng, gpsAccuracyMeters, locationSource (gps|plan|manual),
  planX, planY,                       # normalized 0-1 coords on floor plan
  locationDescription,                # "NE corner, Grid C-4, interior face"
  # Content:
  tags[],                             # crack, spalling, corrosion, deflection,
                                      # moisture, settlement, connection,
                                      # nonstructural, ADA, prior-repair
  severity (informational|monitor|repair|urgent),
  measurements[],                     # {label, value, unit} e.g. crack width 0.020 in
  voiceTranscript, engineerNotes,
  draftText,                          # AI-generated paragraph
  finalText,                          # engineer-edited, wins over draftText
  createdAt, capturedOffline (bool), syncedAt

Photo
  id, observationId, storageKey, thumbnailKey,
  exifLat, exifLng, exifTimestamp, compassHeading,
  caption, orderIndex, includeInReport (bool)

AudioNote
  id, observationId, storageKey, durationSec,
  transcript, transcriptStatus (pending|done|failed)

ReportTemplate
  id, name, docxStorageKey, placeholderSchema (json)

GeneratedReport
  id, visitId, templateId, docxStorageKey, generatedAt, generatedBy
```

**Sync strategy:** every record gets a client-generated UUID and a `updatedAt` timestamp. Sync is last-write-wins per record, queued in Dexie, flushed when connectivity returns. Photos upload separately with resumable multipart and a per-photo retry queue — a failed photo upload must never block the rest of the sync.

---

## 4. Feature Spec

### 4.1 Capture (on site)

**Quick Capture screen** — the default screen when a Visit is active. One large camera button. On shutter:
- Capture photo, grab GPS fix in parallel, write both to IndexedDB immediately
- Show a compact sheet: tag chips, severity selector, hold-to-record voice button, optional measurement field
- "Save & Next" returns straight to camera

**Location handling** (ordered fallback):
1. GPS fix with accuracy better than ~15 m → use it, store accuracy
2. Poor or no fix → prompt the plan-pin sheet if a FloorPlan exists for the current Building
3. Neither → text-only `locationDescription`, flagged for later placement

**Plan pin mode:** pinch-zoom floor plan, tap to drop a numbered pin. Pins render in tag color, with severity as the border. This is the mode that will get used most on interior work.

**Voice notes:** hold-to-record, waveform feedback, stored as `.webm`/Opus. Transcription queues for when the device is online. Playback must remain available offline regardless of transcript status.

**Batch import:** import photos taken with a DSLR or another phone; read GPS/timestamp from EXIF and auto-create Observations for them.

### 4.2 Review (back at the office)

- **Map/plan view** of all pins for a Visit, filterable by tag, severity, and building
- **List view** with inline editing; reorder to control report sequence
- **Bulk operations:** retag, reassign to a building, exclude from report
- **Transcript editor** side by side with audio playback
- **Unplaced observations queue** — anything captured without a usable location

### 4.3 AI Drafting

Per observation, send to the Claude API: transcript, tags, severity, measurements, location description, building context, and the photo itself (vision). Return a draft paragraph.

Prompting requirements, from house style:
- Paragraph format, no bullets, within report body sections
- Two spaces after periods
- Observational voice — describe conditions; do not assert causation or code compliance conclusions that the engineer of record has not made
- Flag any recommendation as a suggestion the engineer must confirm, and surface it in a separate `suggestedRecommendation` field rather than burying it in the observation text

A **full-report synthesis pass** takes all observations for a Visit and drafts the Executive Summary and Conclusions sections. This should be a distinctly separate, explicitly triggered action — never automatic.

Every AI-generated field must be visually marked as unreviewed until the engineer edits or approves it. Nothing AI-written should reach a generated report without passing through a review state.

### 4.4 Report Generation

Populate a `.docx` template with:
- Project and visit metadata, engineer name and S.E. license number
- Per-observation blocks: numbered heading, photo(s), caption, body paragraph
- A rendered figure of the map or floor plan with numbered pins — generate this server-side (headless Chromium screenshot of a MapLibre/canvas render) and insert as an image
- Photo log appendix table: number, description, location, timestamp

Output is a `.docx` download plus an optional push to SharePoint/OneDrive via Microsoft Graph.

### 4.5 Admin
- Project setup, building list, floor plan upload
- Template management with a placeholder validator that checks a template against `placeholderSchema` before it can be used
- User roles: Engineer, Reviewer, Admin

---

## 5. Build Phases

**Phase 1 — Local-only capture.** PWA shell, Dexie storage, camera, GPS, tags, severity, list view, JSON export. No backend. This alone is worth using on a real visit, and testing it on one is the fastest way to learn what the capture flow actually needs.

**Phase 2 — Voice + plan pins.** MediaRecorder, floor plan upload and pin placement, transcript editing.

**Phase 3 — Backend + sync.** Postgres, auth, S3, offline sync queue, multi-device access.

**Phase 4 — Report generation.** docxtemplater against a real W+R template, plan/map figure rendering, photo log.

**Phase 5 — AI drafting.** Per-observation drafting, then full-report synthesis. Deliberately last: the capture and report plumbing must be solid before generated prose is layered on, or debugging becomes impossible to isolate.

**Later:** Deltek Vantagepoint project lookup so projects are selected rather than typed; Procore and Bluebeam export; annotated-photo markup; recurring monitoring visits that diff crack widths against a prior visit.

---

## 6. Notes for the Implementer

- Build offline-first from the first commit. Retrofitting offline support onto an online-first app is a rewrite.
- Photos are the bulk of storage. Downscale to roughly 2000 px on the long edge for report use, keep a 200 px thumbnail, and offer to retain the original. Report-quality print rarely needs more.
- Preserve EXIF orientation. Phone photos will otherwise render sideways in Word.
- Every AI output needs a visible provenance marker and a review gate. Reports go out over a licensed engineer's stamp.
- Store measurements as structured `{value, unit}`, not free text, so a future monitoring feature can compare across visits.
- Test on the actual device the engineers carry, in a real building, early. Interior GPS behavior is the single biggest unknown in this design.
