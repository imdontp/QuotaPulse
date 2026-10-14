# Loading72 remaining geometry: causal diagnosis

Read-only investigation. No app/test edits, browser, build, daemon or Git operation. Root's built4222c9… probe log and current source inspected. One inefficient optional offline image-comparison command was interrupted; no result from it is used.

## Verdict

There are **two independent mechanisms**:

1. Pending metric markup/styles really make the core40px too tall. Pulse placeholder is already319.984px and is no longer the cause.
2. Cold retry performs a real source redetection that changes fixture facts. The populated quota panel becomes an unavailable panel, so its intrinsic ready height changes399.5→394. Pending-only min-height400 cannot satisfy both current ready states under the unchanged2px anchor check.

Do not widen tolerance or blame fonts. Fix pending metrics, then choose a source-grounded native quota frame across loading/ready/unavailable, or test same-data geometry separately from intentional source-removal geometry. No production quota bug is proven.

## 1. Exact metric sizing

Current overview-pending.tsx metric rail has a plain `div` containing inline qp-metric-rail-label + Slots2. It does **not** use ready `qp-metric-rail-copy` grid.

Source:
- overview.css360: qp-metrics display:grid.
-364: metric rail42px icon column.
-370: ready copy display:grid;gap2.
-371: label11px,line-height14.
-1263 native>=1536: metrics gap30 and translateY18.
-1596 pending Slots: gap12,padding-block8.
-1599 each shape height10.

Observed arithmetic matches log exactly:

- Inline label's parent13px inherited line-height1.5 creates **19.5px line box**.
- Two shapes:10+10+12gap+16padding=**48px**.
- Plain copy/rail content19.5+48=**67.5px**, larger than42px icon.
- Four rails×67.5+three gaps×30=**360px**.
- Core align-items:center/min-height320 expands to360 because that rail group is an actual grid item. Native hero stays394 and overflow:hidden, so last pending metric reaches y489 and is clipped beyond hero bottom462.
- Pulse measured360px container with319.984px circle and top models140px are smaller. More circle corrections cannot remove metrics'360 minimum.

**Minimal causal correction recommendation** (root owns edit):

Use existing `qp-metric-rail-copy` on pending rail copy, plus a **pending metrics-only** Slots override: gap4,padding-block0. Two neutral bars then24px; grid label14+gap2+24=40px;42px icon dominates. Group4×42+3×30=258, below core320 minimum. Core can therefore remain320 with current319.984px placeholder. This keeps two neutral bars and labels, no fake numeric value.

Adding copy class alone is insufficient:14+2+48=64;4×64+90=346. Clipping group to320 or reducing true ready metric styles would hide the cause. Apply only pending styling; rerun exact child/core heights and ready data/pixel gates. Predicted arithmetic is source-derived, **not yet measured after edit**.

## 2. Retry changes facts legitimately

Verified path:

- server.ts296 POST /api/refresh calls scheduler.runNow.
- scheduler.ts135 runNow first calls redetect(false).
- runner.ts30 resolveSources(adapters[]) detects no profiles, then calls disableMissingSources.
- runner.ts71..77 selects every source enabled1 and updates enabled0 when no matching detected profile.
- Probe log explicitly prints all four fixtures “is gone; its history is kept.”
- queries.ts401 latestLimits requires source.enabled1.
- queries.ts711 accountStatus also requires enabled1.
- subscriptionStatus891 builds catalog rows from remaining observed accounts; missing catalog definitions use stateWhenMissing. No account_state DB field must change for API ownership/availability to change.
- sourceStatus327 retains disabled sources that still have usage; usage_event history is untouched.

Therefore cold retry loses enabled quota readers/current observed accounts and returns no selectable quotas, while graph/history totals remain positive. This is truthful unavailable-source behavior of the **actual fixture scheduler**, not malformed percent math or font loading. The fixture's nonexistent roots are incidental: adapters[] means no adapter can claim these profiles even if directories existed.

