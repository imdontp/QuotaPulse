# Alerts forecast composition v1.85.34

Continue the original eight-page real-data concept goal after ce56999/v1.85.33.
Original Alerts reference SHA-256:
`f2d05a17e7613035e2a41302baf6a8792ed519de66af0ab159dd56842062f104`.

## Changes

At widths >=1536px, place the existing 170px forecast orb left of the actual
owner/window, projected exhaustion, reset date and reader origin/age. Preserve
stacked composition below that width, loading/unknown states and every fact.
The native forecast frame has a 338px minimum height and grows with content.

Add the source's red warning callout only when the selected daemon reader has
a ready projection strictly before a known reset. Show the actual time gap,
including `<1m` for a positive sub-minute gap. Unknown projections, unknown
resets and projections at/after reset do not produce the warning. No unsupported
token forecast, model recommendation, action, notification or backend rule is
introduced.

## Validation

Production build 14062 exited 0; 2980 modules. Existing 532.91kB App chunk
advisory remains. Frozen index SHA-256:
`8008b97ab46f22856e996de43a76001c9a00228d1f7bf8e803a4708aa6efcbbd`.
An initial sandbox build attempt failed with esbuild spawn EPERM; the authorized
build outside that restriction passed. This is separate from application logic.

Scoped Alerts production check 4579 exited 0: four en/th x dark/light pairs,
all byte-identical, unchanged raster tolerance and no masks. Assertions compare
adjacent projection/reset/origin and warning presence/gap against independently
queried selected quota-history responses. Ready and unavailable windows are
exercised. Existing event history, expansion, empty states, keyboard, focus,
contrast and responsive overflow checks remain in place.

The composition-only build/captures from 88486 were intermediate. The attached
captures and manifests are replaced by the final warning-enabled candidate.
They remain review candidates, not approved visual baselines.

Native measured forecast frame: x1205.15625, y72, width454.828125, height338,
bottom410. Orb: x1236.15625, y131.796875, 170x170. Adjacent facts:
x1446.15625, y131.59375, width198.828125. Warning: x1220.15625,
y313.796875, width424.828125, height80, bottom393.796875. Measurements for all
variants are attached. Source frame and orb are approximately x1208/y72 and
x1237/y132. Warning source is approximately x1231/y311/410x80; horizontal
inset and vertical placement still need refinement against the original source.

Full authenticated workflow 88710 exited 0 on this frozen candidate: all 16
language/theme/width combinations across nine destinations, then final
functional/occupied/compatibility gates across the eight dashboard pages.
Browser, Vite, daemon and database teardown completed. Fresh workflow reports
are attached. Diff whitespace check passes.

## Remaining original goal

The Alerts heading/summary enclosure, exact orb lighting and warning inset,
and other page styling remain open. See NEXT-SOURCE-REPAIRS.md. The complete
eight-page source/23-override ledger, approved implementation baseline, final
40-pair matrix/SSIM requirement, current performance, release compatibility,
rollback and manual accessibility acceptance remain required. This checkpoint
does not establish 99-100% source likeness or whole-goal completion.
