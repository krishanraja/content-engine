# Concept a: the money trail as a physical document

**Governing idea:** every story prints out of a branded makeyourmindup printer as a statement in the series colour. Each line feeds up on the beat, real logos and one-word stamps (PAID, SUING) slam onto it, and the story's question prints as the unresolved total with a big "?" stamp. Then the slip is torn off into Krish. The outro prints the closing slip: where to read it, the comment question and the next issue. It is signed with the wordmark stamp, and the printer drops away.

Files: `mock.html` (self-contained; logos and the Archivo Black font are inlined as data URIs), `mock.src.html` + `build.js` (source and inliner), `shots.js` (contact sheets), `page.js` (page checks at 400 px and 1366 px), `logos/` (logos copied or extracted unaltered from the repo).

## Intro timeline (16:9: 3.6 s, 108 frames; 9:16: the same beats at 0.875x, 3.15 s)

| 16:9 s | Picture |
|---|---|
| 0.00 | Ink room. The printer plate sits along the bottom, carrying the MAKE YOUR MIND/UP wordmark and the series pill. The slip's header ("Money trail", 12 Oct 2026) is already feeding out. |
| 0.45 | Row 1 feeds up: **You -> [Suno logo]**, "for your song". The logo stamps on and the arrow draws. |
| 0.95 | Row 2: **[Suno] -> [Warner logo]**, "since 9 September". A mint **PAID** stamp slams on at about 1.25. |
| 1.50 | Row 3: **[Suno] -> [Sony logo] [Universal Music Group logo]**, "want paying too". A coral **SUING** stamp lands at about 1.80. The paper scrolls up as it feeds, like a real receipt. |
| 2.10 | Dashed total line, then the question feeds up huge: **Who gets paid for AI songs?** |
| 2.55 | A coral round **?** stamp slams beside it, then keeps a slow wobble because it is unresolved. |
| 3.10 | Tear-off: a short tug down, then the slip is yanked up out of frame. The plate drops away. |
| 3.60 | Clean ink frame, then cut to Krish: "Here's what you need to know..." |

## Outro timeline (16:9: 5.0 s; 9:16: 0.9x, 4.5 s)

| 16:9 s | Picture |
|---|---|
| 0.00 | The same plate. The "Closing slip" header feeds out. |
| 0.40 | "Full story, free" and **makeyourmindup.ai** (mint highlighter swipes under it at about 0.6). |
| 1.10 | Speech bubble, "Tell me in the comments", then **Should a singer get paid?** |
| 1.80 | **Next: Wednesday**, with a lilac **under.the.hood** pill stamped on at about 2.0. |
| 2.45 to 2.75 | The ink wordmark block **MAKE YOUR MIND/UP** stamps on as the sign-off: the biggest thud. |
| 3.15 to 5.0 | The printer drops away and the finished slip settles, free and slightly straightened, held for reading. |

The outro never says "I'm Krish", and neither card has an AI-disclosure line.

## Constant vs varying (the system)

