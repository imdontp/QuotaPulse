# Visual review of the English dark fixture

Review271 uses the same viewport and scale as each reference. Comparing the unmasked RGB images, averaging absolute differences across every pixel and channel on the 0–255 scale, gave the following results. Fixture text, numbers, graphics and intentional substitutions all count in this measurement.

| Dashboard | Mean channel difference |
| --- | ---: |
| Live | 16.92 |
| Cost | 16.86 |
| Providers | 16.65 |
| History | 16.36 |
| Alerts | 15.53 |
| Projects | 15.19 |
| Overview | 14.68 |
| Models | 14.14 |

On Live, the largest mean difference among sixteen equal grid tiles was 31.30 in the right rail at x=1254–1671, y=470–704. Side-by-side inspection shows dense status strips in the reference and sparse observed activity in the fixture. OVR-009 requires unknown minutes to stay distinguishable from observed activity. Adding filled cells just to resemble the reference would misrepresent those minutes. Compare the rail's row spacing, labels and empty-cell legibility independently of occupancy.

The four summary cards also differ visibly. The reference has small trends beside the values. The current capture shows four source and recency counts. OVR-008 changes the metrics. Establish whether each has a truthful time series before adding any trend. This review covers static English dark captures with reduced motion. The table prioritizes inspection and supplies no visual acceptance score.

[Eight page comparison](comparison.html) · [Capture identities](captures.json) · [Approved metric and activity substitutions](../redesign-v1.85.43/OVERRIDE-COVERAGE.md)
