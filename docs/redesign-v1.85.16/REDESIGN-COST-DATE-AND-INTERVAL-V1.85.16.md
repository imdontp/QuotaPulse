# Cost month-to-date and chart interval v1.85.16

**Status: implementation in progress; visual sign-off not reached.** Cost now opens on the reference's month-to-date period and plots real recorded values in daily buckets by default.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\cost.png` (1672 × 941; original unchanged).
- Captures: [English/dark](cost-en-dark.png), [English/light](cost-en-light.png), [Thai/dark](cost-th-dark.png), and [Thai/light](cost-th-light.png).
- [Cost capture verification](cost-capture-verification.json).

## Changes

- An unspecified Cost range now defaults to the local current month through the current instant. All time remains available.
- Cost charts support automatic, hourly, daily, and weekly aggregation through a validated API parameter. The month-to-date default is daily, matching the interval shown in the concept.
- Per-1,000-token cost retains up to six fractional digits so small recorded values do not display as zero.
- Totals, chart points, provider/model/project/session rows and cost basis still come from the daemon's recorded usage and pricing coverage.

## Validation

- `npm run build -w @quotapulse/web` passed. The existing 532.87 kB `App` chunk warning remains.
- `npm test -w @quotapulse/daemon` passed: 100 tests. `npm test -w @quotapulse/web` passed: 152 tests.
- `QUOTAPULSE_CAPTURE_SCOPE=cost npm run test:stable` passed for English/Thai and dark/light: four pairs byte-identical, no masks. The gate checks default local-month API bounds, daily and weekly API buckets, displayed selection, precise unit-cost formatting, coverage/axis values, keyboard access and viewport overflow.

## Remaining work

The replay fixture contains usage concentrated near the end of the period, so the recorded trend is sparse compared with the concept's illustrative daily curve. Production values remain data-dependent. The toolbar, card copy and table contents also differ from the concept. Repeatability and API correctness are not a likeness score; visual sign-off and the overall 99 to 100 percent reference target remain open.
