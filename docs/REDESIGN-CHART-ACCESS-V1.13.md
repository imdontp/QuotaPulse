# Live and Projects chart access checkpoint - 1.13.0

Branch: `design/redesign-foundation`. Tag: `redesign-chart-access-v1.13.0`.
Follows [semantic contrast 1.12](REDESIGN-SEMANTIC-CONTRAST-V1.12.md).
Overall visual/accessibility/release approval remains pending.

## Implementation

Live and the selected Projects overview now expose their complete chart bucket
series through a native keyboard-operated disclosure and a captioned table with
column headers. Dates and counts use the current language; every row has its
actual bucket timestamp and token count, including zero buckets. These are bucket
starts, not individual record timestamps. The visible chart scale starts at zero
and ends at the actual maximum; time endpoints include dates when they cross days.
The chart accessible name also states the token range. The table sits outside
the chart image so its semantics are available independently.

Bars now use exact relative token values. The old 3% Live / 5% Projects minimum
height could exaggerate small nonzero values. Zero remains zero and the denominator
fallback is used only to prevent division by zero. Live's weighted-call summary
now uses the Calls label rather than Call records. Aggregate/unknown-grain records
remain explicitly excluded from its per-call chart; zero in that chart is not a
claim about unobserved consumption from those excluded records.

The collapsed controls share a compact row when space permits. Expanded tables
can extend the page vertically and have a horizontal scroll container. The Live
desktop plot is 72 px to retain the existing occupied feed viewport gate. The
initial taller layout pushed the first feed record to 976.58 px and failed the
unchanged 941 px gate; that failed attempt was corrected before validation.
Projects also initially failed at 965.84 px. Compacting its desktop detail gaps
and padding restores the ranking gate while keeping its 80 px plot and all data.

## Validation scope

The synthetic production fixture adds two one-token records, one inside Live's
30-minute window and one on an earlier Project bucket. Both charts must contain
one-token and zero buckets. The harness reads the corresponding authenticated
daemon APIs and checks every displayed bucket/value and localized count, actual
bar percentages, Enter open/close, and expanded-table overflow at 390/900/1280 px
for English/Thai and both themes. Computed muted chart-label color joins the
existing semantic text contrast gate. Two screenshot passes still compare all
32 page/language/theme pairs without masks.

The functional history suite also checks the unchanged 144-case matrix, occupied
Live feed/rail and Projects ranking/card geometry, monetary coverage, filters,
pagination, dialog focus, empty states and History links. These checks are needed
because the new captions/disclosure can affect regional vertical layout.

No daemon/API/schema or dependency changes are made. Validation uses synthetic
databases and the isolated worktree; the installed app/tray/task remains untouched.
Build retains the existing large legacy App chunk warning.

## Results

Status: **Validated checkpoint**.

- Web production build passed.
- `npm run test:history` passed: 144 responsive cases and all existing functional,
  occupied layout and monetary fixtures. Live's first feed record ends at
  934.58 px and Projects' complete detail/ranking rail at 933.84 px in all four
  language/theme cases, below the unchanged 941 px thresholds.
- `npm run test:stable` passed: all 32 pairs are byte-identical, every pair is
  decoded, with no masks. Eight chart-access cases pass API equality, localized
  timestamps/counts, one-token/zero proportional bars, Enter open/close and
  expanded-table overflow checks. Live has 31 buckets / 1,801 included tokens;
  the selected Project has 30 buckets / 602 tokens. The synthetic fixture contains
  38 records representing 74 weighted calls, including the two tiny records.
- Targeted semantic/muted text contrast, no browser errors, no horizontal
  overflow and no external/API-write requests pass the production capture gate.
- `git diff --check` passed. Unit, desktop and installer suites were not repeated;
  this checkpoint does not claim their release gates are newly validated.

See [production verification](redesign-v1.13/verification.json),
[responsive matrix](redesign-v1.13/responsive-matrix.json),
[occupied Live geometry](redesign-v1.13/live-occupied-layout.json) and
[occupied Projects geometry](redesign-v1.13/projects-occupied-layout.json).
The included eight PNGs are the fixed synthetic production candidates; occupied
geometry uses the separate richer functional fixture. These are not approved
visual baselines and no concept SSIM score is asserted.

## Remaining work

This provides keyboard and semantic data access for these two charts. It does not
certify manual screen-reader behavior or the full app's accessibility. Models,
Cost and other chart access, complete visual typography/decoration, reviewed
baseline/SSIM and packaged tray/installer release checks remain open.
