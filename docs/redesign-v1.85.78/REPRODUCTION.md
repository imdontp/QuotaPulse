# Reproduction (isolated worktree)

1. `npm.cmd run build -w packages/web`
2. `npm.cmd test -w packages/web`
3. `C:/Users/TH12367283/Projects/QuotaPulse/node_modules/.bin/tsx.cmd --tsconfig packages/web/tsconfig.json tmp/pulse78-compat.mts`
4. `$env:QUOTAPULSE_PAINT_PHASE="final"; node --import tsx tmp/source-art78-all8.mts`
5. `$env:QUOTAPULSE_CAPTURE_SCOPE="overview"; node --import tsx scripts/check-stable-captures.mts`
6. `python tmp/pulse78-score-compiled.py`

Run browser commands sequentially. The temporary script snapshots are in reproduction/; their worktree-relative fixture imports require the existing project and tmp paths. They are diagnostic snapshots, not a standalone portable test package. The permanent Overview gate remains in scripts/check-stable-captures.mts. Initial trial images/manifests were generated against77; current compatibility and compiled captures against78. Frozen-mask selection is in diagnostics/mask.json. Archived failed runs do not invalidate the later corrected harness pass and are kept to explain changes to the harness.

Python diagnostics should run with `python -X utf8` on this Windows environment; the initial archive seal attempt without it failed reading UTF8 Thai fixture text under cp874, before changing the archive.
