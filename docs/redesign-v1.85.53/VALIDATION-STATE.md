# Projects selected-card paint v1.85.53

Validated scoped CSS change; full concept and release acceptance remain open.

Build `828a2c2bbb4ac9b60ffa10a0a928d69f52c64547b3e082284abffc592a21a833` changes only selected Projects card paint on dark native screens (>=1536px): measured cyan/violet/blue border and a blue interior gradient. Physical border, card dimensions, focus, navigation, real counts, costs and observed trend remain. EN/dark DOM card is x243/y206, width466.390625, height258, border1px. Source top rim remains one pixel lower at y207.

Build/native probe session76945 and Projects EN/TH dark/light four-pair gate session33957 passed with actual terminal exit0. Eight canonical/repeat PNG hashes were verified. Compact workflow checks remain in the existing Projects gate. No full40 or new unit-suite result is claimed for this CSS-only change; prior v1.85.52 full40 belongs to its recorded build.

Four small blank-region median channel MAE improves from7.2083 to0.7917; two of three homologous top-edge RGB samples match and the third differs by one red level. These are local paint measurements, not a likeness percentage. See [source/before/after](comparison/source-before-after.png), [measurements](comparison/measurements.json), [independent rendered review](rendered-review.md) and [provenance](build-provenance.json).

Remaining: source-shaped identity artwork, main heading paint/alignment, project summary and trend allocation, sidebar details, whole-page source acceptance, approved baseline/SSIM, manual accessibility/performance and final desktop/recovery/package gates. Approved factual substitutions remain authoritative.

## Reproduce the native probe

Copy `native-projects-probe.mts` to repository `tmp/project-paint53.mts`, and copy the two retained runner scripts into `tmp/`. Run each runner from repository root with the project's existing dependencies/browser installed. The probe preserves its original tmp-relative imports and uses only an isolated synthetic in-memory database. Archive paths are evidence copies, not direct executable entry points.
