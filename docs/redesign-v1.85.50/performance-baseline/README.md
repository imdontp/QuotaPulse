# Causal effort-cardinality measurement

One synthetic in-memory5000-record database; only effort values changed. Full summary grew588→250,542 UTF8 bytes, categories1→5000. All other event fields, totals, timeline, bucket size and source/dist tree hashes were checked unchanged. Every effort group reconciles record/call counts.

[Measurement](history-effort-causal50.json), [exact script](history-effort-causal50.mts), [execution log](history-effort-causal50.log), [bounded category candidate plan](history-performance-next-goal50.md).

The script imports relative to its original tmp location. To reproduce, copy the archived script to repository tmp and run `node --import tsx tmp/history-effort-causal50.mts`. It creates no server or browser and uses no network/customer data. This is payload growth evidence, not measured browser CPU/render performance or a production latency regression. Category paging remains to be implemented with full access to original source categories; no values may be silently dropped or normalized.
