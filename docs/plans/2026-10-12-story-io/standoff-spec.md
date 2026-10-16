# Concept c: the cast and the stand-off

**Governing idea:** every story is a fight card: the players square up in two flat colour corners, one of them changes state, and the question lands as the round nobody has won yet.

## Intro (16:9 3.5 s, 105 frames; 9:16 3.2 s, 96 frames)
| 16:9 s | 9:16 s | Frame |
|---|---|---|
| 0.00 | 0.00 | Hard cut in. Split screen: mint corner (brand, always the left/top corner) against a series-colour corner (yellow). Ink brand strip: MAKE YOUR MIND/UP + `follow.the.money` chip. Suno's real logo slams into the mint corner (4-frame overshoot, whole frame jolts). Corner labels: "AI song app" / "Music giants". |
| 0.17 / 0.30 / 0.43 | 0.15 / 0.27 / 0.39 | Three ink fighter cards slide in hard from the right: Warner, Universal, Sony (real logos + name), each stamped SUING (coral). |
| 0.60 | 0.55 | VS disc stamps onto the seam. |
| 0.95 to 1.20 | 0.85 to 1.10 | The state change: Warner's card hops across the seam into Suno's corner (arc, tilt); Suno moves up; Universal and Sony close ranks. |
| 1.20 | 1.10 | Warner's stamp re-slams as PAID (mint). Hold for reading. |
| 1.70 | 1.55 | Hard cut to a full yellow card: "Who / gets paid / for AI songs?" word groups stamp in on three hits ("gets paid" on an ink slab). |
| 2.20 | 2.05 | The cast lines up in its final corners as small tiles: Suno + Warner (PAID) vs Universal + Sony (SUING). Brand strip at the bottom. Hold to end, hard cut to Krish. |

## Outro (16:9 5.0 s, 150 frames; 9:16 4.4 s, 132 frames)
| 16:9 s | 9:16 s | Frame |
|---|---|---|
| 0.00 | 0.00 | Hard cut to yellow: "Tell me in the comments" pill + "Should a singer get paid when an AI learns from their song?" |
| 0.55 / 0.70 | 0.50 / 0.65 | Two corner cards stamp in: YES (mint), NO (coral). The viewer picks a corner. |
| 2.00 | 1.70 | Next round: two panels slam together. Ink: "The full story is free / makeyourmindup.ai". Next series colour (lilac): "Next round / Wednesday / under.the.hood". |
| 3.60 | 3.10 | Brand close on ink: MAKE YOUR MIND/UP (UP in mint) slams in line by line. |
| 3.95 to 4.15 | 3.50 to 3.70 | The three series chips stamp in (yellow, lilac, coral). Hold to end. |

The outro never says "I'm Krish"; no AI-disclosure line; no em dashes.

## Constant vs varies
- **Constant (the template):** mint corner vs series-colour corner; ink fighter cards with real logos, name and a stamp; VS disc; one state change (stamps flip, and optionally one card hops corners); hard cut to the question card in the series colour with one word group on an ink slab; the cast line-up; brand strip; outro beats (your corner, next round, brand close with the three series chips); all timings; hit positions.
- **Varies (props):** series name + colour; corner labels; the cast (logos, names, first stamp); the twist (which stamps flip, which card hops, if any); the question words; the comment question; the next round's day, series and colour. Long text auto-shrinks to its column, so other names fit.
- Friday example in the mock: "You" vs OpenAI and Anthropic, stamps LOTS OF BRAINS flip to WON'T SAY WHICH (from the script: "the app won't tell you which brain answered you"), no hop; coral field; question "Why are there suddenly so many AIs?"; next round Monday, follow.the.money.

## Audio cue sheet (16:9 times; the tall cut moves each cue to its own beat above)
Music: NO CURVES (Instrumental Version), the only track in `config/music-library.json`. The track and its levels are both still **proposed**, not approved. Character wanted: drum-led, confident, mid-tempo, with clear downbeats to cut to. Its tempo and cue points are not measured yet (`intro_cue_s` is null), so the hits below are placed on the picture and the bed is slipped so a downbeat lands on frame 0 and the 1.70 cut.

| Where | Time | Sound | Music level (proposed) |
|---|---|---|---|
| Intro | 0.00 | Deep kick + glove thud; bed starts on a downbeat | -16 LUFS |
| Intro | 0.17, 0.30, 0.43 | Snare crack per card landing | |
| Intro | 0.60 | Ring bell, one short ding (VS) | |
| Intro | 0.95 | Rope creak + low riser under the hop (no swoosh) | |
| Intro | 1.20 | Rubber-stamp thunk + cash-drawer clack (PAID) | |
| Intro | 1.70 | 2 frames of silence on the hard cut, then a kick per question word group | |
| Intro | 3.30 | Bed starts ducking into Krish's first word | ramp 0.5 s to -31 LUFS |
| Voice | whole take | No hits under the voice | -31 LUFS |
| Outro | last 0.8 s of voice | Bed lifts on "Make your mind up." | ramp 0.8 s to -18 LUFS |
| Outro | 0.00 | Kick on the hard cut | -18 LUFS |
| Outro | 0.55, 0.70 | Stamp hits for YES / NO, panned left then right | |
| Outro | 2.00 | Double kick as the panels meet | |
| Outro | 3.60 | Final ring bell, three strikes | |
| Outro | 4.40 | Bed resolves on the bar end, or 0.6 s tail fade | out by 5.0 s |

## Real logo files used (data URIs, unaltered)
- Suno: `docs/plans/2026-10-12-monday/logos/suno-logo-cream.svg`. Shown in ink on mint through CSS `filter: brightness(0)`, which recolours the single-colour mark without changing its shape.
- Warner Music Group symbol, Sony Music symbol and Universal Music Group logo: the individual official files embedded unaltered inside `cover-partners-cream.svg` and `cover-suing-cream.svg`, pulled out so each player gets its own card. BMG (in the same file) is not used: the scripts don't name it.
- Friday panel: `docs/plans/2026-10-09-friday/logos/openai-symbol-cream.svg` and `anthropic-symbol-cream.svg`.
- No logo was drawn or invented. Font: Archivo Black from `scripts/quick-edit/fonts` (embedded), Archivo from Google Fonts for labels.

## Files
`mock.html` (built from `mock.src.html` + `assets.json` by `build.js`; `extract.js` pulls the logos), `sheet-intro-wide.png`, `sheet-intro-tall.png`, `sheet-outro-wide.png`, `sheet-outro-tall.png` (`shoot.js`), plus `check-*-fri.png` (Friday) and `page-400.png` / `page-1366.png`.

## Not done / open
- No audio is rendered: the cue sheet describes it. NO CURVES has not been measured (tempo, downbeats), so the hits may need to move a few frames to sit on its bars.
- Lengths: the intro plus outro add 8.5 s to the wide cut and 7.6 s to the tall cut. That pushes the 95 s short cut to about 103 s; whether the 90-second cap counts them is still Krish's call.
- The UMG logo is a wide wordmark, so it reads small on a card; the "Universal" name beside it carries the reading. The Sony Music symbol is abstract, so it is named too.
- Monday's publish page was not read (as instructed); the repo's logo files were used instead.
- Wednesday's next-round card shows only the day and series, because its story isn't set yet.
