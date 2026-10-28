# Source186 search rendering candidate

The seven non-Overview dark desktop routes use a 3D transform for the search plate without moving its measured rectangle. This candidate is built from a working tree after parent commit `79f724e`; it is not included in review185. [View the eight-page comparison](review.html).

Eight synthetic-data captures were repeated within the same context and matched byte-for-byte. Before/after comparisons found no changed pixels outside the search area, and no main-region geometry changes. The Providers stable-capture gate passed twice at its existing tolerance, without masks.

Cross-context results at 1536 and 1672 CSS pixels with DPR 1, 1.25, 1.5 and 2 are recorded in `evidence/dpr-comparison.json`. At 1536, the candidate still exceeds the existing gate tolerance in some comparisons at DPR 1 and 1.5. Thus, this change does not establish cross-context raster stability for all sizes or renderers. Original-transform browser-only comparisons at 1536 also showed differences (DPR 1: 329 and 330 changed pixels, max channel delta 95; DPR 1.5: 563 changed pixels, max delta 77). These are limited samples and do not establish a general improvement rate.

The screenshots use synthetic data; production displays actual recorded data. This gallery is for review, not an approved reference or a claim of 99–100% visual parity. The compiled checkout passed an isolated-profile Electron probe covering eight routes in English dark and Thai light, including a same-version restart and settings persistence. This is not a packaged-release or installer test. A new downloadable bundle is not provided by this candidate.

The authenticated local HTTP and in-memory SQLite end-to-end check passed, including 144 responsive route cases across two languages, two themes and four widths, plus command palette and dashboard interactions. See `evidence/integration-verification.json`.
