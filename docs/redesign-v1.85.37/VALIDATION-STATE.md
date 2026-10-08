# Alerts guidance and event rail v1.85.37

Continue the original eight-page reference goal after 82c0a02/v1.85.36.
Original Alerts source SHA-256:
`f2d05a17e7613035e2a41302baf6a8792ed519de66af0ab159dd56842062f104`.
The approved blueprint OVR-020/021 require recommended-action composition,
local detail/diagnostic actions and retained event/delivery distinctions.

## Changes

Replace the short generic guidance paragraph with four boxed icon/text/action
rows: selected quota, reported future reset, actual reader diagnostics and
desktop notification settings. Quota/reset destinations follow the selected
owner/window. Reader source comes from matching quota history, with selected
reading fallback and an explicit source-ID label when its name is unavailable.
Absent quota/source data never creates a made-up destination. Loading and
unavailable reset facts remain explicit; notification enablement never promises
delivery. Active snooze and configured quiet hours use actual settings. Equal
quiet-hour endpoints are omitted, matching the tray's disabled-window semantics.

Move history expansion into its heading and compose a compact native rail with
a keyboard-scrollable list. Retain every fetched event, tray requirement and
existing 100/500 history expansion; no list slicing. Narrow layouts wrap links
and facts naturally. No API, polling, automatic workload action or dependency
change is introduced.

## Validation

Production build45444 exited0 (2980 modules; existing 532.63kB App chunk advisory).
Frozen index SHA-256:
`14c973f1eae36bb40f7e5861f4328fd5362035e3c68029b0d232031facc45c8f`.

Scoped production Alerts91086 exited0: all four en/th × dark/light pairs are
byte-identical. Existing tolerance and masks remain unchanged. Added assertions
compare selected quota/reset/reader destinations and reset text to independent
authenticated daemon responses. Local intercepted notification fixtures verify
disabled notifications, active snooze, overnight quiet hours and equal-endpoint
suppression, including native viewport containment. Existing 60-event/empty,
keyboard End, responsive overflow and 100→500→100 checks pass.

Full authenticated workflow74474 exited0: all 16 language/theme/width combinations
across nine destinations, followed by functional, occupied-layout and route
compatibility checks across the eight dashboard pages. Browser, Vite, daemon
and database teardown completed. Attached workflow reports are fresh for this
candidate. Both test suites use isolated in-memory synthetic databases; the
application continues to render its actual API data.

Measured en/dark top frame x239/y72/958.9375×163.6875; forecast
x1207.9375/y72/454.0625×338; guidance x1207.9375/y419/454.0625×328;
history y756/167.890625 high, bottom923.890625. Guidance outer frame matches
source y419..747. Its first row y484.1875 still differs from source approximately
y477. These are measured candidates, not a similarity score.

Independent read-only source/blueprint review of fresh en/dark and th/light found
no clipping/overlap or major factual/composition issue. It identified remaining
event-heading icon plate differences. Decorative orb artwork and finer row
spacing also remain open. No 99–100% acceptance, approved baseline or complete
release claim is made. See [remaining work](NEXT-SOURCE-REPAIRS.md).
