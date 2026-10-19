# Models pair query observation88

Synthetic 161,200 usage rows, 1265 exact identities, three recorded grains, 120 sessions; actual current query and schema. Each case has three warmups and fifteen timed reads. Every returned point reconciled exactly with independent per-pair SQL row reads and JavaScript sums. Database total_changes remained unchanged.

| Case | Median ms | p95 ms | Points | Records | JSON bytes |
|---|---:|---:|---:|---:|---:|
| dense-20-all-grains | 122.561 | 145.193 | 600 | 61600 | 39972 |
| sparse-20-all-grains | 2.946 | 3.618 | 60 | 1600 | 4833 |
| dense-20-call | 79.971 | 107.095 | 213 | 20534 | 14797 |
| dense-20-session-aggregate | 59.076 | 63.196 | 213 | 20533 | 14796 |
| dense-20-source-project | 51.432 | 68.873 | 117 | 5133 | 8405 |
| dense-20-unobserved-range | 0.282 | 0.468 | 0 | 0 | 992 |

Existing whole-group detailed aggregate (one warmup, five trials): median 9187.083 ms, 4009433 JSON bytes, 1265 groups and 7590 source/effort rows. This is a separate existing whole-scope cost, not a baseline variant of the new pair query.

EXPLAIN and exact query/parameters, raw timing distributions, environment and source hashes are recorded in the JSON.

- JSON byte measurements serialize the actual read function return; the HTTP now/scope wrapper and headers are excluded.
- No performance SLO was supplied; these local warm-cache observations are not a release performance certification.
- Synthetic in-memory database excludes real disk I/O, ingestion contention, SSE, network, web parsing and rendering.
- The grouped pair read is one SQL statement per request, not constant execution time; it scans matching model/time index entries and performs temporary GROUP BY/ORDER BY work.
- The existing detailed aggregate remains three whole-scope reads with O(identity/source/effort) result cardinality; row chart paging does not reduce that cost.
- Timings are sequential single-machine trials with fixed case order; no causal comparison to previous builds is claimed.
