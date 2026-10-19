# Runtime model-share paint candidate89 — offline proposal

Status: candidate for root's same-build trial; not implemented or accepted. No browser, build, Git or production-source edits performed.

## Frozen scope and current inputs

Production owner: `packages/web/src/redesign/overview.css:734-737`; rendered markup `overview.tsx:367`.

Exact candidate selector:
`.qp-redesign[data-testid=production-overview][data-theme=dark] .qp-map-node[data-dimension=model] .qp-node-track>span`, inside `@media(min-width:1536px)`.

Current fill `background:linear-gradient(90deg,var(--qp-accent),var(--qp-series))` with dark root tokens `--qp-accent:#36c9ff`, `--qp-series:#a873f9`. Current child has display:block, height:100%, inherited radius, no declared fill shadow. Parent track is flex:1, height:6px, overflow:hidden, radius:8px, background:color-mix(in srgb,var(--qp-muted) 15%,var(--qp-panel)). Share container width38%, gap7px; numeric label minimum32px. Candidate does not change any of these geometry rules or inline share width.

## Source color evidence

Original Downloads `refs/overview.png`: 1586×992; SHA256 `924849d96af48d5f0aae3ab330e01df929485020ef91e9c0516f1fd7cc0d96ce`.

Actual inspected screenshot `tmp/map86-final/overview-native-dark.png`: 1586×992; SHA256 `981f3a59414ac08a34369ebe59abb6cfece8b8c0ada1ee1d17df9e9f52ee480e`; manifest index `8479d47a868523dd72ef9c32626150c84539bd1939b72b5ee55e8f5c740b33da`. This is actual compiled86 evidence, not a claim that a newer88/current gallery has been recaptured. Current source still declares the same cyan/violet fill rule. Viewed diagnostic `tmp/source88-inspection/runtime-model-bar.png` (nearest4× diagnostic, not the native acceptance artifact).

Native Source center row y545: x1398 RGB70/105/250, x1405 78/107/250, x1410 92/118/250, x1416 95/117/249. Actual first-fill center row y545: x1430 66/192/255, x1435 88/175/253, x1440 111/158/252, x1445 134/140/251. These are different track positions, not corresponding data positions or an image error score. They demonstrate the cyan-heavy actual lead versus concentrated blue/blue-violet Source material.

Source vertical cross-section x1405: y541 RGB24/35/102, y542 85/116/246, y545 78/107/250, y548 94/122/248, y549 36/53/132. This supports a tight luminous rim rather than a broad cyan halo. Original apparent fill is about8px tall; actual6px size is deliberately held fixed for this paint trial. No size parity is claimed.

## Candidate

See `runtime-share89-proposal.css`.

- Gradient `#4669fa` → `#6575f9` is derived from the Source blue/blue-violet interior samples, eliminating the cyan lead while retaining a subtle end-to-end hue shift. It is not a copied curve or percentage.
- Inset top1px `#b4c0ff24`, bottom1px `#bac6ff33` provides restrained concentrated edge light without changing layout or drawing outside the parent clip. Alpha choices are a trial hypothesis, not a measured exact match.
- For causal separation, root may first apply gradient-only (omit box-shadow), then add the inset rim on the same page. Preserve both screenshots if comparing the two paint controls.

## Required trial proof

Use actual current compiled app, fixed fixture/clock and exact native viewport with root's renderer. Before/after require identical full main HTML including every inline width percentage, visible facts, all boxes, all model-share track/fill/label rects, and runtime nodes/edges/path geometry. Computed fill background and inset shadow are the only intentional style deltas. Actual model order, node count, percentages and labels remain unchanged. No axis, data, provider identity, event eligibility, curve or fallback changes.

Capture native Source and actual track strips at native scale (plus optional nearest diagnostic). Judge concentrated blue/violet material; do not use whole-track MAE across different percentage widths. Include compact dark/mobile dark/native light controls proving selector exclusion. A pass of paint invariants does not establish Source acceptance or whole redesign completion.
