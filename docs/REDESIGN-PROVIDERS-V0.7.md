# Redesign implementation checkpoint — 0.7.0

Branch: `design/redesign-foundation`. Tag: `redesign-providers-v0.7.0`.
This checkpoint adds the blueprint's production Providers view after
[Live 0.6](REDESIGN-LIVE-V0.6.md).

Review captures: [English dark desktop](redesign-v0.7/providers-en-dark-1440.png),
[Thai light mobile](redesign-v0.7/providers-th-light-390.png), and
[browser verification](redesign-v0.7/verification.json). The captures use
synthetic records in an in-memory SQLite database.

## Providers view

- `#providers` uses the existing authenticated overview read. It shows one
  card per known subscription entitlement, including catalog entries that are
  currently inactive, and separate cards for unbound harness sources. Readers
  sharing a subscription key stay on one owner card; linked harness profiles
  identify readers and do not claim per-call provider routing.
- Each card shows actual quota windows selected by the existing primary
  reading rule, plus the source origin, observation age and reset time in its
  details. Expired, future and missing percentages stay unavailable. A source
  that publishes no quota remains visible without an invented percentage.
  Existing hidden-subscription preferences are disclosed on the card.
- The comparison uses one observed window kind at a time. It includes only
  current, comparable owner readings and displays the count excluded. It does
  not normalize unlike windows into a daily, weekly or monthly average.
- The reader table shows account state, quota freshness, age and sample count.
  These are local reader observations, not provider latency or service health.
  Refresh uses the existing global refresh action. Manage and diagnostics
  links open the matching subscription row in Settings or source row in Health.
  No credentials, integrations, schema or dependencies were added.
- The previous Sources, Health and Settings routes remain available. The
  visual layout has English/Thai, light/dark and narrow screen support.

## Validation

Web tests **116/116**, web production build, `npm run test:history`,
`npm run test:visual` (21 pilot captures), and `npm run test:ui` passed.
The real HTTP browser fixture checks catalog and unbound source cards,
same-window comparison with exclusions, no-quota details, scoped Settings and
Health navigation, and desktop/mobile layouts. The existing main bundle size
warning remains. Daemon code did not change in this checkpoint.

## Remaining work

Models, Cost, Alerts and Settings redesign slices remain, as do canonical
Live route migration, complete reference geometry/SSIM review, hardening and
RC gates. `visualApproval` remains `pending`.
