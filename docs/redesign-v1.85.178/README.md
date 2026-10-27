# Live summary tile paint / source178

[Eight-screen concept/current gallery](review.html) reuses seven previous current images and all eight original refs. The Live image uses an owned synthetic fixture; the application displays actual collected data.

The four Live summary tiles had strongly tinted borders absent from the reference. For English/dark desktop at widths ≥1536px, their border and background colours now follow sampled source-image regions. Icons keep their existing state colours, and metric values, labels, data, controls and layout are unchanged. Other languages, themes and narrower widths retain their prior treatment.

Fresh web build passed. At 1672×941 the compiled capture repeated byte-for-byte; 69,237 changed pixels are confined to the four tile rectangles, with measured main regions unchanged. On four documented, text-free border/body samples, mean absolute RGB error against the original decreased for every sample. These local samples do not establish whole-screen similarity or a visual baseline. Eight compiled browser cases passed across English/Thai, dark/light and 390/1672px, checking actual API grain and identities, long and unknown values, page overflow and keyboard access to the narrow feed. Both desktop Live disclosures also passed keyboard/focus and visible hit checks.

The remaining seven gallery images were reused, not recaptured. Review174 does not include source178. Full concept approval, physical/native performance and the overall goal remain open.
