# Models history query experiment

The shipped detailed Models endpoint obtains provider totals and model-maker totals through separate aggregations. A candidate grouped usage by exact model, provider and time bucket once, then used two aggregates and UNION ALL to return both series.

Each fixture used 50,000 synthetic rows in in-memory SQLite, 30 days, one session and five alternating measurements per query after warm-up. Both candidates returned deeply equal complete responses, including ordering. The small fixture cycles through five fixed model/provider pairs. The larger fixture derives model names with 701 suffixes, rotates providers independently and includes null models, null providers and empty provider names.

| Fixture | Existing median | Candidate median |
| --- | ---: | ---: |
| Five pairs | 248.5 ms | 191.1 ms |
| Many pairs | 1145.6 ms | 1197.7 ms |

These exploratory runs shared the machine with other tests. Their timings depend on load and cardinality. The result does not establish a general speedup or a production latency bound. The candidate passed the daemon suite, but its benefit was inconclusive across the two fixtures. The committed query was restored and rebuilt. Raw samples are in [few-pairs.json](few-pairs.json) and [many-pairs.json](many-pairs.json).
