# Round 2 fixes after the host render

Edit only study.html (and NOTES.md if values change) in this folder. Do not commit. Do not launch Chromium.

The host render measured scroll size against viewport:
- wordmark-spacing: 2400x2009 in a 2400x2000 viewport;
- show-art-s1: 2400x1805 in 2400x1800;
- show-art-s3: 2400x1805 in 2400x1800.

render.py asserts no overflow, so every sheet must fit its viewport exactly.

1. wordmark-spacing: the V10 panel is clipped at the bottom by about 9 px. Tighten vertical rhythm so all ten variants fit inside 2000 px, with at least 40 px of ink below the last panel.
2. show-art-s1 and show-art-s3 layout:
   - The 700 px covers currently touch the left and right sheet edges.
   - The 150/56 px reductions sit flush against the next cover, so it is unclear which cover they belong to.
   - Rebuild as a 3 x 2 grid of cells inside the same 48 px side margins the title uses. Each cell holds:
     - its 700 px cover;
     - a 24 px gap;
     - a column on the right with its own 150 px reduction above its own 56 px reduction (16 px apart, top aligned with the cover);
     - the caption under the cover.
   - Keep at least 40 px between cells. If 3 across does not fit in 2400 px, scale the large cover to 600 px and say so in the caption header. Keep the reductions at true 150 and 56 px.
3. Every cover, including the ink-ground S3e and the S1 covers whose burn ends in ink, gets a 1 px rgba(244,239,228,0.22) hairline outline. Without it the square edge disappears into the ink sheet.
4. Every sheet must fit its viewport with no overflow. Keep body margin 0 and overflow hidden on html and body only after the layout genuinely fits; do not hide real clipping.
