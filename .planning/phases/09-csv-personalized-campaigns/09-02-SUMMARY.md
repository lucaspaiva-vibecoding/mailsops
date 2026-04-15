---
phase: "09-csv-personalized-campaigns"
plan: "02"
subsystem: "campaigns-ui"
tags: ["csv", "upload", "drag-drop", "personalized-campaigns", "react", "routing"]
dependency_graph:
  requires: ["09-01"]
  provides: ["CsvUploadPage", "/campaigns/new/csv route"]
  affects: ["src/App.tsx", "campaigns routing"]
tech_stack:
  added: []
  patterns: ["file dropzone with drag-and-drop", "parseCsvFile async handler", "conditional section rendering on csv parse state"]
key_files:
  created:
    - "src/pages/campaigns/CsvUploadPage.tsx"
  modified:
    - "src/App.tsx"
decisions:
  - "Route /campaigns/new/csv placed between /campaigns/ab-test/new and /campaigns/new to prevent :id wildcard from matching 'new'"
  - "fileInputRef used for programmatic click from dropzone div, keeping hidden input in sync with reset"
  - "handleFile centralises both drag-drop and file-input paths to avoid duplication"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-15T12:43:45Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 09 Plan 02: CsvUploadPage Component and Route Summary

**One-liner:** CSV upload page with drag-and-drop dropzone, column validation error display, 5-row preview table, campaign name input, and create-campaign flow wired to useCsvCampaign hook.

## What Was Built

### Task 1 — CsvUploadPage component (`src/pages/campaigns/CsvUploadPage.tsx`)

Named export `CsvUploadPage` following CampaignBuilderPage layout conventions (max-w-4xl container, dark theme, section headings).

Key features implemented:
- **File dropzone** — `onDragOver`, `onDragLeave`, `onDrop` handlers; hidden `<input type="file" accept=".csv">` triggered by click; `dragActive` state drives border-indigo-500 highlight vs default border-gray-600 dashed border
- **Error display** — red alert (bg-red-900/50 border-red-700 text-red-300) with X dismiss button; shown when `parseCsvFile` returns an error
- **File info bar** — FileText icon, file name, row count, Remove ghost button; only shown when file is successfully parsed
- **Preview table** — first 5 rows; columns: #, First Name, Last Name, Email, Subject, Body Preview; body uses `truncateBody(row.body, 100)`; dark table styling (bg-gray-900 header, border-gray-800 rows)
- **Campaign name input** — wrapped in max-w-md for visual balance
- **Create button** — validates campaign name (toast error if empty), calls `createCsvCampaign`, shows success toast with recipient count, navigates to `/campaigns/:id/csv-review`

State managed: `csvRows`, `parseError`, `fileName`, `campaignName`, `creating`, `dragActive`

### Task 2 — Route in `src/App.tsx`

- Import added: `import { CsvUploadPage } from './pages/campaigns/CsvUploadPage'`
- Route added: `<Route path="/campaigns/new/csv" element={<CsvUploadPage />} />` — positioned after `/campaigns/ab-test/new` and before `/campaigns/new` to ensure static segments are matched before `:id` wildcard

## Verification

- TypeScript `npx tsc --noEmit` passed with zero errors
- Task 1 grep checks: PASS
- Task 2 grep checks: PASS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all interactive functionality is wired. `createCsvCampaign` navigates to `/campaigns/:id/csv-review` which will be implemented in Plan 03.

## Self-Check

- [x] `src/pages/campaigns/CsvUploadPage.tsx` — exists and contains `export function CsvUploadPage`, `parseCsvFile`, `truncateBody`, `useCsvCampaign`
- [x] `src/App.tsx` — contains `CsvUploadPage` import and `campaigns/new/csv` route
- [x] Commit `e7560db` — `feat(phase-9): Plan 02 — CsvUploadPage component and route`
- [x] TypeScript: zero errors

## Self-Check: PASSED
