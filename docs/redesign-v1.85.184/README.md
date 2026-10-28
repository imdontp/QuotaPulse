# Providers row alignment / source184

[Eight-screen concept/current gallery](review.html): Providers is a newly captured compiled page using an owned synthetic database. Seven other application images and all eight source references are reused; the running application uses collected data.

At widths of at least 1280px, provider cards stretch to the tallest card in their grid row, including owners with no published quota. Their existing no-quota message remains visible and no quota, plan, reading or source is invented. Rows containing only no-quota cards stay compact. At narrower widths the prior layout remains in use.

The web build passed. Twenty-eight actual-UI combinations covered en/th, dark/light and seven widths, checking overflow, content containment, truthful no-quota states and keyboard selection. Twelve additional second-row layout scenarios used cloned DOM cards solely as test fixtures: all-empty rows remained compact, mixed rows aligned and a hidden-state message fit. In the canonical owned fixture the two no-quota cards changed from 156px to 360px, while two cards with quota remained 360px; quota values and displayed no-quota text were unchanged. Major page regions stayed fixed. The 228,191 changed pixels were confined to the documented right-card/adjacent-shadow region. This is not a whole-screen similarity score. Dashboard integration passed 144 responsive cases.

The first Providers-scoped stable capture failed its unchanged fresh-context repeat gate: 206 pixels differed by at most three RGB levels, of which 204 were in the shared header and two in the sidebar; none were in the Providers workspace. The unmasked evidence was retained. The retry did not pass; the complete scoped stable-capture gate remains open. The retry differed in 198 header pixels, with maximum channel delta seven; again the workspace was identical.

A separate six-context diagnostic found the search button's computed geometry and paint inputs unchanged when the original style varied across contexts. Test-only alternate transforms/compositing yielded identical screenshots in the sampled contexts, but the layer variant changed 906 header pixels against the original. This supports a rendering-sensitive hypothesis; it does not establish a unique cause or a safe production fix. No header CSS or visual tolerance was changed.

The gallery retains seven older current images without recapturing them. Review181 predates this change. Actual customer-provider setups, physical/native checks and full concept acceptance remain open.
