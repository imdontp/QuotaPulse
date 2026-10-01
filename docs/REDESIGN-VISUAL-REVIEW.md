# Concept comparison and refinement queue

Reviewed: 2026-10-01. Source: the eight original concept PNGs preserved in the
blueprint v1.1 archive. Candidate set: `redesign-v1.3/*-concept-size.png`, captured
at 1586 × 992 for Overview and 1672 × 941 for the other seven pages, DPR 1.
All eight pairs were inspected visually. These are not approved baselines.

Follow-up: [Layout 1.5](REDESIGN-LAYOUT-REFINEMENT-V1.5.md) addresses the initial
Overview activity visibility, Providers comparison/health visibility and Models
provider-summary/detail-rail placement findings below. Its three new captures
were inspected and pass named regional gates. Richer occupied layouts and the
remaining styling/baseline/release checks still need review.

[Monetary coverage 1.6](REDESIGN-COST-COVERAGE-V1.6.md) corrects Overview and
Models' absent-price zero labels and partial monetary coverage. The new captures
retain the regional layout gates; reviewed deterministic baselines remain pending.

[Live layout 1.7](REDESIGN-LIVE-LAYOUT-V1.7.md) compacts the session toolbar,
summary and observed activity rail. Its occupied fixture verifies the first feed
record and complete rail at concept size across both languages/themes, plus
pagination, mobile overflow, long metadata and empty filtered results. Full feed
visibility, chart axes/value accessibility and final styling remain under review.

## Shared shell

The implementation uses a 210 px sidebar and a 64 px topbar. The concepts have a
roughly 226 px sidebar (Overview differs), a roughly 60 px topbar spanning the
brand, and denser navigation. The nine consistent destinations, machine scope,
language/theme controls and command palette follow the blueprint overrides.
The missing Quick Stats panel and flatter background/glow treatment are still
visual differences; their omission has not been approved as visual parity.
Keep connection state separate from source freshness. Do not restore the
concept's constant “All Systems Operational”, workspace account or avatar.

## Screen review

| Screen | Preserved structure and intentional factual changes | Findings at initial v1.3 review; see follow-up above |
| --- | --- | --- |
| Overview | Pulse Core, quota rail, observed relationship graph, runway, usage insights, activity. Real quota owner/window and cache metrics replace fictitious token allowance and ROI. | Hero and runway/insights regions are taller; activity falls below the concept viewport. Compact the lower regions and review text hierarchy and graph treatment. |
| Live | Summary, sessions, token chart, record feed, advisory/activity rail. Recent/reporting/stale/error counts replace unsupported lifecycle states; provider activity is not service health. | Header/summary/search spacing is larger; record feed starts at the viewport bottom. Review compact table and chart density. Sparse synthetic series must remain sparse. |
| Projects | Selectable cards, selected-project detail, tabs, trend, breakdown and ranking. Usage share replaces budget, and refresh/details replace unsupported create/settings. | Card decoration is simpler; ranking sits under cards rather than under the detail rail. Right-side summary is tall. Review placement with multiple real projects. Two fixture projects cannot justify padding with invented projects. |
| Providers | Known owner cards, quota windows, selected owner detail, comparison and reader health. No invented plan price, daily allowance, latency or provider connections. | Selected owner details consume a full row; comparison and health fall below the viewport. Integrate detail more compactly and review card/window density. Missing quotas must remain explicit. |
| Models | Summary, comparison, selected model, token components, trend and recorded metadata. Calls and price coverage replace benchmarks; provider and maker stay distinct. | Detail rail is wider/taller; provider summary and lower detail regions are below the viewport. Review column ratio and compact token distribution. Search label and placeholder repeat text. |
| Cost | Summary, monetary trend, provider distribution, model/project/session breakdown, known cache difference. API/native bases and unknown coverage are explicit. | Provider distribution is below the summary row rather than beside it; model/project/session and insight regions are stacked differently. Review grid placement and density without merging monetary bases. |
| History | Full-filter timeline/summary, metadata filters, paginated records and selected record rail. Record grain and categorical effort replace status and average effort; no prompt/raw JSON or bulk selection. | v1.3 timeline was about 452 px high and the first table row was below the viewport. Current refinement reduces the region, uses responsive chart coordinates and groups the detail rail; geometry is gated by the browser harness. Remaining: header/actions placement, comparison with the selected-rail state and typography. |
| Alerts | Summary, observed quota chart, current risk/advisories, fixed rules, forecast/guidance and event history. Fixed 50/80/95 thresholds and delivery controls replace unsupported mitigation automation. | Summary/chart spacing and rail placement differ; read-only rules are partly below the viewport. Review chart axes/labels and compact regional geometry. Do not restore unsupported switch/apply/pause actions. |

## Approval and evidence requirements

Data count, chart shape and missing metrics legitimately differ from the concept.
Those differences do not excuse unrelated geometry or typography changes. Use a
richer fixed synthetic fixture to review occupied layouts, as well as empty and
unknown states. The current real daemon clock makes the candidate set unsuitable
for deterministic pixel regression. Establish a named reviewed baseline only
after the refinements and deterministic capture controls; then enforce the
blueprint's SSIM ≥ 0.985 and regional geometry/typography checks. Do not mask
charts, labels or complete cards to obtain that score.

Settings has no supplied concept image. Preserve its existing controls within
the shared shell and verify navigation, narrow layouts and keyboard behavior.
