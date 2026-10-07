# Native chart and filter composition v1.85.30

## Scope and source

Continue the original real-data eight-page reference goal after969eda2/v1.85.29
on the isolated redesign branch. Original History/Models/Overview references
and their recorded hashes remain authoritative; no new concept is substituted.

## Changes

- History SVG fills its existing viewport rather than centering a144px drawing
  inside the168px native desktop chart box. Token bins, values, scale and dates
  remain unchanged; the plot uses more of the original source's vertical range.
- Native History filters use a35px control row and translated placeholders.
  Their full associated labels remain available to assistive technology.
  All six exact/search fields, kind, unassigned-only checkbox and Apply remain;
  pause, project-missing disable behavior and legacy labels are preserved.
  Narrow layouts retain visible captions and natural wrapping.
- Models places the complete factual pricing-coverage note beside its heading
  at desktop widths, with8px panel gaps. The note wraps naturally; mobile keeps
  a stacked heading/note.575px comparison and90px provider frames are retained.
- A static radial shade darkens the central globe surface in dark theme, fading
  to zero at the rim. Existing local earth bitmap, clip/ring geometry, quota
  values, labels and light-theme appearance remain. The shade is decorative and
  adds no animation or external resource. Fine source particle texture remains
  a separate unresolved visual difference.

## Validation

| Check | Evidence |
| --- | --- |
| Complete production build | Session7453 exited0;2980 modules. Existing532.87kB main App advisory remains. Earlier87037 build predates the globe shade and is not the final candidate. |
| Diff whitespace | git diff --check passes. No dependencies/migrations/API changes. |
| History production variants | Session86127 exited0: eight pairs (four canonical and four selected), six byte-identical; Thai/light canonical30px and selected20px changed, max delta9 within original tolerance, no masks. Occupied bottom900, eight complete rows and43 records. |
| Models production variants | Session29655 exited0: four pairs, all within original tolerance, no masks; en/dark10px/max1, en/light10/1, th/dark32/2, th/light10/1. |
| Overview production regression | en/dark78524 and en/light53620 each exited0: one byte-identical pair each, no masks, exact candidate hash. These are two separate one-pair scopes, not a four-variant Overview matrix. |
| Full authenticated workflow | Session33512 exited0. All16 responsive language/theme/width combinations across nine destinations passed, followed by authenticated History/Overview/Projects/Live/Providers/Models/Cost/Alerts functional, occupied-layout and compatibility checks. Browser, Vite, daemon and database teardown completed. |

Final candidate production index SHA-256:
`21a2fd3d4691c8c252ac6ca0b278cdb70eac8bf65ae9a665d490301b384129e9`.

The scoped production runs total14 pairs, eight byte-identical and six within
the original unchanged raster tolerance. All four manifests carry the same
candidate hash. Port7804 is clear after each completed scope. Production PNGs
and manifests are local review evidence, not approved source baselines.

Direct source observation on fresh en/dark History: the native filter row is now
at approximately472-507 and selected row558, matching source472-507/558.
Plot fills approximately292-409 versus source294-411, closer than prior301-401.
Timeline and summary enclosing frames remain unchanged. These are source-region
estimates, not a whole-image similarity percentage.

Fresh Models source review places toolbar approximately306-340 versus307-340,
table header365 versus367, and selected first row383-421 versus386-421.
The coverage note remains visible. The enclosing comparison/provider frames
remain; fine typography and row density still require source review.

## Remaining original goal

Fresh Overview dark review confirms a subtly darker interior with readable
foreground and unchanged rim. Photographic continent details remain different
from the source particle geography. Fresh light capture confirms the globe
remains unshaded with readable foreground; its separate scoped run passes.

Native History footer/table density still differs from the source's ten visible
rows; current330px table supplies eight complete rows even though actual data
supports more. Further native density must preserve footer access and truthful
coverage. Models other style details, globe particle/star texture and remaining
page typography/illustrations require source review. Complete final eight-page
source/override acceptance,40pair matrix, current performance, release recovery
and manual accessibility evidence before calling the whole goal complete.
Repeatability does not prove99-100% source likeness.
