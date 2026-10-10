# Native sidebar spacing checkpoint51

Production index:`59d998e03d16dcefac7d5a8d209b8a78c013d3f27906d5553656e16995a2b127`. Only application change since50: native production sidebar CSS. Release tag:`redesign-visual-fidelity-v1.85.51`.

## Validated

- Build and170 web tests passed, observed exit0/session82096.
- Native EN/dark eight-page geometry, nine destinations, keyboard open/close More, no nav/card/footer overlap, and compact1280/900/390 scope passed, observed exit0/session64622.
- Native TH/light eight pages and full16-combination UI compatibility, legacy/popup/empty/unavailable/recovery passed, observed exit0/session34553.
- Two independent isolated renderers produced8pixel-identical native EN/dark default frames, observed repeat exit0/session59317. The original10-channel/.00005 unmasked gate was preserved. Current-build full40 matrix was not repeated; latest complete matrix is checkpoint50.

## Source improvements

Models badge painted178..198,338..358 now matches original exactly21x21. Menu row offsets improved from4–12px early to0–2px. Closed-menu QuickStats top targets match all eight pages within0–1px:421/442/408/443/444/447/444/416. Models card305px and footer top865 match; live intrinsic card292px versus291px target remains1px.

More open retains card546..835/footer873..937 on seven941px pages, with the existing8px scrollable trailing padding; no content overlap. Providers/Cost still initialize expanded to expose the current route. Their closed-menu captures match source top444/447; those are not their default appearance. Overview retains992px source viewport/footer916..980. Main and sidebar widths and smaller layouts are unchanged.

[Sidebar comparison](sidebar-review.html) uses original unmodified refs and current captured frames. Probe Overview is the actual default5h83% fixture, unlike50's full-matrix monthly72%; this checkpoint validates sidebar geometry and does not rebind whole-dashboard source parity. [Independent pixel/source review](source-review/REVIEW.md) and hash-bound geometry are retained. To reproduce the archived probe, copy native-layout-probe.mts into the repository tmp folder; its imports resolve from that location.

## Remaining source requirements

QuickStats heading is6px left/4px high in Models; icon fill/backdrop still differs. Footer text is11px too far left; source paint/borders vary by up to5px. Source silhouettes, artwork/glow, other page details,23 overrides, named approved baseline/SSIM, bounded History effort implementation/performance, manual accessibility and final Electron/recovery/release remain. This is not99–100% source acceptance.
