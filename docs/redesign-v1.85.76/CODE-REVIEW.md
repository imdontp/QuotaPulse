# Scoped implementation review

Reviewed by the implementing agent; no independent reviewer is claimed for76.

- The automatic initial project uses a unique Symbol rather than the valid recorded name `auto`. The selected value is resolved to string/null before graph keys, props or HTTP encoding.
- All-project state is explicitly null. The empty string now reaches the existing shared URL encoder as `project=`, preserving exact API identity.
- Native option values encode strings with JSON while the All option remains empty. This separates empty, quoted, literal null, Unicode and sentinel-like names without changing visible ordinary labels or normalizing recorded names.
- The existing localized Empty name label identifies an otherwise invisible option. No invented project, quota, token or motion data is introduced.
- Scope-specific graph effect cleanup and snapshot key matching remain unchanged. Project changes do not change the global Overview period/source.
- Existing capture interactions are updated to the encoded value; the semantic expectations and raster tolerance remain unchanged. A new regression uses real in-memory daemon queries and restores all mutated fixture sessions in finally.
- Missing project/null remains an existing graph identity within All; this change does not add a separate missing-project filter.

No additional blocker found in the scoped diff. Build/browser/test evidence and remaining release limits are documented separately in VALIDATION-STATE.md.
