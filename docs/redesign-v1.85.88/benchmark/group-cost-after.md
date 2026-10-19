# Current production aggregate observation88

Actual updated production detailedAggregates(model), one invocation on deterministic161200-row/1265-pair/120-session fixture: **961.803ms**. Full result deepEqual against the three frozen original SQL statements extracted from the pre-change diagnosis passed. The original SQL oracle was executed once each afterward, taking 131.510, 2896.505, 3132.285ms (totals, groups, detailed rows).

Result: 1265 groups, 7590 detailed rows, 4009433 JSON bytes (function return only). Tokens 56321591; records 161200. Exact result SHA256 060d4469f2050da1136d44ea76089012a2c6c6fadcb007d6df07d0b83cae8060; current production source LF SHA256 4622390a7184f22a42786320be3fcc852d977451ff7ea72bb2c05769cf1c2443. Database total_changes unchanged.

Prior measured original whole-call median9187.083ms over five trials and diagnosis original per-query total5297.818ms are historical observations on the same deterministic fixture. Current invocation is one observation, not a controlled speedup ratio or SLO proof. Fixture unknown-family vendor cases exercise many fallback rules. Disk I/O, concurrency, network and browser work excluded. Whole-result 4MB/cardinality and vendor-filter CASE work remain open.
