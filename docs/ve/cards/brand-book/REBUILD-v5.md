# Rebuild the brand book for v5, plus two Library touch-ups

Write only inside docs/ve/cards/brand-book/ and docs/ve/cards/library/. Do not commit. Do not launch Chromium (the host runs book.py).

## A. Library touch-ups (docs/ve/cards/library/)
1. **social-clip-cover.** The jukebox photo stops in a hard horizontal edge above the ink, and its left edge looks smeared or stretched.
   - Use object-fit cover with no stretching.
   - Run the burn so the photo fades into the ink with no visible edge (ink 0 to 100% over the lower part of the photo area, continuing into the ink below).
   - The floor says: never a hard edge between photo and ink.
2. **Banned phrase.** "deep dive" is a banned phrase in the voice check. Everywhere it appears in library.html and library.json (the weekly edition slots and any notes), use "piece" or "main piece" instead: for example "[Second piece]" and "This week's three pieces".

## B. The brand book (docs/ve/cards/brand-book/)
content.md has been rewritten for the locked v5 look. It is the only source of words; keep every word verbatim and add none, apart from figure captions built from the template's own name, platform and size. The previous words are in content-v2.0-24nov.md, for reference only.

Rebuild:
- **assets.json**, so every `[image: library <id>]`, `[image: board full-look]` and `[image: still <name>]` in content.md resolves:
  - library items: ../../../../.scratch/library/out/items/<id>.png;
  - the board: ../../../../.scratch/identity-round2/out/full-look.png;
  - stills: ../../../../.scratch/why-ladder/assets/<name>.png.
  - The `[grid: ...]` on The Library page uses each family sheet in ../../../../.scratch/library/out/sheets/<family>.png, captioned with the family name and its template count from library/library.json.
- **book.html**, laid out in the v5 look: ink pages with grain, cream reading pages where a section suits it, Anton headings, Fraunces body, DM Mono labels, no shadows, no stickers. It keeps the existing page model, landscape pages one per `##`, so book.py's export and the page count checks still work.
  - Keep book.py's offline export as it is: no page.route.
  - Remove the old v4 asset slots (tile-B, surface ..., web-1440-..., scene-1..6) from assets.json if nothing references them now.
- **manifest.py:** keep it in step if it lists assets.

Make sure nothing on any page is clipped or overflows. The host checks this with a per-page bounding-box test, so leave margins.
- Body text at least 21 px.
- Image-heavy pages show at most 6 images, each large enough to read.
- The Library page shows the 10 family sheets as a grid of thumbnails with captions.

## Report
List:
- the files changed;
- the page count;
- any `[image:]` that did not resolve.
