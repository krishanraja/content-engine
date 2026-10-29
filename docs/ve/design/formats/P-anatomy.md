# TWO PASSPORTS · anatomy of the template (mind.the.gap module, 1080 x 1920)

A reusable five-frame module for any piece that talks about where an AI lives. Every AI holds two passports: where its company was BORN and where it LIVES (the law and servers it answers to). The module is the same five frames every time; the producer swaps the slots marked `SLOT` below.

Files: `index.html` (five frames, `#f1` to `#f5` show one frame), `f1.png` to `f5.png` (renders), `assets/` (paper, guilloche, rosette, flags, all derived or generated here), `tools/` (scripts that rebuild `index.html` and the assets; `tools/index.template.html` is the editable source). Brand files are read from `../brand/`, the hardware plate from `../plates/`.

Sample data used in the mock is for illustration only. Nothing in it says where any assistant's data physically lives; the LIVES page carries `???` placeholders. The mock's SAMPLE sticker is no longer drawn (Krish, 28 Oct 2026: "It's just the ones that say "Krish's read" or "illustrative" that are stupid because they add no value to the content.").

## 1. Canvas, grid, safe zones

- Canvas 1080 x 1920, ink #0C1512 ground.
- 12-column grid across the content box x 72 to 972 (900 px), gutter 24, column 53. Column starts: 72, 149, 226, 303, 380, 457, 534, 611, 688, 765, 842, 919. Margins 72 left; the right margin is 108 because the platform covers x > 960.
- Baseline unit 8 px.
- Caption zone x 72 to 972, y 1180 to 1500, placeholder labelled CAPTION (translucent so the page and threads read beneath). Nothing in it except page, thread and ground.
- Platform UI: y > 1640 and x > 960 carry decoration only (page, stitch, ground print).

## 2. Layout zones (px, absolute on the canvas)

Shared by every frame:

| zone | x | y | w | h | holds |
|---|---|---|---|---|---|
| header row | 72 | 72 | 900 | 55 | section pill (left) |
| section pill | 72 | 72 | 270 | 55 | `mind.the.gap` |
| headline band | 72 | 140 to 150 | 900 | 153 to 373 | Anton headline (see per-frame) |
| hero page | 72 | 424 to 432 | 900 | 1700 (bleeds off) | passport page |
| caption zone | 72 | 1180 | 900 | 320 | CAPTION placeholder |
| MRZ strip | 92 | 1552 to 1560 | 780 | 78 | two lines of machine-readable zone, on the page |
| platform zone | 960 / 0 | 0 / 1640 | 120 / 1080 | 1920 / 280 | decoration only |

Per frame (absolute coordinates; tilts in degrees, positive is clockwise):

| frame | element | x | y | w | h |
|---|---|---|---|---|---|
| F1 | title (TWO swiped / PASSPORTS) | 72 | 144 | 878 | 373 |
| F1 | dek, 3 lines, right of TWO | 482 | 162 | 490 | 160 |
| F1 | scribble: curly brace | 96 | 546 | 852 | 50 |
| F1 | passport 1 | 72 | 612 | 440 | bleeds |
| F1 | passport 2 | 532 | 672 | 440 | bleeds |
| F1 | portrait ghost, passport 1 and 2 | 144 / 604 | 690 / 750 | 236 | 306 |
| F1 | ribbon (centre line, 52 wide) | 496 to 552 | 628 | 56 | 1292 |
| F1 | sticker BORN (-6) | 350 | 640 | 150 | 68 |
| F1 | sticker LIVES (+4) | 800 | 704 | 172 | 68 |
| F1 | MRZ, passport 1 and 2 | 144 / 604 | 1576 | 360 | 78 |
| F2 | headline BORN | 72 | 146 | 460 | 211 |
| F2 | dek, 3 lines, right of BORN | 578 | 206 | 394 | 160 |
| F2 | sticker PASSPORT 1 OF 2 (+4) | 626 | 392 | 350 | 63 |
| F2 | page (spine left) | 72 | 432 | 900 | bleeds |
| F2 | page label | 164 | 472 | 330 | 30 |
| F2 | USA stamp (-5) | 164 | 524 | 520 | 292 |
| F2 | USA flag | 712 | 524 | 214 | 113 |
| F2 | China flag | 164 | 884 | 156 | 104 |
| F2 | CHINA stamp (+3) | 372 | 842 | 548 | 292 |
| F2 | scribble: loop, centre (646, 990) | 332 | 814 | 628 | 352 |
| F2 | MRZ | 164 | 1560 | 780 | 78 |
| F3 | hardware plate band (masked to ink) | 0 | 0 | 1080 | 520 |
| F3 | headline LIVES | 72 | 146 | 470 | 211 |
| F3 | dek, 3 lines, right of LIVES | 586 | 206 | 386 | 160 |
| F3 | sticker PASSPORT 2 OF 2 (-5) | 120 | 384 | 350 | 63 |
| F3 | page (spine right) | 72 | 432 | 900 | bleeds |
| F3 | page label | 118 | 472 | 440 | 30 |
| F3 | flag slot A | 132 | 550 | 212 | 114 |
| F3 | stamp A, dashed (+4) | 368 | 536 | 520 | 292 |
| F3 | flag slot B | 676 | 900 | 206 | 108 |
| F3 | stamp B, dashed (-3) | 122 | 858 | 520 | 292 |
| F3 | scribble: double underline | 214 | 1114 | 352 | 30 |
| F4 | headline THE GAP (GAP swiped) | 72 | 150 | 752 | 211 |
| F4 | dek, 2 lines, under headline | 72 | 392 | 900 | 108 |
| F4 | tab BORN | 72 | 552 | 328 | 318 |
| F4 | tab LIVES | 644 | 576 | 328 | 318 |
| F4 | stamp in each tab (-3 / +3) | 94 / 666 | 652 / 676 | 284 | 172 |
| F4 | sticker THE GAP (-4) | 422 | 648 | 205 | 66 |
| F4 | scribble: measure arrow | 408 | 730 | 232 | 90 |
| F4 | thread starts, knot, rope end | 236 / 808, 522, 522 | 870 / 894, 1108, 1620 | | |
| F4 | labels THE TEST, THE CALL | 566 | 1094, 1590 | 175 | 30 |
| F4 | next passport rising | 72 | 1696 | 900 | bleeds |
| F5 | headline THE VERDICT | 72 | 140 | 780 | 153 |
| F5 | dek, 2 lines, left | 72 | 300 | 500 | 100 |
| F5 | sticker DUE 2027-03 / 70% SURE (+4) | 606 | 312 | 355 | 124 |
| F5 | page (spine left) | 72 | 424 | 900 | bleeds |
| F5 | page label | 164 | 460 | 250 | 30 |
| F5 | stamp A, coral block (-2.5) | 164 | 504 | 690 | 144 |
| F5 | hero stamp B, coral block (+2) | 142 | 674 | 752 | 208 |
| F5 | evidence card | 142 | 910 | 758 | 236 |
| F5 | scribble: loop, centre (262, 810) | 120 | 730 | 280 | 160 |
| F5 | MRZ | 164 | 1552 | 780 | 78 |

The page component is the one reusable object: 900 x 1700, bleeding off the bottom. Its parts: dark cover peeking (left -8, top -14, right -30, bottom -60, radius 12/64), three stacked leaves offset (8,3), (15,6), (22,9), the sheet (paper texture, guilloche, light, spine shade), the stitched mint spine thread (left, or right for the mirrored passport).

## 3. Type scale

| role | family | size px | weight | case | tracking | line-height |
|---|---|---|---|---|---|---|
| splash (F1 title) | Anton | 212 | 400 | uppercase | 0 | 0.88 |
| headline, one word or short | Anton | 240 | 400 | uppercase | 0 | 0.88 |
| headline, long | Anton | 174 | 400 | uppercase | 0 | 0.88 |
| dek | Fraunces italic | 46 (F5: 42) | 400 | sentence | 0 | 1.16 |
| label | IBM Plex Mono | 30 | 500 | uppercase | 0.14em | 1 |
| section pill | IBM Plex Mono | 30 | 600 | lowercase | 0.04em | 1 |
| sticker | IBM Plex Mono | 30 to 44 (BORN/LIVES 34, PASSPORT n OF 2 30, THE GAP 34, DUE 40) | 600 | uppercase | 0.06em | 1 |
| stamp, top line | IBM Plex Mono | 30 | 600 | uppercase | 0.14em | 1 |
| stamp, main line | IBM Plex Mono | 176 (USA, ???), 118 (CHINA), 96 (0/1 DELETED), 70 (2/2 FLAGGED), 64 (tab stamps) | 700 | uppercase | 0.18em (0.10 and 0.08em on the long verdict lines) | 1 |
| MRZ | IBM Plex Mono | 30 | 500 | uppercase | 0.02em | 1.3 |
| evidence quote | Archivo | 44 | 500 | as spoken | 0 | 1.2 |
| flag slot mark and ghost AI | IBM Plex Mono | 64 and 132 | 700 | uppercase | 0 | 1 |

Minimum text on the canvas is 30 px; the evidence quote is 44 px. Colour: type on cream, paper, coral and mint is always ink; type on the ink table is cream. Mint is never type.

## 4. Elements and data slots

`SLOT` marks what the producer supplies per piece. Sample values are what the mock shows.

| element | frame | slot? | notes |
|---|---|---|---|
| ground: ink table, light bands, rosette print, 7% grain | all | fixed | rosette opacity 0.085 to 0.13 |
| section pill `mind.the.gap` | all | fixed | coral block, ink type, halftone |
| title words | F1 | SLOT `TITLE_SWIPE_WORD` = TWO, `TITLE_WORD_2` = PASSPORTS | one swiped word |
| F1 dek | F1 | SLOT `F1_DEK` = "Every AI carries two. Where it was born, and where it lives." | |
| passports 1 and 2, ghost portrait with `AI` | F1 | fixed | portrait ghost text is the word AI |
| stickers BORN, LIVES | F1 | SLOT `STICKER_P1`, `STICKER_P2` | |
| ribbon | F1 | fixed | mint, swallow-tail cut |
| bracket scribble | F1 | fixed | points at the pair |
| headline `BORN` | F2 | SLOT `BORN_WORD` | |
| dek | F2 | SLOT `BORN_DEK` = "Where the company behind it was founded." | |
| sticker `PASSPORT 1 OF 2` | F2 | SLOT `STICKER_BORN` | |
| page label `HOME COUNTRY` | F2 | SLOT `LABEL_BORN` | |
| BORN stamps (up to 3) | F2 | SLOT `BORN_STAMPS[]`: assistants, country text, flag | sample: Claude and ChatGPT / USA; DeepSeek / CHINA |
| flags | F2, F4 | SLOT `FLAG_SRC` | printed look: multiply plus 7 px halftone |
| MRZ lines | all pages | derived from slots | uppercase, `<` filler |
| loop scribble | F2 | SLOT target = the stamp that matters | |
| headline `LIVES` | F3 | SLOT `LIVES_WORD` | |
| dek | F3 | SLOT `LIVES_DEK` = "Where it runs, and whose law it answers to." | |
| sticker `PASSPORT 2 OF 2` | F3 | SLOT `STICKER_LIVES` | |
| page label `COUNTRY OF RESIDENCE` | F3 | SLOT `LABEL_LIVES` | |
| LIVES stamps (up to 3) | F3 | SLOT `LIVES_STAMPS[]` with `state`: STAMPED, SAMPLE or BLANK | sample: all SAMPLE, shown as `???` in dashed outline |
| hardware plate band | F3 | SLOT `LIVES_BACKDROP` | any dark plate; masked to ink |
| underline scribble | F3 | SLOT target = the blank for the AI in focus | |
| headline `THE GAP` | F4 | SLOT `GAP_WORD`, swiped word | |
| dek | F4 | SLOT `GAP_DEK` = "Born in one place. Answering to rules in another." | |
| paper tabs and their stamps | F4 | SLOT `TAB_BORN`, `TAB_LIVES` (assistant, country or `???`) | sample: DeepSeek / CHINA, DeepSeek / ??? |
| sticker `THE GAP` | F4 | SLOT `GAP_STICKER` | |
| threads, knot, rope | F4 | fixed | BORN thread solid, LIVES thread dashed until the test |
| labels `THE TEST`, `THE CALL` | F4 | SLOT `KNOT_LABEL`, `END_LABEL` | |
| measure-arrow scribble | F4 | fixed | spans the gap between the tabs |
| next passport rising | F4 | fixed | hand-off to F5 |
| headline `THE VERDICT` | F5 | SLOT `VERDICT_HEAD` | |
| dek (the call line) | F5 | SLOT `CALL_DEK` = "Where an AI lives may decide what it can say." | an editorial claim: the owner supplies it |
| dated-call sticker | F5 | SLOT `CALL_DATE` = 2027-03, `CALL_CONFIDENCE` = 70% | format `DUE yyyy-mm` / `nn% SURE` |
| page label `COTTON TEST` | F5 | SLOT `TEST_LABEL` | |
| result stamp A | F5 | SLOT `RESULT_STAMPS[]`: assistants, score, verdict word | sample: Claude, ChatGPT / 2/2 / FLAGGED |
| hero stamp B | F5 | SLOT `HERO_STAMP`: assistant, runs, score, verdict word | sample: DeepSeek / 3 of 3 runs / 0/1 / DELETED |
| evidence card | F5 | SLOT `EVIDENCE`: label, quote | sample: "Xinjiang answer, replaced with" and the DeepSeek reply, verbatim |
| MRZ second line | F5 | SLOT `TEST_SUBJECTS` = COTTON, XINJIANG, TURKMENISTAN | |
| loop scribble on the score | F5 | SLOT target = the number that moved | |
| caption placeholder | all | engine | |

## 5. Z-order (bottom to top, the same in every frame)

0 ground (ink gradient, light bands) and rosette print; F3 only: 1 hardware band, 2 ink gradient over it. 3 stitched spine thread (inside the page). 4 page furniture: labels, flags, flag slots, ghost portrait, MRZ. 6 stamps (multiplied into the paper, rough-edge filter). 8 evidence card. 10 page (cover, stacked leaves, sheet; paper texture, guilloche multiplied, light, spine shade) and, in F4, the paper tabs. 12 threads (F4). 20 headline and dek. 22 ribbon (F1). 30 section pill. 40 stickers. 45 scribble layer (ink keyline path under mint path). 50 grain at 7%. 51 fine grain at 3%. 60 caption placeholder.

(Items 3 to 8 sit inside the page's own stacking context; the numbers show their order within it.)

## 6. Rules followed (so another designer can reproduce the system)

Brand grammar
1. Ink #0C1512 ground, cream #F4EFE4 for type on ink, mint #7EF0C0 for the brand thread, ribbon, knot and scribbles, coral #FF6A4D only as this section's colour: pill, stickers, swipe, verdict stamps, threads. Type on any colour block is ink. Mint is never type and never sits on cream without its ink keyline.
2. Coral is never a country, warning or failure here. The two verdict stamps are the same coral block (so colour carries no pass or fail); the words and the size carry the meaning. Both threads are coral; the LIVES one is dashed until the test.
3. Anton is always uppercase at line-height 0.88, set as large as the line allows (one word at 240 px, two words at 174 to 212). One swiped word per headline, skewed 8 degrees. Fraunces italic is the one human line under the loud word. Plex Mono is labels, stamps, stickers, numbers and the MRZ. Archivo is only the evidence quote.
4. Kit of parts as drawn in the book: square brutal card with 2 px ink border and a hard 10 px offset shadow (no blur), pill stickers tilted between -8 and +5 degrees with a 5 px hard shadow, stamps with a 3 px border and 0.18em tracking, highlighter swipe, halftone dots on a 14 px grid over every coral block. Soft shadows appear only on photographed things (the paper pages and tabs), never on kit parts.
5. Printed, not rendered: 7% fractal grain over every frame, a rosette ground print (the passport security-print language), 3% fine grain on top.
6. Only stickers and stamps tilt. Pages, tabs, type and layout are level; the passports are shot flat-lay square to the camera. The ribbon and threads are objects, not layout, so they curve.
7. No logo in the module (the host piece owns it). If the host wants it here, use the horizontal lockup from `brand/logos/` on ink, level, untouched, with half its height clear around it, at the right end of the header row.
8. Voice: British spelling, no em dashes, no exclamation marks, no sermons. The dated call uses the book's own format (`DUE yyyy-mm`, `nn% SURE`).
9. No frame carries an ILLUSTRATION tag, although the paper and backdrop come from generated plates (Krish, 28 Oct 2026: "Yes remove those.").

Screen
10. Hero subject fills the frame outside the caption zone: the passport page is 900 wide and bleeds off the bottom. A crude count of canvas outside the caption zone that carries page, type, stamps or thread (bright marks, 31 px reach) gives F1 77%, F2 84%, F3 83%, F4 80%, F5 85%. F1 is the one under 80% by that count; the rosette ground print covers all of it but is not counted because it is deliberately faint.
11. One focal point per frame: F1 the two words, F2 the stamp that slaps last, F3 the dashed `???` stamps, F4 the knot, F5 the hero stamp.
12. One scribble per frame, 8 px mint stroke with a 17 px ink keyline, hand-wobbled, pointing at the single most important thing: F1 the pair, F2 CHINA, F3 the blank, F4 the gap, F5 0/1.
13. Dek placement: to the right of a single short word (up to five letters), under a longer headline.
14. Stamps on paper: label stamps (BORN, LIVES) are ink outlines multiplied into the paper; verdict stamps are coral blocks with ink type; unknowns are dashed outlines with `???`. Stamps judge a product, never a person.
15. A stamp never sits in the caption zone. The MRZ lines sit in the strip just under it (y 1552 to 1640).
16. Do not claim where data lives. The LIVES page is `STAMPED` only with sourced data; otherwise `SAMPLE` or `BLANK`, drawn as a dashed `???` that claims nothing. No sticker or disclaimer goes on top.
17. No tables, grids of cells or spreadsheet looks: the three results are stamps and a card laid like paper on a desk, not rows.

Motion hooks (see `motion.md`): every stamp, sticker and scribble is its own layer so it can slap or draw on; the page, ribbon and threads are separate layers for parallax.

## 7. Module parameters

Every slot the producer fills. Sample values in brackets.

Countries and flags
- `BORN_STAMPS[]` (up to 3): `country_text` (USA, CHINA), `assistants[]` (Claude and ChatGPT; DeepSeek), `flag_src`.
- `LIVES_STAMPS[]` (up to 3): same shape, plus `state` (STAMPED, SAMPLE, BLANK). Sample: both SAMPLE, `country_text` is `???`.
- `FLAG_SRC`: an SVG flag set at 3:2 or 19:10, one file per country. The mock uses simplified SVGs generated in `assets/flag-usa.svg` and `assets/flag-china.svg`; production should use a licensed open set (for example flag-icons, MIT) with the rule: printed look (multiply, 7 px halftone, saturation 0.88), never inside a stamp, never recoloured. Flag slot for an unknown country: dashed hatched box with `?`.

Assistants
- `ASSISTANTS[]`: name, born country, lives state. Sample: Claude (USA), ChatGPT (USA), DeepSeek (CHINA). Names appear only in the stamp top lines, tab stamps and result stamps, uppercase mono.
- `FOCUS_ASSISTANT` (DeepSeek): decides which stamp the F2 loop, F3 underline and F5 loop point at.

Stamp texts
- Label stamps: top line = assistants joined with ` · `; main line = country text (max 6 characters at 176 px, 5 at 118 px).
- Verdict stamps: top line = assistants plus runs; main line = `score + verdict word` (sample: `2/2 FLAGGED`, `0/1 DELETED`). Verdict words are one word, uppercase, 8 characters or fewer.
- Placeholder stamp: `???` in a dashed outline.

Text slots
- Headlines: `TITLE_SWIPE_WORD`, `TITLE_WORD_2`, `BORN_WORD`, `LIVES_WORD`, `GAP_WORD`, `VERDICT_HEAD`.
- Deks: `F1_DEK`, `BORN_DEK`, `LIVES_DEK`, `GAP_DEK`, `CALL_DEK`.
- Labels: `LABEL_BORN` (HOME COUNTRY), `LABEL_LIVES` (COUNTRY OF RESIDENCE), `TEST_LABEL` (COTTON TEST), `KNOT_LABEL` (THE TEST), `END_LABEL` (THE CALL).
- Stickers: `STICKER_P1`, `STICKER_P2`, `STICKER_BORN`, `STICKER_LIVES`, `GAP_STICKER`.
- Evidence: `EVIDENCE.label`, `EVIDENCE.quote` (verbatim, attributed in the label, 44 px, three lines at most).
- `TEST_SUBJECTS` (COTTON, XINJIANG, TURKMENISTAN) feeds the last MRZ line.

Dates and numbers
- `CALL_DATE` (2027-03, format yyyy-mm), `CALL_CONFIDENCE` (70%, whole numbers).
- Scores (`2/2`, `0/1`) and `RUNS` (3 of 3) come from the test log, never rounded.

Images
- Paper: `assets/paper.jpg` (derived from blank regions of `plates/passportsWide.png`, see section 8).
- Backdrop for F3: `LIVES_BACKDROP` (`plates/hardware.png`, cropped to the band, ink gradient over it). Any other dark plate works if the headline holds 4.5:1.
- Ribbon, threads, guilloche, rosette: generated vector, no slot.

Fixed copy (change only with the owner): `mind.the.gap`, `CAPTION`.

## 8. Image generation spec (plates this module needs)

What was used in the mock: only blank paper from the approved passport photograph (rectangles 400,150 to 780,255; 1270,300 to 1455,380; 985,372 to 1250,432 of `plates/passportsWide.png`, flattened and re-tiled by `tools/make_paper.py`) and `plates/hardware.png`. No CANADA, USA, flag or emblem pixel from the passport plate appears in any frame. Production should generate its own so the pages are real photographs end to end.

Rules for every prompt
- Say it in the prompt: no text, no letters, no numbers, no flags, no coats of arms, no eagle, no maple leaf, no animals or plants, no national emblem, no logo, no watermark, no portrait box, no ghost `AI` label, no hologram, no stamp, no hands, no pens, no props. Say it again as a final sentence. The module adds every word, flag and stamp live.
- Camera perfectly perpendicular (flat lay, top-down), page square to the frame, no perspective, no tilt (reject any plate where the page edge is more than 1 degree off vertical).
- Table: dark ink-green wool felt close to #0C1512, fine grain, soft raking light from the top left with gentle venetian-blind shadow bands.
- Palette: warm cream paper close to #EEE3CE, mint #7EF0C0 for thread and ribbon, nothing else saturated.
- Guilloche is generic: fine pale teal-grey wavy lines across the lower 45% of the page and a faint concentric rosette upper right; it must read as security paper, not as any country.
- Aspect 9:16 portrait, at least 2160 x 3840, PNG. Generate 4 candidates per prompt; keep the one with the cleanest blank paper.
- After generation: run OCR and a visual check for letters, digits, emblems and flags; any hit means reject, never retouch.

Plates (count: 3 required, 1 optional)

1. `passport-page-spine-left.png` (required). Prompt: "Photorealistic top-down flat lay of a single open passport page, portrait, camera perfectly perpendicular, page square to the frame and filling 86% of the frame width, bleeding off the bottom edge. Warm cream cotton security paper with a fine embossed crinkle texture. Generic pale teal-grey guilloche line-work only: dense fine wavy lines across the lower 45% of the page and a faint concentric rosette in the upper right. Otherwise completely blank. On the left edge the spine: a braided mint-green cord stitched through the fold, with a thin sliver of the facing page. On the right edge a stack of 4 to 6 page edges and a dark ink-green cover peeking out by a few millimetres, rounded outer corners. Dark ink-green wool felt table, fine grain, soft raking light from the top left with gentle shadow bands. Everything sharp. No text, no letters, no numbers, no flags, no emblems, no animals, no plants, no portrait box, no stamps, no hands, no props."
2. `passport-page-spine-right.png` (required). The same prompt with the spine and stitching on the right edge, the stack of page edges and cover on the left, and the light from the top right. Generate it; do not mirror plate 1 (the light would flip).
3. `two-passports-ribbon.png` (required, the F1 hero if a single photograph is preferred). Prompt: "Photorealistic top-down flat lay of two identical open passport pages side by side on dark ink-green felt, both square to the camera, the second 60 px lower than the first, spines on the left of each. A woven mint-green grosgrain ribbon 52 mm wide lies in the gap between them, running top to bottom with a gentle S-curve and a swallow-tail cut at its top end, no shadow from other objects across it so it can be keyed against the felt. Pages blank cream security paper with generic pale teal-grey guilloche only. [then the shared no-text sentence]". Used as is, or cut: the ribbon keys cleanly against the felt because mint on near-black has no overlap in saturation.
4. `paper-macro.png` (optional). Prompt: "Macro top-down photograph of blank warm cream cotton paper with a fine embossed crinkle, even light, no edges, no lines, no guilloche, no stains, no text." Aspect 1:1, 4096 x 4096. Only needed if the pages in plates 1 to 3 are not clean enough to build the seamless texture.

Backdrop plates are not needed: F3 uses the existing hardware plate. If another country-neutral backdrop is wanted, keep it dark enough for a cream headline.

## 9. Rebuilding

- `python tools/make_paper.py` rebuilds `assets/paper.jpg`.
- `python tools/make_vectors.py` rebuilds `assets/guilloche.svg`, `rosette.svg`, `flag-*.svg`.
- `python tools/build.py` regenerates `index.html` from `tools/index.template.html` (scribbles, ribbon and threads are generated there).
- `bash tools/render.sh f1 f2 f3 f4 f5` renders the PNGs with headless Chromium, one at a time, retrying on a hang.
