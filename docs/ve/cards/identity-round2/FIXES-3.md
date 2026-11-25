# Fixes for the full-look sheet

Edit study.html only. Do not commit. Do not launch Chromium.

1. **Video channel banner.** The D avatar circle covers the banner line, so it renders as "AL UNPICKED." with the comma hidden.
   - Move the Anton line "AI, UNPICKED." up so it sits fully clear of the avatar, with at least 24 px between the text and the avatar circle.
   - The avatar still overlaps the banner's lower-left edge.
   - The full line must be visible.
2. **Browser article hero.** Remove the V4 wordmark between the headline and the Fraunces dek. The site header already carries V9, and the dek sits directly under the headline.
3. **Spare space.** The sheet has about 400 px of empty ink at the bottom. Reduce the sheet height to fit the content plus 60 px of bottom margin, and update render.py's size for "full-look" to match. Keep the no-overflow assert passing.
