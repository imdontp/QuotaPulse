# Bounded History select-paint investigation

Status: partially investigated; not fixed. Root cause unproven. This investigation does not clear the strict RED raster gate.

## Symptom and reproduction

The first108 all-eight sequence differs from published107 at418 pixels, all in the native All record kinds select-label region (x1008-1084 near y485 onward; exact samples retained). Max channel delta222. A magnified crop shows a text-paint/baseline difference; the selected label remains All record kinds. Full main/headings geometry agrees, but the first failing run did not record the select's own computed rectangle/style, so its exact cause cannot be inferred from parent equality.

Same108 index, identical isolated fixture/time/Chrome/capture arguments:

- First warm sequence vs published107:418 select pixels changed, no other History pixels.
- Cold History-only vs published107:0 changed pixels in select region,22 elsewhere/maxdelta35.
- Repeated original warm Overview/Live/Projects/Models/History order vs published107:0 changed select pixels,145 elsewhere/maxdelta35.
- Cold vs warm repeat:123 changed pixels outside select/maxdelta3. Recorded select values/text/rectangles/font/line-height/padding/border/appearance/transform are byte-identical between these two runs.
- Each capture's immediate pair is byte-identical. Stable immediate repeats therefore do not establish cross-run invariance.

## Hypotheses and limits

A persistent changed selected value is contradicted by the observed labels and identical follow-up control values. A consistently warm-order-induced418px profile is contradicted by the repeated original order. A deterministic108-source-only418px difference is not supported because both current-build follow-ups reproduce the published107 select pixels. These observations do not eliminate first-frame geometry/font readiness, platform form-control paint, resource/timing state or other browser interactions. They do not prove a CPU/GPU/cache defect, harmlessness or a production fix.

## Next useful evidence

Instrument every canonical select's values, font readiness, own rectangle and computed typography before each capture, preserving the original stimulus and first failing frame. Compare an actual differing frame's observations against its matching frame; use a controlled source/build crossover if a source-dependent profile reproduces. Do not enlarge tolerances, swap recaptures into the canonical result or introduce speculative History styling merely to clear the gate. Current approved Cost changes can be reviewed independently while this issue stays open.
