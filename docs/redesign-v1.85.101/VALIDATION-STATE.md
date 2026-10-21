# Checkpoint v1.85.101 — concept navigation and current all-eight evidence

**Partially validated.** Navigation behavior, build and repository tests pass. Original-reference visual acceptance remains open; the strict before/after pixel control retains one red result.

## Implementation

- Cost Analysis occupies the concept slot between Models and History. Providers follows Alerts. Other secondary routes remain reachable through More.
- Selected secondary links now span the same 201px desktop plate as primary links. The compact More trigger has clear space beside the label; narrow layouts stack it below the selected link with a separate hit area.
- Sidebar silhouettes use the original vocabulary: circle-dollar for Cost, cloud for Providers, and bell for Alerts.
- Measured desktop spacing repairs Cost's increasing row offset and Providers' selected-row offset. Final raster icon-center errors against the original images are at most 1px for Cost and 1.5px for Providers under the documented threshold scan. These measurements cover these anchors, not every geometry requirement.

## Current build and validation

Compiled web index SHA256: `3ba6759cfec970fa9090e7d3aeff4ee379384e80784d81b805cbdc3f2008417f`.

- Web TypeScript/Vite build: exit 0. The existing chunk-over-500KB warning remains.
- Full repository tests: **647/647** (daemon 121, web 328, tray 198), exit 0. See [logs](logs/full-repo-tests.log).
- [Native Chrome API/SSE gate](evidence/aggregate-native.json): 28 stages; exact finite durations/identity/lifecycle passed, no browser errors or forbidden requests, no sampling gaps in this final run. Earlier intermittent Models sampling gaps remain an open diagnosis; this successful run does not establish a general performance pass.
- [Native keyboard/layout matrix](evidence/navigation-matrix.json): 24 cases covering Cost/Providers, EN/TH, dark/light, and 390/900/1280px. Tab reaches More and the sibling route, Enter opens/closes or navigates, the new route collapses More, and no horizontal page overflow occurs.
- At 1672×941, Quick Stats starts at y=447 on Cost and y=445 on Providers, within 2px of the reference targets. Desktop selected-label clearance exceeds 24px; 390/900px selected and More hit areas do not overlap.
- An AI review agent inspected the navigation diff and found no material correctness or accessibility issue. The final additional spacing edits only adjust desktop per-route CSS values.

## Fresh original-reference evidence

Use [the interactive comparison](review.html) to inspect original/intermediate/current/overlay/heatmap views.

- Canonical dimensions are verified from original PNG headers and [the original manifest](original-reference-manifest.json): **Overview 1586×992; the other seven screens 1672×941**. This supersedes the single-canvas description in the historical v1.85.100 audit.
- [All-eight current captures](evidence/capture-current.json) use the compiled build above, EN/dark, DPR 1, reduced motion and the retained deterministic renderer flags. Every current capture is byte-identical to its immediate repeat. This is static browser evidence, not packaged-host or native performance evidence.
- The synthetic in-memory fixture is the same fixture used by v1.85.95; normal application endpoints supply the displayed facts. It does not touch a user's DB. Source image hashes match the supplied originals. Request restrictions allow local reads and the read-only model-row-trends POST.
- `before/` is an **intermediate build** (`b2ce115...`) that already contains the Cost-order repair, before plate/icon/spacing changes. It is not a screenshot of checkpoint v1.85.100. Its manifest is [retained separately](evidence/capture-intermediate.json).
- [Unmasked original-reference measurements](reference-metric-summary.json) include all real-data/content substitutions. Every screen remains below the blueprint's 0.985 SSIM target. No mask, replacement baseline, likeness percentage, or visual exception is approved by these reports.
- Reproduction scripts, source fingerprints, compiled asset inventory and artifact hashes are retained with this checkpoint. Extract archived `.mts.gz` scripts under the worktree's `tmp/` directory to preserve their relative imports.

## Strict pixel control remains red

[The complete unmasked control](evidence/pixel-controls-RED.json) compares the intermediate and final app captures on the same fixture. Seven screens have no changed pixels outside the edited sidebar. Providers has **7 changed pixels** at x=1652–1657, y=73–75 in the rounded upper-right header corner; each changed channel differs by 1. Its main/header DOM rectangles are identical (header x=238, y=72, width=1422, height=68). The cause is unproven. The control still exits 1; these pixels were not masked or relabeled as a pass.

The historical v1.85.95 raster and sampling findings also remain retained. A repeatable current capture is not a causal resolution of those findings.

## Continue the full goal

Continue diagnosing the retained pixel control; expand the stable decorative Projects palette toward the reference's orange/neutral accents; inspect sparse Providers states without adding fictional quotas; then continue the complete data/interaction/motion/native/package/rollback and requirement trace in [next required work](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md). The original all-eight real-data redesign goal remains active and has not achieved final visual approval.
