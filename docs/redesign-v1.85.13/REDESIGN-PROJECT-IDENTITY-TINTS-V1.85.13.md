# Project identity tints v1.85.13

**Status: implementation in progress; visual sign-off not reached.** This checkpoint gives each project a stable decorative accent derived from its actual key and carries the selected project's accent into the detail panel.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\projects.png` (1672 x 941; original unchanged).
- After captures: [English/dark](projects-en-dark.png), [English/light](projects-en-light.png), [Thai/dark](projects-th-dark.png), and [Thai/light](projects-th-light.png).
- [Projects capture verification](projects-capture-verification.json).

## Changes

- Card accents are now deterministic from the project key, so sorting or filtering no longer changes a project's cyan/violet identity tint.
- The selected detail panel uses the same tint as its selected project card.
- The accent is purely decorative; it does not classify project type, activity, or health. Project names, costs, counts, chart points, and all other values remain API-backed.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite retains the existing 532.87 kB `App` chunk warning.
- `QUOTAPULSE_CAPTURE_SCOPE=projects npm run test:stable` passed in English and Thai, dark and light: four capture pairs passed the existing repeatability tolerance, two byte-identical, no masks.
- The browser check confirms each project's tint remains stable after sorting and that the selected detail tint matches its card. It also validates source-estimated top-card geometry within 6px, recorded trends against the API, cost/unknown handling, keyboard project selection, and the current 941px page-height limit.
- These are behavior and repeatability checks, not a whole-image score against the concept. The synthetic in-memory capture currently has most tokens in one project and one recent date, so its trend shape and content density differ from the supplied mockup. Production values are not changed to imitate that fixture.

## Remaining work

Project icon variety, shared chrome, card content density, and the other supplied screens still need direct source comparison. The requested 99 to 100 percent likeness remains open.
