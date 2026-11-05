# Cost summary markers

[Compare the reference and the synthetic before/after captures](review.html). The Cost summary sparklines now emphasize existing buckets with recorded calls when there are at most 36 displayed intervals. Empty zero-filled intervals do not gain an activity marker; denser timelines retain their earlier paint. Unknown-priced intervals still break the amount line, and the underlying values, axes, titles and projection eligibility are unchanged. A marker denotes a bucket with recorded calls, not a real-time activity event or proof of ingestion completeness.

The original reference, before and after use a 1672 × 941 viewport; both app captures use the same isolated synthetic fixture with 16 additional historical records, English/dark, DPR 1 and reduced motion. They repeated byte-for-byte. The before image matches the retained checkpoint210 image by SHA-256. The unmasked before/after difference is 614 pixels in `(264, 236)–(1172, 283)`, confined to the three summary chart regions; recorded geometry is equal. The fixture differs from the reference, so this is not whole-page visual acceptance.

Web build and 381 tests passed. The compiled API-backed summary check passed 32 cases across languages, themes, sizes, API/native bases, currency, unknown-price gaps, future and empty intervals, and the 36/37 bucket boundary. It checks that emphasized marks correspond to nonempty recorded-call buckets and that empty buckets do not gain marks. Four unmasked Cost screenshot pairs passed byte-identically with keyboard/API and responsive checks.

The first version of the new density test incorrectly assumed the API sends zero-filled intervals. It failed; inspection confirmed the existing client constructs those intervals. The corrected check compares the actual client timeline to API facts, verifies the unknown-price break, and checks recorded-call emphasis. The initial failed log is preserved in the evidence archive.

Review230 predates this change. Actual providers, physical desktop behavior, Cost completeness and the remaining eight-page concept and release gates remain open.
