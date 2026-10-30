# Eight-page comparison for review211

[Open the eight-page comparison](review.html). Each application image was freshly captured from the same web build in [review211](../redesign-v1.85.211/README.md), using one isolated synthetic database, fixed clock, English/dark, DPR 1, reduced motion and the original reference viewport. The original reference images were checked against the blueprint manifest; every capture repeated byte-for-byte in its browser context. Six older image files are reused only because their bytes matched the new captures; Models and Cost are newly saved. All eight tabs, 16 image loads and arrow-key navigation passed.

This is a current review set, not a 99–100% fidelity verdict. The screenshots show synthetic data, not the user's data, and their date distributions materially change chart shapes. They cover one viewport and a static reduced-motion frame. Thai/light, other dimensions, actual data and physical display behavior require their own checks. [A separate Cost view](../redesign-v1.85.210/review.html) uses varied synthetic history to make alignment visible; it is not the same fixture as this set.

## Visible differences that need review

| Region | Current evidence and next work |
|---|---|
| Overview | The main structure and core artwork are present. The reference shows moving highlights on connections and longer varied activity traces; the saved reduced-motion image cannot establish motion parity. Compare genuine new-record motion and sparse/empty real data rather than introducing idle activity. |
| Live | Reference metric cards and status rows depict idle, queued and failed sessions; the approved override substitutes source/session facts that the app can actually observe. Token flow and the provider/model matrix remain strongly data-dependent. Test genuine streaming, lifecycle and motion before approving the reference-aligned appearance. |
| Projects and Models | The synthetic fixture has five projects and six model/provider pairs, so the reference's denser cards and rows cannot be compared as identical content. Continue comparing card and detail geometry, typography and authentic chart data across realistic data densities. |
| Cost | Projection remains Unknown and its reference sparkline is absent. The reference's filled history depends on a different data distribution. Validate the visual chart with [the varied fixture](../redesign-v1.85.210/review.html), then establish a trustworthy completeness/freshness contract before enabling a projection. |
| History | The reference's prompt/response and raw JSON panel is replaced by safe metadata and provenance under the approved override. Compare typography, selected-row/detail layout and functional states with that replacement, not confidential content. |
| Alerts and Providers | The reference shows more alert rows, provider cards and invented action/health fields than this fixture and supported integrations provide. Verify real owner/window states, artwork and manual actions with authentic data; do not use fabricated providers or automated actions to fill space. |

## Projection evidence

The approved [blueprint](../quotapulse_build_blueprint_v1.1.zip), `02_DATA_SEMANTICS.md`, permits a monthly API-value projection only for a complete, fresh, call-grain month-to-date series after a full local day. Current `costAnalysis` aggregates stored usage and pricing coverage, but does not report ingestion completeness for the period. The per-target cursor stores offsets, file metadata and last successful update; a maximum success time alone does not certify that every relevant file or source was discovered, parsed and fully collected. The JSONL reader can skip malformed complete lines. Consequently the existing response cannot prove eligibility, and leaving the projection unavailable is the supported behavior. Establishing a truthful source-level completeness contract remains implementation work.

The unmasked comparison does not approve a baseline or satisfy the blueprint's subsequent SSIM gate. Review211 is an unsigned trial; physical monitor/tray behavior, real-provider setups, upgrade involving review211, production performance and the intermittent Runtime Map inspector issue remain open.
