# Round 2b: the 56 px show-art grid test

Extend study.html and render.py in this folder only. Do not commit. Do not launch Chromium (the host renders). Never use page.route. Keep every existing sheet working.

## New candidates
Two new podcast covers come from the generated still .scratch/identity-round2/assets/tag-a.png (1024 x 1024).
- The image shows:
  - teal cloth;
  - a theatre lamp at the top;
  - a blank cream luggage tag, front-on and flat;
  - coral thread through the eyelet.
- The tag face spans about x 165 to 893 and y 346 to 678 in the source pixels; measure it in the image to confirm.
- Scale the photo to fill the square cover. Typeset the REAL wordmark onto the tag face, as if printed on it:
  - use the outlines from docs/ve/cards/identity-lab/wordmarks/w0-clean-ink.svg, or the exact Anton build of the variant from study.html;
  - never type it in a different font;
  - keep it inside the tag with a margin of at least 6% of the tag height;
  - multiply blend, so the card texture shows through.

- **T1:** the V6 two-line wordmark in ink, with the D mark (docs/ve/cards/identity-lab/marks/d-face-off-ink.svg, or a version with an ink left half and a mint right half) to its left on the tag. Leave UP in ink: mint on cream fails contrast.
- **T2:** the V4 one-line wordmark in ink across the tag, plus one small round mint sticker dot (the answer) stuck on the tag's top right corner, overlapping the edge slightly.

Also rebuild **S3g**, the council's suggestion: S3a's three huge lines set on grained ink in cream with a mint UP.

## Covers in the test
S1b, S1c, S3e, S3g, T1, T2. Reuse the existing S1b, S1c and S3e compositions exactly.

## Sheet 5 "grid-test" (2400 x 1800)
Show three panels in a row, each a mock podcast app directory grid:
- **Dark mode:** #121212 background, white titles.
- **Light mode:** #FFFFFF background, near-black titles.
- **Dark mode at 150 px.**

Panel rules:
- Each 56 px panel is a 6 x 5 grid of 56 px tiles, with a 12 px gap and a two-line 11 px title under each tile.
- Each grid holds all six candidates in scattered positions, the same positions in each panel. The other 24 slots are stand-in tiles.
- Stand-in tiles are synthetic and never real shows or logos. They imitate typical podcast art:
  - saturated blues and purples;
  - big sans titles;
  - gradient meshes;
  - circuit motifs;
  - a few dark photo-like tiles (CSS gradients, no faces).
  - Give them invented generic titles, such as "The Signal Hour" or "Deep Tech Daily".
- The candidates' title is "Make Your Mind Up".
- The 150 px panel is a 3 x 2 grid of only the six candidates, at 150 px, captioned with their codes.

Below the three panels, add a label row naming which slot holds which candidate, in small DM Mono. Put a line above the grids: "stand-in tiles are invented, not real shows".

## Sheet 6 "tag-covers" (2400 x 1300)
T1, T2 and S3g each at 700 px, with their own 150 and 56 px reductions beside them. Use the same cell layout as show-art-s1.

## render.py
Add "grid-test" (2400 x 1800) and "tag-covers" (2400 x 1300) to the sheet loop, keeping the no-overflow assert.

## NOTES.md
Append a short section covering:
- what each new candidate tests;
- where tag-a.png came from: Higgsfield gpt_image_2_6, job e02eaf9d, a blank tag with no generated text;
- that the stand-in tiles are synthetic.

Static-check paths and syntax.
