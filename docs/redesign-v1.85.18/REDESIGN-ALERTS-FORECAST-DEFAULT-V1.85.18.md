# Alerts forecastable quota default v1.85.18

**Status: implementation in progress; visual sign-off not reached.** Alerts now opens on the first quota window whose recorded samples support a forecast. Explicit owner/window links still take precedence.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\alerts.png` (1672 × 941; original unchanged).
- Captures: [English/dark](alerts-en-dark.png), [English/light](alerts-en-light.png), [Thai/dark](alerts-th-dark.png), and [Thai/light](alerts-th-light.png).
- [Alerts capture verification](alerts-capture-verification.json).

## Changes

- With no explicit owner/window in the route, the forecast rail selects the first actual quota window whose daemon forecast is ready and has a projected-full timestamp. If none qualifies, it keeps the existing first-window fallback and reports Unknown.
- Links carrying an owner/window selection continue to override this default, including windows without enough samples.
- The rail's days-to-full, reset time and chart series continue to come from quota-history samples.

## Validation

- `npm run build -w @quotapulse/web` passed. The existing 532.87 kB `App` chunk warning remains.
- `QUOTAPULSE_CAPTURE_SCOPE=alerts npm run test:stable` passed in all four language/theme variants: four pairs byte-identical, no masks. The gate independently queries every owner/window and verifies the default is the first forecastable API window, while checking Unknown cases, rule thresholds, history expansion, keyboard scrolling and viewport overflow.

## Remaining work

The actual first forecastable fixture is OpenAI Subscription · Monthly with 4.3 projected days; the sample does not contain enough information for the concept's wider multi-line pace/risk chart or recommended automated actions. Those values remain data-dependent and are not synthesized. Card copy and the remaining page composition still differ, so visual sign-off remains open.
