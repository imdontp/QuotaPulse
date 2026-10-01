# Monetary coverage checkpoint — 1.6.0

Branch: `design/redesign-foundation`. Tag: `redesign-cost-coverage-v1.6.0`.
Follows [Layout 1.5](REDESIGN-LAYOUT-REFINEMENT-V1.5.md).
Status: **Validated checkpoint**. Overall visual and release approval remains pending.

## Changes

Overview and Models now distinguish absent prices from a known zero amount.
Native/source-reported cost and computed/estimated API value stay separate:

| Selected usage | Display for each monetary basis |
| --- | --- |
| No usage | Zero |
| Usage exists but this basis has no priced calls | Unknown |
| Every call has this basis, amount is zero | Zero |
| Only some calls have this basis | Known subtotal with `+` |

Models uses the same presentation in its summary, comparison table and selected
model. Coverage uses weighted `call_count`, including calls recorded in aggregate
rows; it does not use the number of rows as the production denominator. Preview
records have no weighted call count and explicitly describe coverage as records.
Other monetary bases are excluded from a subtotal, even when their prices are
known. The marker therefore means incomplete coverage of this basis, rather than
only missing prices. Hover text and screen-reader text explain the marker and
the covered/total count in English and Thai.

The first full browser run exposed mobile overflow from an absolutely positioned
screen-reader explanation in a horizontally scrolling table. A focused browser
experiment measured page width 771 px at a 390 px viewport; positioning the value
container relatively restored 390 px without changing the scrollable table.
The fix also preserves each parent's monetary font size and color. The original
overflow gate and complete browser script subsequently passed without relaxation.

No daemon, database schema, dependencies, tray or installed application changes.
The original checkout remains clean at `be8e145`.

## Validation

- Web unit tests: **124/124**, including absent/zero/partial money and preview
  native/computed/estimated/unknown coverage.
- Production web build: passed; the existing 555.60 KB legacy App chunk warning
  remains.
- Full `test:history`: passed, including the **144** page/language/theme/width
  cases, existing drill-down/navigation/focus/SSE and regional layout gates.
- Four additional real HTTP/in-memory SQLite scenarios passed for Overview and
  Models: missing prices, known zero, mixed weighted bases, and an empty source
  scope. In the mixed fixture, API value is `$0.50+`, covering **50/110 calls**;
  native cost is `$0.10+`. Comparison and selected-model values are also checked.
- `test:visual`: passed, **21** preview captures and the existing motion checks.
- `test:runtime`: passed, nine production routes and **5,000** synthetic records,
  authenticated summaries, no external requests, write requests or browser errors.
- `git diff --check`: passed.

Evidence: [validation](redesign-v1.6/validation.json),
[price scenarios](redesign-v1.6/cost-semantics.json),
[responsive matrix](redesign-v1.6/responsive-matrix.json),
[production runtime](redesign-v1.6/production-runtime.json).
The [Overview](redesign-v1.6/overview-concept-size.png) and
[Models](redesign-v1.6/models-concept-size.png) captures were visually inspected:
native cost is Unknown for the computed-only fixture; API amounts and the main
regional layout remain visible. These are review candidates, not approved baselines.

## Remaining work

Continue the [visual refinement queue](REDESIGN-VISUAL-REVIEW.md), richer fixed
fixtures and deterministic daemon/browser clocks before reviewed baseline/SSIM
approval. Complete accessibility/contrast/screen-reader and packaged tray/RC
checks. Coverage text is present in the DOM; this checkpoint does not claim a
complete assistive-technology review. History, Cost and Projects were not given
a new shared component in this bounded fix. Original concepts and existing
blueprint overrides remain the acceptance reference.
