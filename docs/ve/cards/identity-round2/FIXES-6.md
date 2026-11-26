# Full look v4: the icon burnt into the lettering

Edit study.html (and NOTES.md) in this folder only. Do not commit. Do not launch Chromium. Keep the no-overflow assert passing.

The founder said: "I wanted the icon burnt in to the lettering itself not behind the lettering". The D must live INSIDE the letterforms of the S3g type, not on the ink behind them.

## 1. S3g: the D burnt into the letters
- Remove the ghost D behind the type. Nothing sits on the ink behind the lettering.
- Place a large D mark (about 85% of the tile, centred slightly right) as a clip layer that only paints inside the glyphs of MAKE / YOUR / MIND/UP:
  - Where the D's left half overlaps a letter, the cream letter is scorched darker, like a branding iron. Use a warm darker cream such as #CFC6B2, or about a 15 to 18% darken of #F4EFE4.
  - Where the D's right half overlaps a letter, the letter turns mint (#7EF0C0).
  - The off-register gap between the halves shows as plain cream letter, so the D reads as the icon inside the type.
  - Outside the D the letters stay plain cream, and UP stays mint. Where the left half crosses the mint UP, darken the mint by the same amount.
- The result must be obviously visible at 300 px and 150 px. The name must stay fully legible: every tint keeps at least 7:1 against the ink. Record the ratios in NOTES.md.
- Use SVG clipPath or mask with the glyph outlines (or CSS background-clip: text with a layered background). The tint must follow the letter edges exactly, with no spill onto the ink.

## 2. Avatar back to plain
The texture now lives in the lettering, so the avatar goes back to the plain cream and mint D on grained ink, clipped to a true circle. Remove the ghost name behind it everywhere.

## 3. Texture check row
Show S3g at 400, 150 and 56 px at true size, and the plain avatar at 110 and 40 px. Change the caption to "the icon is burnt into the name: it reads from 150 px up".

## 4. Rules band
Change the first rule to "D is the icon: avatars, favicon, app icon, video watermark. On the podcast cover it is burnt into the name. Never beside a headline."

## 5. Everywhere
Apply this wherever S3g appears: the kit, the podcast app, the feed grid tile and the 56 px shelf.
