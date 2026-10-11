# v1.85.64: Providers header actions

Validated local implementation checkpoint. Full reference and release acceptance remain open.

Providers now follows the reference primary/secondary action hierarchy with the existing Refresh action and a keyboard-accessible Diagnostics link. OVR-013 permits these supported actions in place of unsupported Connect Provider. No provider identity, account, quota, data or integration was fabricated. Native dark primary geometry is x1450/y91/151x36; secondary x1613/y91/34x36, approximately one pixel from the reference horizontal anchors. Six measured interior color samples now differ from the corresponding source samples by at most three channel units. This is a local color measurement, not a whole-page similarity score.

Current TypeScript/Vite build and EN-dark/TH-dark/TH-light native probes pass at1672/1536/1280/900/390. The initial mobile change caused horizontal overflow because the header already used column flex direction; the final nowrap/stretch layout passed all five widths. The initial failure and diagnosis are retained as historical evidence. The canonical Providers check activates Diagnostics with Enter, checks the selected settings section and actual health heading, then returns to Providers and runs the existing API/layout assertions.

The unchanged, unmasked Providers repeat gate passes all four language/theme pairs; 4 are byte-identical and the remainder pass the original tolerance. All eight repeat image hashes are verified. Current all-eight EN-dark native frames are included; five other pages are byte-identical to checkpoint63. Cost differs by57 sidebar pixels at maximum channel delta2; Models differs by2 sidebar pixels at maximum channel delta3. Both pass the original tolerance and their exact regions are recorded. Fixtures exercise actual application code and isolated data, not production records or a Concept Preview mode.

See [all-eight source comparison](reference-review.html), [source / before63 / current64 header crop](comparison/header-source-before-after.png), geometry, repeat manifests and build provenance. Root reviewed the source diff and measured source colors; no independent final64 review is claimed.

Full40/UI/473 tests belong to historical checkpoint62 and were not rerun for64. Current Electron/recovery/performance/rollback and final manual accessibility/release acceptance remain open. The 99–100% source goal and approved-baseline SSIM >= .985 are not established by these repeatability checks. Main and unrelated .zed files remain untouched by this work.
