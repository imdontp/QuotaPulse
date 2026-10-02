# Semantic text contrast checkpoint - 1.12.0

Branch: `design/redesign-foundation`. Tag: `redesign-semantic-contrast-v1.12.0`.
Follows [stable captures 1.11](REDESIGN-STABLE-CAPTURES-V1.11.md).
Overall visual baseline, accessibility and release approval remain pending.

## Changes

The shared shell now defines danger, warning, secondary series and success colors
for each theme. Alerts severity text/borders, Cost's priced-token label/marker,
daemon connection status and existing warning/error text in Live, Projects,
Providers, Models, Cost and Alerts use those colors. Light mode uses darker
foregrounds; dark mode keeps brighter foregrounds. No values, geometry, routes,
controls or alert thresholds change.

The old fixed light foregrounds were too faint against white/light panels.
The text target is 4.5:1, using computed foreground/background colors and the
relative-luminance formula described by
[W3C WCAG 2.2 contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
The automated checks use opaque panel/root backgrounds and the root gradient's
opaque endpoint; the root gradient blends between its endpoints. This checks the
four semantic foregrounds against the relevant background range, not every
foreground/background combination in the application.

The capture harness checks actual computed colors on visible critical/warning
badges, the Cost series label and the live daemon badge. Its second quota owner
now has an observed 85% reading to exercise the warning badge beside a 97%
critical owner. The fixture remains entirely synthetic. Color decoding checks
include CSS shorthand white and the known black/white ratio of 21:1.

## Evidence and limits

See [verification](redesign-v1.12/verification.json) for computed colors, minimum
ratios, checked elements, 32 capture comparisons and production asset identity.
Focused Alerts/Cost captures are included here. The complete 32-image set can be
regenerated under `screens/stable-captures` with `npm run test:stable` after a web
build; these captures are review candidates, not approved regression baselines.

Final validation: **passed**. All 32 pairs are byte-identical, with every pair
decoded by the pixel checker. All four semantic roles pass in each capture;
minimum ratios over the checked backgrounds are:

| Semantic text | Dark | Light |
| --- | ---: | ---: |
| Danger | 5.790 | 5.303 |
| Warning | 8.621 | 5.395 |
| Secondary series | 4.933 | 5.460 |
| Success | 8.547 | 5.290 |

The gate uses unrounded ratios. Actual critical/warning/series/live text colors
match their theme tokens. No horizontal overflow, browser errors, external
requests or API writes occurred. `git diff --check` passes. This is a **validated
CSS and targeted contrast checkpoint**, not a complete accessibility verdict.

Web production build and the updated stable capture/contrast gate are the relevant
checks for this CSS change. The existing legacy App chunk warning remains.
There is no daemon/API/schema change and no new dependency. The 1.10 unit,
functional, production-runtime and isolated-desktop results remain documented;
they were not repeated for this color-only change.

This is targeted text contrast validation. It does not certify all app text,
disabled/hover/focus states, non-text chart contrast, Thai font portability,
keyboard/screen-reader behavior or complete WCAG compliance. Review of typography,
chart access across other screens, reviewed visual baselines/SSIM and packaged
tray/installer release gates remains required. No installed tray/task is replaced
and no live provider is contacted.
