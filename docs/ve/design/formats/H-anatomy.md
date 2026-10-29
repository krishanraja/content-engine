# THE HAND-HELD SCREEN: anatomy (the template)

Format: mind.the.gap, tall 1080x1920, five beats in about 20 s. One real phone in one real hand is the stage. The camera pushes, rolls and re-frames it. A hand-drawn scribble points at the key thing in every beat. Real-world plates sit behind. The brand kit does the annotation.

Everything below is reproducible from `build_plates.py` (derives the plates once) and `build.py` (computes every alignment and writes `index.html`). The producer swaps copy and numbers in the frame functions; geometry follows.

## 1. Canvas and grid

| Item | Value |
|---|---|
| Canvas | 1080 x 1920 |
| Grid | 12 columns, 72 px margins, 56 px columns, 24 px gutters (column n starts at x = 72 + 80n) |
| Content width | x 72 to 1008, but key content stops at x 960 (platform UI covers the right 120 px) |
| Vertical limit | key content stops at y 1640 (platform UI covers the bottom 280 px) |
| Caption zone | x 72, y 1180, w 900, h 320: only a plain dashed placeholder labelled CAPTION is drawn |
| Ambient | 1.5% drift on everything that is not a sticker or stamp (motion only) |

## 2. Layout zones (all px)

| Zone | x | y | w | h | Holds |
|---|---|---|---|---|---|
| Z1 Header | 72 | 79 | 888 | 56 | logo (72, 86, 260 x 30), section pill (690, 79, 270 x 52) |
| Z2 Headline | 72 | 176 | 888 | 270 | Anton, 1 or 2 lines, one coral-swiped word |
| Z3 Dek (F1 only) | 72 | 456 | 600 | 110 | Fraunces italic, 2 lines |
| Z4 Side stack | 684 | 176 | 276 | 370 | up to three contestant stickers (x 712 to 760, y 322 to 520) |
| Z5 Hero stage | 0 | 0 | 1080 | 1920 | phone, hand, glass UI; full bleed, moved by the camera |
| Z6 Glass key band | varies | up to y 1170 | | | the part of the glass that is above the caption zone; every focal item lives here |
| Z7 Caption | 72 | 1180 | 900 | 320 | reserved, nothing key inside |
| Z8 Lower line | 72 | 1516 | 936 | 104 | one of: mint strip (F1, F5), dek (F2, F3 at 72, 1524, 880 wide), label sticker (F4 at 72, 1536, about 860 x 64) |
| Z9 Marquee | 0 | 1736 | 1080 | 62 | coral band, ticker, decoration only |
| Z10 Platform-safe | x > 960 or y > 1640 | | | | decoration only (the marquee, fingers, plate) |
| Z11 Result card (F5) | 72 | 150 | 888 | 410 | threads and flags; stamp zone beneath at (76, 574) to (450, 690) |

Camera table (stage = 941 x 1672 plate, canvas = translate, rotate, scale, origin 0 0):

| Frame | k | rot | tx, ty | Glass UI size (canvas px at this k) |
|---|---|---|---|---|
| F1 | 1.80 | -3.0 | -78.7, 535.9 | 633.6 x 1296 |
| F2 | 1.90 | -10.0 | -267.9, 435.8 | 668.8 x 1368 |
| F3 | 2.10 | -1.0 | about -235, 385 | 739.2 x 1512 |
| F4 | 1.95 | -104.5 | -197.2, 1648.3 | 686.4 x 1404 |
| F5 | 1.55 | -8.0 | -176.8, 695.8 | 545.6 x 1116 |

## 3. Type scale

| Role | Family | Size | Weight | Case | Tracking | Line height |
|---|---|---|---|---|---|---|
| Headline | Anton | 150 to 160 | 400 | UPPER | 0 | 0.88 |
| Country slot (in glass) | Anton | 84 | 400 | UPPER | 0 | 1.0 |
| Big numerals (2/2) | Anton | 136 | 400 | UPPER | 0 | 1.0 |
| Big numerals (0, 1) | Anton | 150 | 400 | UPPER | 0 | 1.0 |
| Stat (3/3), strip numeral | Anton | 100 and 94 | 400 | UPPER | 0 | 1.0 |
| Result numerals (F5 card) | Anton | 46 | 400 | UPPER | 0 | 1.0 |
| Dek | Fraunces italic | 44 | 400 | sentence | 0 | 1.12 to 1.16 |
| Evidence quote (in glass) | Archivo | 44 | 600 | sentence | 0 | 1.25 |
| Prompt text (in glass) | Archivo | 33 | 500 | sentence | 0 | 1.26 |
| Assistant names (in cards) | Archivo, stretch 112% | 34 to 46 | 900 | UPPER | 0 | 1.0 |
| Label (strip, headings, UI) | IBM Plex Mono | 30 | 500 (600 on mint) | UPPER | +0.14em (UI chip .09em, UI row labels .06em) | 1.15 to 1.25 |
| Sticker | IBM Plex Mono | 30 | 600 | UPPER | +0.03em | 1.08 |
| Section pill | IBM Plex Mono | 30 | 500 | lower (mind.the.gap) | 0 | 1 |
| Stamp | IBM Plex Mono | 30 | 700 | UPPER | +0.18em, 3 px border | 1 |
| Part label (above stamp) | IBM Plex Mono | 30 | 500 | lower | 0 | 1 |
| Marquee | IBM Plex Mono | 30 | 600 | as written | +0.02em | 1 |