- **Constant:** the ink room; the branded printer plate; paper feeding up on a half-second beat grid; dashed tear lines; three ledger rows (from -> to, one stamp word, an optional small note); the question as the unresolved total with a round "?" stamp; the tear-off into Krish. On the outro, the closing slip (link, comment question, next issue, wordmark stamp, printer drops away). The cue sheet is also constant.
- **Per series:** the paper colour (yellow #FFD84D, lilac #B7A6FF, coral #FF6A4D) and the pill. Stamp colours come from the other brand colours so they always contrast with the paper.
- **Per story:** the rows (words or real logos), the stamp words, the question, the comment question and the next issue. Everything is data: `STORIES.monday` / `STORIES.friday` in the source. These would become Remotion props.
- **Friday demo** (coral, mind.the.gap):
  - [OpenAI logo] ChatGPT -> Lots of brains, stamped PICK ONE.
  - [Anthropic logo] Claude -> Lots of brains, stamped PICK ONE.
  - $20 -> 7 cents, "same pile of AI words", stamped CHEAPER.
  - Total: "Why are there suddenly so many AIs?"
  - Outro: "Pick your AI, or let the app?" Next: Monday, follow.the.money.
  - All facts are from `2026-10-09-draft-script.md`.

## Audio cue sheet (16:9 times; 9:16 scales with the picture)

Music bed: **NO CURVES (Instrumental Version)**, the only track in `config/music-library.json`. The track and its levels are both *proposed, not approved*. Wanted character: a dry, driving beat with a mechanical pulse that the print feed and stamps can lock to. The beats are written on a 0.5 s (120 bpm) grid. Once the track's tempo is measured, the grid is retimed to its downbeats rather than the track being bent to fit.

| Time | Music level | Sound design |
|---|---|---|
| Intro 0.00 | bed in at -16 LUFS (loud) | short paper-feed motor whirr |
| 0.45 / 0.95 / 1.50 | -16 | dry dot-matrix line-feed zip per row, on the beat |
| 0.55 / 1.05 / 1.60 | -16 | soft rubber thud per real logo |
| 1.27 / 1.82 | -16 | heavy stamp for PAID and SUING (SUING pitched lower) |
| 2.10 / 2.55 | -16 | long zip for the question; "?" stamp lands on a music hit |
| 3.10 to 3.60 | 0.5 s ramp down to -31 LUFS | paper rip into the duck |
| 3.60 onward | -31 under the voice | Krish speaking |
| Outro -2.0 to 0 | -31 under the voice | Krish's last line, "Make your mind up." |
| Outro 0.0 to 0.8 | 0.8 s ramp up to -18 LUFS | the same feed whirr as the intro (the bookend) |
| 0.40 / 1.10 / 1.80 | -18 | line-feed zip per line; marker squeak at 0.62; light stamp on the pill at 1.98 |
| 2.75 | -18 | wordmark stamp: the biggest thud, on the final music hit |
| 3.15 | -18 | low clunk as the printer drops away |
| 4.0 to 5.0 | the bed ends on a button, falling toward -30 | none |

The final mix target from the config is -14 LUFS integrated with -1 dBTP true peak. The cue sheet is drawn in the mock under the frames, with a moving playhead.

## Logos used (real files, never redrawn)

| Company | File |
|---|---|
| Suno | `docs/plans/2026-10-12-monday/logos/suno-logo-cream.svg` |
| Warner Music Group | the WMG symbol, extracted byte-for-byte from the first embedded image in `cover-partners-cream.svg` |
| Sony Music | the Sony Music symbol, extracted from `cover-suing-cream.svg` |
| Universal Music Group | the UMG logo, extracted from `cover-suing-cream.svg` |
| OpenAI (Friday) | `docs/plans/2026-10-09-friday/logos/openai-symbol-cream.svg` |
| Anthropic (Friday) | `docs/plans/2026-10-09-friday/logos/anthropic-symbol-cream.svg` |

- **Why extract:** the combined partner file also carries BMG, which the scripts never name, so the WMG symbol is used on its own.
- **Recolouring:** the cream marks are turned to ink for the coloured paper with CSS `filter: brightness(0)`. This keeps the shapes exact.
- **Name labels:** small plain-text labels ("Warner", "Sony", "ChatGPT", "Claude") sit under the symbol-only marks so a 12-year-old can read them. They are text, not part of the logos.

## Lengths

| Cut | Intro | Outro | Added in total |
|---|---|---|---|
| 16:9 | 3.6 s | 5.0 s | 8.6 s |
| 9:16 | 3.15 s | 4.5 s | 7.65 s |

The 9:16 cut would take the 95 s short to about 102.7 s. Krish has not yet ruled whether the 90 s cap counts the intro and outro.

## Not done / caveats

- No audio file. The cue sheet only describes the sound. NO CURVES has no measured BPM, cue points or LUFS yet (all null in the config), so the beat alignment is a target, not a measurement.
- Fonts: everything in frame is set in Archivo Black, embedded from `scripts/quick-edit/fonts`. The variable Archivo and Anton faces from `fonts.css` were not used.
- The second brand sting is not shown. If Krish wants it as well, it could play for about 1 s over the ink before the plate appears, but that would push the short further past 90 s.
- The 9:16 intro's header and first row scroll up into the top 220 px platform zone at the end. This is intentional: they were already read lower down, and the key end content (rows 2 and 3, the question and the "?") stays inside the safe zone.
- In the Friday 16:9 demo, "Lots of brains" is fitted beside its stamp and ends up fairly small. A real Friday build would use shorter words or a smaller stamp.
