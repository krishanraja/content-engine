# Rules every face-led cover keeps

Read by the cover-art skill before a face-led cover is drawn or checked.

1. **The headline leads** (`docs/production/COVER-STANDARD.md`, points 1 to 6): the largest thing, at most 7 words,
   the quiet series label above it, the series colour, bright over the near-black ground.
2. **The wordmark is the official file**, `apps/cover/public/brand/wordmark.png` in krishanraja/makeyourmindup (sha256
   `f896cc62...`, as `config/brand-palette.json` marks it), scaled only, on the near-black only (it disappears on
   yellow), left-aligned on the headline's edge, under it (Krish, 2026-11-17: "we do need the makeyourmindup wordmark
   somewhere that looks good and aligned properly").
3. **His shoulders are never cut off on the colour** (Krish, 2026-11-17: "the fact that my shoulders cut off is
   unacceptable"). No edge of a photo may show inside the canvas. A cutout touching only its bottom edge (the
   "Restored portrait with natural shoulders") sits on the canvas bottom; any other cutout is placed so every row
   where its alpha meets its sides lies below the canvas bottom; a generated headshot is a full-bleed panel whose edges
   are the canvas edges. The drawing script asserts it.
4. **His face takes about a third of the frame**; the headline still leads in the 3:4 grid crop.
5. **Classy:** generous margins, nothing else on the cover. No glow, neon, gradients, arrows, emoji, badges or logos
   the headline does not name.
6. **Checked where it is seen:** `python3 scripts/channel_safe.py --shape cover_tall` on every tall file.
