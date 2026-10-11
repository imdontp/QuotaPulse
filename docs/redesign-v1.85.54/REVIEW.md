# Scoped source and rendered review

Root review of the final two-file diff against363d374 and final hashed native frame. No completed independent final-source review is claimed; the earlier independent review concerns the initial candidate.

The new component changes only decoration. Existing translations are inside spans; no API, calculations, event handlers, chart paths or component state were changed. Default display:none plus production/native/dark selectors gates the new marks. Light and compact layouts expose the retained fallback SVGs; Core padding uses a stronger selector and the final runtime computed value is2px. aria-hidden and focusable=false prevent extra accessible names and focus targets.

Four enlarged source/before/after crops were inspected. Titles are lighter and closer to original ink baselines; Core subtitle starts closer to the source. Retained data-oriented subtitle wording is an approved factual substitution. Custom Core/Runtime line topology and glow still differ visibly from the source; Runway/Insights icon artwork remains different. The successful repeated captures prove stable current rendering and covered behavior, not full source fidelity.

Measurements use documented shared title ROIs and relative-luma>=175 plus red>=150. Runway's ROI begins at277 to exclude adjacent source gauge/glow ink at274. The mask is a diagnostic, not source font-family identification, CSS-weight identification or similarity score.
