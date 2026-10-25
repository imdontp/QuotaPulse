# Custom calendar dates — source148

Validated bounded correction. Parent `04e9597c1d654470af317d821aea1f3fcdf66db6`. The runnable [review147 ZIP](../redesign-v1.85.147/README.md) remains unchanged and does not include this later source change. Full99–100% reference/native acceptance is still open.

The original compiled renderer showed May16 as the end date for a May17 sub-day interval even though the API received the exact correct timestamps. [Before](images/before.png). The UI subtracted a whole24-hour day from an exclusive endpoint. It now displays the date of the final included millisecond. This retains the last day for a midnight endpoint and correctly shows the next calendar date when a short range crosses midnight. Initial rendering does not round or rewrite the URL/API timestamps, source or session constraints.

Explicit end-date edits now use the next local calendar midnight instead of adding24 hours. This preserves the complete selected day across New York's23-hour spring and25-hour autumn transitions. Clearing either controlled date field is ignored without navigating to a NaN timestamp. No API, database, money semantics, styles, translations or Pet behavior changed.

[Bangkok English/dark](images/bangkok-en.png) · [New York Thai/light mobile](images/new-york-th.png). These are owned empty-data scope fixtures, not demo application content or reference baselines.

The original compiled renderer fails the sub-day label regression. After the fix, the production web build and351 web tests pass without failures/skips/cancellations.42 compiled browser checks cover three timezones (Bangkok/UTC/New York), EN/dark desktop and TH/light mobile, sub-day and midnight boundaries, spring/autumn days, exact source/session/API scopes, explicit end-day edits and clearing controls. The maintained eight compiled History cases also pass, preserving token totals, areas/points/empty charts and keyboard values. No tolerance, assertion or timeout was weakened.

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-usage-calendar.mts
node --import tsx scripts/check-history-timeline.mts
```

Native/ZIP verification has not been repeated for source148. Source146's675 tests/native review147 remain dated evidence for that earlier source. The retained SSE issue now has a separate isolated real-HTTP cancellation reproduction under investigation; this calendar checkpoint does not claim it fixed. No main/origin or unrelated files were changed.
