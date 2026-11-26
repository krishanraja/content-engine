# A/B: the photo burn and feed templates (for Krish's decision, 24 Nov 2026)

Krish shared The Rundown AI's Instagram grid and said: "I wouldn't mind some burnt gradients and typography like this. That could be a nice sophistication upgrade." Then: "I don't want to lose too much personality but I also want this to come across as a sophisticated media business."

Build `render/compare.html` and `render/compare.py`. The `.py` reuses the Playwright launch and `anonymous_driver` from `render.py`. They produce the files below in `.scratch/why-ladder/evo/compare/`. Read all values from `tokens.json` and `piece.json`, plus the additions listed under each variant. The locked floor (`makeyourmindup-look-floor.md`) applies to everything except the one change being tested.

## The one change being tested: the burn
- A full-bleed photo may burn into ink: a vertical photo-to-ink gradient from ink at 0% opacity to ink at 100%. It covers the bottom 45% of the photo on 9:16, and the bottom 55% on 4:5.
- The grain continues over the burn.
- This is the ONLY gradient allowed. There are no colour gradients and no gradient text, ever.
- Put it in one function named `burn()`, so a lint can allow exactly that.

## Outputs
1. **`cover-A.png` (1080x1920).** The current locked cover, exactly as `ladder.html` scene 1 draws it. Copy `.scratch/why-ladder/evo/scene-1.png` if identical.
2. **`cover-B.png` (1080x1920).** The same content with these changes:
   - The photo `evo-cover.png` is scaled about 1.15 so the table and record fill the upper 65%.
   - The burn starts at about y900 and reaches full ink by y1500.
   - The series eyebrow `p.section_label` is DM Mono lower-case, letter-spaced 0.32em, cream, 26 px. It sits directly above the headline.
   - The Anton headline is unchanged.
   - The callout ("the new producer" / "0:30") is unchanged.
   - The wordmark sits small, bottom-right, as now.
3. **`compare-cover.png` (2200x1920).** A and B side by side with a 40 px white gutter. Under each, a small DM Mono label: "A  locked" and "B  burn + eyebrow".
4. **Three 4:5 feed tiles (1080x1350)**, a template test for the Instagram grid. Each carries the same piece (`p.title`), and each has the mark (`.scratch/why-ladder/assets/mark.png`, 56 px tall, unaltered) at top-left, 40 px in. That mirrors The Rundown's fixed-corner mark; it is the mark, not the wordmark.
   - **`tile-A.png`:** the photo on the top 55%, solid ink below with grain. The eyebrow is DM Mono cream at normal tracking. The headline is Anton cream, 96 px, at most 3 lines.
   - **`tile-B.png`:** the photo full-bleed with the burn (bottom 55%). The eyebrow is letter-spaced 0.32em. The headline is Anton cream, 96 px, at most 3 lines, bottom-aligned 64 px from the bottom.
   - **`tile-C.png`:** as B, but the headline is Fraunces 600 cream, sentence case as written in `piece.json`, 68 px, at most 4 lines. This is the calmer "media business" option. Anton does not appear on this tile.
5. **`compare-tiles.png` (3320x1350 plus label space).** Tiles A, B and C side by side with 40 px gutters, labelled "A  locked", "B  burn + Anton" and "C  burn + Fraunces".

## Rules
- Never alter photos, marks or the wordmark: scale, crop and position only.
- No shadows, blur, glow or translucent panels.
- Nothing overlaps or is cut off.
- Keep the 4:5 tile's key content inside the centre 1080x1080 square too, because the Instagram grid crops tiles to 3:4 and older layouts crop them to 1:1. Check both crops.
