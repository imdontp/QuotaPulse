# v1.85.96 rendering A/B observations

Both trials used the same final app index, synthetic aggregate fixture, immediate duplicate stimulus and ordinary Chrome. Only per-frame style sampling differed.

| Probe | Samples | Max RAF gap | Max callback self-time | Long tasks |
|---|---:|---:|---:|---:|
| Computed style per target per RAF | 54 | 88ms | 1ms | 3; max 102ms |
| Timing-only RAF | 56 | 60ms | 1ms | 2; max 111ms |

Neither run recorded a near-full sampling gap in this one replay. Those outcomes differ from earlier immediate-stress/restoration red runs with207ms/124ms gaps. Long-task intervals are retained but have not been causally aligned with the older failed traces. One pair is insufficient to identify a cause or apply a production performance fix.

Next: repeat order-balanced paired trials on the unchanged immediate stimulus; preserve browser/version/renderer flags and app index; align RAF and long-task intervals with traces; record actual paint evidence separately. Retain native180/700 finish assertions.