Actual geometry from root log:

| State | Core height | Hero height | Quota height | Runtime y |
|---|---:|---:|---:|---:|
| pending current |360|394|400|476|
| deferred ready (no ingest) |320|394|399.5|475.5|
| cold retry ready (actual ingest/removal) |320|394|394|470|

Grid hero-row height is max(hero,quotas), followed by8px main gap. Hence runtime476/475.5/470 follows quota heights **exactly**. Metrics/core40px overflow is separate because hero itself is fixed394.

## 3. Source frame evidence and bounded recommendation

Immutable original overview PNG SHA924849d96af48d5f0aae3ab330e01df929485020ef91e9c0516f1fd7cc0d96ce,1586×992, inspected directly. Both top cards start around y68.

Independent raw pixel horizontal-band medians (x250..1179 hero, x1230..1549 quota; avoids rounded corners):

- Hero bottom outline y461 medianRGB18/27/44; y462 antialias8/15/28; y463 background4/10/21.
- Quota bottom outline y465 median24/38/53; y466 antialias10/20/33; y467 background3/9/19.
- Runtime top line y474/475, then fill y476. Hero band y474=15/23/38,y475=15/24/38.

This supports **hero about394px, quota about399–400px, runtime top about475px**. It does not recover an exact original CSS number from composited PNG antialiasing. Current populated399.5 quota/475.5 map is already close; cold-unavailable394/470 is a composition-state shrink, not an illustrative source target.

Best full-goal direction: one bounded **native>=1536 quota frame** shared by loading, populated and unavailable, around the accepted399–400px measurement; preserve actual unknown/no-quota text. Pending-only400 should not remain the sole reservation.

- A shared native min-height400 is the smallest source-grounded change for current populated and no-quota fixture states; populated moves0.5px, unavailable6px. It retains factual rows rather than inventing filler.
- If requiring truly fixed anchor for arbitrarily many windows, use a native fixed frame + header/body grid with existing quota-group overflow inside remaining height. Preserve every owner/window and keyboard reach; never clip facts or reset list. This needs stronger tests than min-height and is a wider follow-up.
- Do not pick a magic placeholder height for only the one populated fixture. Do not silently certify exact ready-byte invariance if adding shared ready frame changes it: review the small actual source-aligned diff and preserve original regression rules.

The minimum must be reviewed against TH/light, other native widths and existing overflow/focus behavior; pending metrics fix remains independent. No browser trial of these recommendations was run by child.

## 4. Test fixture separation also required

Current probe shares one in-memory DB across all six cases. Native cold retry changes4source rows enabled1→0; later390/TH cases inherit those disabled readers. Their “normal populated” scenario no longer has the original quota fixture.

Root options, without app manipulation:

1. Reseed/restore an isolated fixture per case, and keep cold retry as explicit source-disappearance coverage.
2. For a same-data retry geometry case, use fixture-only adapters whose detect returns those exact seeded profiles and whose ingest performs no writes. Then actual POST/API/Scheduler path remains real while source state is unchanged. Record adapter semantics; don't claim real account collection.
3. Keep an additional adapters[] removal case verifying disabled sources/no quotas and preserved historical usage. Its ready facts differ intentionally, so its geometry assertion must correspond to the shared unavailable frame contract.

Use before/after source enabled/account/API limits snapshots to prove case facts, instead of treating successful graph token rendering as proof quotas stayed unchanged. Separate user-driven theme/lang interactions and read-only online refresh from actual ingest refresh. Wait actual React identity as already done; further fontwait cannot undo SQL source removal.

## Next root action

Correct pending metric copy/shape sizing; decide/review shared native quota frame from the source399–400px evidence; isolate per-case fixtures and explicitly record retry source changes. Keep2px checks unchanged for same-state anchors. Rerun bounded probe and ready Overview gates after source freeze. Loading72 and full goal remain unvalidated until these gates pass.
