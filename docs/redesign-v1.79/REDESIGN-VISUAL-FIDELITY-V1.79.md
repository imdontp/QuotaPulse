# QuotaPulse visual fidelity checkpoint v1.79

## Quick Stats label

Changed the sidebar count label from **Recent sessions** to **Active sessions** to match the reference concept. The count remains the machine-wide five-minute session count from the existing runtime summary (`session.last_seen_at`); the UI adds a hover tooltip and keeps the accessible explanation that a source observed the session and this does not confirm a process is running. No count or process state is fabricated.

The Runtime Map activity states and project session count are inherited from [v1.78](../redesign-v1.78/REDESIGN-VISUAL-FIDELITY-V1.78.md).

## Validation

- `npm run test --workspace=@quotapulse/web`: **144 passed**.
- `npm run build --workspace=@quotapulse/web`: passed. Vite reports the existing 532.87 kB `App` chunk advisory.
- The production-browser Overview gate passed in English and Thai, dark and light: **4 screenshot pairs, all byte-identical**, with no masks. It checked the localized Active sessions label, the five-minute/source-observed tooltip, and the existing Quick Stats geometry/data assertions.
- Runtime Map keyboard, API-scope, responsive, and connector geometry checks continue to pass in all four matrix combinations; the evidence and focused details are recorded in [overview-verification.json](overview-verification.json).
- All eight source concept hashes match the original reference manifest. The comparison viewer's static asset smoke checks all 16 state/language/theme captures against the source image.
- The viewer's embedded JavaScript passes syntax validation.
- Daemon and review-runtime validation are unchanged from v1.78: its daemon suite passed 100 tests, and its local review bundle passed 5 extracted-runtime checks.
- The v1.79 local review bundle passed **5 extracted-runtime checks** outside the repository dependency tree. It is a review build, not a production installer; it needs an installed matching Node runtime (ABI 127), has readers disabled, and carries no user profile.

Captures, the local overlay viewer, and validation evidence are in this folder. The ZIP `QuotaPulse-v1.79-JDg8Wb.zip` is 201,580,434 bytes (3,135 files; SHA-256 `7155546a6bdfa627fb88ce83b35cd8138d0f3629b1ff3eadf572eeace3d29fbc`). Build, extracted-runtime, and archive evidence is recorded in [bundle-build.json](bundle-build.json), [bundle-verification.json](bundle-verification.json), and [archive-verification.json](archive-verification.json).

The 99–100% visual-fidelity target remains open. Page chrome, quota detail/denominators, and Pulse Insights content/styling still need closer alignment with the references. Open [the v1.79 comparison viewer](reference-review.html).
