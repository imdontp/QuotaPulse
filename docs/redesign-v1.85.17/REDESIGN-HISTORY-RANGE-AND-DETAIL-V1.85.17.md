# History rolling range and selected record v1.85.17

**Status: implementation in progress; visual sign-off not reached.** History now opens on the reference's rolling 30-day window and shows the newest matching recorded event in the right-side details rail.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\history.png` (1672 × 941; original unchanged).
- Captures: [English/dark](history-en-dark.png), [English/light](history-en-light.png), [Thai/dark](history-th-dark.png), and [Thai/light](history-th-light.png).
- [History capture verification](history-capture-verification.json).

## Changes

- History defaults to the last 30 days. The period resolves to the current instant minus 30 days and uses daily grouping; the existing Today, week, month, all-time and custom choices remain available.
- When the first result arrives, the latest matching event is selected once and shown in the existing right-side details rail. The row, selected state and metadata all come from the History API response.
- Closing the rail returns focus to the selected row's details control. Existing selection, pause, export and filter behaviors remain available.

## Validation

- `npm run build -w @quotapulse/web` passed. The existing 532.87 kB `App` chunk warning remains.
- `npm test -w @quotapulse/daemon` passed: 100 tests, including rolling-range API boundaries and its daily bucket. `npm test -w @quotapulse/web` passed: 152 tests.
- `QUOTAPULSE_CAPTURE_SCOPE=history npm run test:stable` passed: eight page/detail screenshot pairs across English/Thai and dark/light, four byte-identical and the rest within the established no-mask raster tolerance.
- The gate verifies a selected API record, four metadata groups, token fields, focus trap/restoration, complete 30-day row count, keyboard scrolling and 390/900/1280 overflow.

## Remaining work

The replay fixture's recorded usage is concentrated near May 17, so the real-data chart is sparse compared with the concept's illustrative daily curves. Labels, filters, table columns, card metrics and detail content also differ. The test proves repeatability and behavior, not source-image likeness; overall visual sign-off remains open.