Nothing in the produced layer is under 30 px. The only smaller text anywhere is the real DeepSeek recording, which is evidence and is never retyped. Production should use the original video at full resolution; the supplied still is 1087 px wide.

## 4. Elements and data slots

| Element | Slot (what the producer supplies per piece) |
|---|---|
| Section pill | section name (mind.the.gap) |
| Headline | up to two lines of 14 or fewer characters, one swiped word |
| Dek | one or two short sentences, British spelling, no sermon |
| Chip on glass (F1) | the exact test chip |
| Prompt card (F1) | lead-in sentence, ACTIVE word, NEXT word |
| Contestant stickers | up to three names |
| Result cards (F2, F3) | assistant name, one flag per country (planted or bare), score numeral |
| Result card (F5) | rows (assistant, one state per country), station labels, the deleted cell |
| Stamp | verdict text, part label |
| Evidence quote | verbatim text, 44 px |
| Real footage (F4) | the recording frame or video, anchor point of the line to underline |
| Stat | numeral plus label |
| Scoring strip | label plus numeral |
| Label sticker | source, name, date |
| Backdrop plate | one of the derived plates per beat |
| Scribble | target rectangle in glass space, shape (loop, underline, arrow, bracket), colour (cream on dark, mint on white) |
| Camera | k, rot, anchor per beat |

## 5. Z-order (back to front)

1. Ink ground #0C1512
2. Backdrop plate (cotton or hardware, graded, parallax, can be rolled with the world)
3. Scrims (top ink gradient for type, bottom ink gradient for the lower line)
4. Glass UI plane (perspective-mapped, clipped to the glass with rounded corners, with a faint mint glow)
5. Phone bezel and hand plate (the glass is cut transparent, so it sits over the UI plane)
6. Glass sheen (soft reflections, clipped to the glass; omitted over real footage)
7. Header (logo, section pill)
8. Overlay type, cards, stickers, stamps, leader lines
9. Scribble (ink keyline, then cream or mint stroke)
10. Marquee band
11. Caption placeholder
12. Grain (fractal noise at 7.5%, with a hole cut over real footage)

## 6. The phone system

- One approved plate (`plates/phone.png`, hand holding a phone, transparent). `build_plates.py` flood-fills the glass, fills the old UI's letter counters, cuts the glass transparent (dilated 3 px, feathered, no cream fringe), upsamples 2x with a light unsharp, and fits four edge lines to find the glass quad: TL (235.8, 50.2), TR (568.4, 114.4), BR (336.2, 836.7), BL (-17.0, 731.8). The BL corner is just outside the plate.
- A UI plane whose pixels equal canvas pixels at that beat's scale is mapped onto the quad with a homography (`matrix3d`). Author in canvas px and text stays legible at any zoom. Overlay positions (scribbles, grain hole) are computed through the same maths, so nothing is eyeballed.
- Notch: 30 glass units deep across u 72 to 282 on a 352 x 720 glass; keep the first 30 x k + 20 px free.
- Real footage: turned 90 degrees clockwise inside the glass, so the camera roll to about -104.5 degrees makes it upright; text lines come out about 3 degrees off horizontal, which reads as handheld. It is placed with `<img>`, never redrawn.
- The plate's left edge cuts the sleeve, so every camera must keep that edge off canvas (build.py `safe()` slides the stage until it is; F4 deliberately leaves the cut below the lower scrim).
- Backdrop: 941 x 1672 plates, each graded toward ink, cotton also flipped; `check_cover()` warns if a corner is uncovered.

## 7. Rules followed (so another designer can reproduce the system)

1. Ground is ink #0C1512. Cream for reading, mint for the answer, flags and primary strip. Coral only as mind.the.gap's colour (pill, swipe, marquee). Coral is never used for a country, warning or failure. A failure is shown by an absence (bare pole, parted thread) and a cream outline stamp.
2. Type on a colour block is ink. Anton headlines are uppercase at 0.88 line height. One swiped word per headline. Fraunces italic is the one human line.
3. Brutal cards: square corners, 2 px border (cream on ink), hard offset shadow, no blur. Stickers: Plex Mono 600 pill, 2 px ink border, tilt between -8 and +5 degrees. Stamps: 3 px border, heavy tracking, verdict on a part (the Xinjiang answer), leader is a thin cream line to an ink dot with a cream ring on the part.
4. Type, logo and layout never tilt. Only stickers, stamps (and physical things: the phone, its screen, the real recording) tilt.
5. Logo: horizontal lockup, 260 px wide, level, on ink, untouched, clear space at least half its height.
6. Printed, not rendered: fractal grain at 7.5% on every dark block, halftone dots on a 14 px grid on every coral block (pill, swipe, stickers, marquee).
7. Exactly one scribble per frame: 8 px stroke, cream or mint, with a 16 px ink keyline (this is what makes mint visible on the white recording), hand-wobbled, pointing at the single key thing. Loops follow the screen's perspective, not the canvas axes. Paths are `pathLength=1` so a draw-on is a single dashoffset animation.
8. The caption zone is empty (every focal item is above y 1180, or in the lower line from y 1516). The lower line is the only element in y 1500 to 1640. Nothing key is beyond x 960 or y 1640.
9. No frame carries an ILLUSTRATION tag or a provenance sticker, although every frame stands on generated plates (Krish, 28 Oct 2026: "Yes remove those."). F4 shows the recording as real footage with the label SCREEN RECORDING · DEEPSEEK · 23 OCT 2026.
10. Voice: British spelling, no em dashes, no exclamation marks, no sermons. The marquee uses the brand's own lines.
11. One focal point per frame: F1 the country slot, F2 the two 2/2 numerals, F3 the missing flag, F4 the forced-labour clause in the real answer, F5 the refusal bubble.
12. The 3 x 2 result is never a table. F2 and F3 show it as planted flags and numerals on cards. F5 shows it as three threads on a time axis (the mind.the.gap device) with flags planted, one thread parted at Xinjiang, a stamp and a dated call.

## 8. Build gotchas (learned the hard way)

- An inline `<svg>` with `overflow:visible` inside a perspective-transformed element hangs headless Chromium. Never use it inside the glass UI (the F5 thread svg outside the phone was also removed to be safe).
- `mask-image` from a local file is blocked under `file://`; clip the glass with `clip-path: path()` instead (rounded corners, plate px).
- CSS `:has(:target)` shows one frame per hash; default shows all stacked.
- Run one render at a time with an isolated `--user-data-dir`. Heavy frames take 50 to 100 s on software GL.
- Do not patch Python source with a script that opens the file for writing before it has the encoded text: a non-ASCII character truncated `build.py` once. Use `encoding='utf-8'` everywhere.

## 9. Image generation spec (for the plates this format needs)

Based on what was actually used: one hand-and-phone cut-out, two backdrops (cotton, hardware). The passport plate was not usable (see "never" below).

**Count and aspect.** Three plates per format: (1) hand holding a phone, (2) backdrop A (the physical subject of the story, here cotton), (3) backdrop B (the machine, here server hardware). All 9:16 portrait. Generate at 2x the 941 x 1672 supplied (at least 1882 x 3344) because the hero push reaches 2.1x and the roll to landscape reaches 2.45x on the backdrop. Add a fourth, a landscape variant of the hold, only if the story needs a phone-on-its-side beat; here the roll does it.

**Plate 1, hand and phone, what the prompt must say:**
- "A real adult hand holding a modern slab smartphone, three-quarter view from slightly above, phone tilted about 15 degrees clockwise, fingertips curled round the right edge, thumb on the left, a dark knit sleeve entering from the lower left. Photographic, warm skin, soft key from upper left."
- "The phone screen is completely blank: one flat uniform colour (flat cream or a keying green), no wallpaper, no icons, no status bar, no app, no text, no reflections of the room." (The supplied plate had a fake chat UI and a DeepSeek wordmark on the glass, which had to be flood-filled out. A flat screen cuts cleanly.)
- "Pure flat black or transparent background. Leave a clear margin of at least 10% on the left so the phone is fully inside the frame." (The supplied plate crops the lower-left corner of the glass and the sleeve at the image edge, which forces every camera to push the left edge off canvas.)
- "Matte black frame, no logo, no brand mark, no camera island visible on the front, one small notch only."
- "Same lighting direction as the backdrops."

**Plates 2 and 3, backdrops, what the prompt must say:**
- "Low-key, almost black ground, shallow depth of field, one hero subject (a cotton boll and cream collar with a mint woven tag, or a server rack with drive bays) in one third of the frame, the rest soft dark bokeh."
- "At least 35% of the frame is calm and dark, for type. Cream, ink-green blacks and mint only; one small mint accent is welcome; no coral."
- "Photographic, matches the hand plate's light. No people."

**What must never be in a generated plate:**
- No baked text of any kind: no words, numbers, serials, labels, watermarks, UI.
- No flags, national emblems, maps, passports or country names. (The supplied passport plate carries a Canadian and a US flag and names, so it can never sit behind a story about Xinjiang or Turkmenistan.)
- No logos or brand marks, including on the phone.
- No faces, no legible documents, no readable screens other than the blank glass.
- No coral. Coral belongs to mind.the.gap's section layer, added in design.
- No drawn arrows, circles or highlights: scribbles are drawn by the designer.
- No second hand and no second phone. One hand, one phone.
