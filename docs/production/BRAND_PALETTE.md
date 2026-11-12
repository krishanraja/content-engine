# The brand palette: what opens, carries and closes every asset

Krish, 12 Nov 2026: "I want that session to produce a rock-solid palette of brand asset templates that are able to
be used in our weekly calendar and the engine cannot deviate." Then, of the sheet: "I approve the brand palette
sheet, but only if it falls in line with the attached." The attached is `docs/production/SOCIAL-BEST-PRACTICES-2026.md`.

This page says what each part is, where it lives and who may change it. If anything here disagrees with
`config/brand-palette.json`, the JSON wins and this page is wrong: fix the page.

## The one rule

**Every brand element on every asset comes from `config/brand-palette.json`. No maker keeps its own copy, and no
piece draws its own opening, close, icon or wordmark.** A cut or card that differs from the palette for its day and
format is refused before it renders. Only Krish changes the palette, and only in his own words.

## What is what

| Thing | What it is | Where it lives |
|---|---|---|
| The palette | Per day and per format: the opening, what the body may carry, the close, the colour, the safe areas | `config/brand-palette.json` |
| The guard | Reads the palette and refuses a record that differs from it | `scripts/brand_palette.py` (`check`, `expect`, `--self-test`) |
| The corpus | The platform rules the palette is held to (safe areas, intros, outros, covers, carousels) | `docs/production/SOCIAL-BEST-PRACTICES-2026.md` |
| The marks | The icon (`mark.png`), the masthead and the wordmark, by sha256 | `config/brand-palette.json` `marks`; the files are in krishanraja/makeyourmindup `apps/cover/public/brand` |
| The wide close | `statement_card`: "Built to help you decide.", masthead, days, Subscribe free, address; 6 s, held for YouTube's end screen | `scripts/quick-edit/kit/endcard.html` (wide); ve `apps/renderer/src/engine/chrome/EndingBand.tsx` |
| The tall close | `statement_beat`: the same words, at most 2 s, every word inside the tall core box x 120 to 820, y 330 to 1180 | `scripts/quick-edit/kit/endcard.html` (tall); ve `EndingBand.tsx` (`ENDING_TIMING_TALL`), its length `ENDING_FRAMES_BY_ASPECT` in `scripts/velib/compile.py` |
| The sting | The series sting, 1.9 s, on a series day's long cut only, played after the hook | `config/intro-sting.json` (clips in the Drive brand kit) |
| The carousel close | `house_close_slide`: the piece's takeaway, Subscribe free, the wordmark small in the bottom right | krishanraja/growth-makeyourmindup `render/templates/carousel-close.html` |

## The days

| Day | Kind | Colour |
|---|---|---|
| Monday | follow.the.money | butter `#FFD84D` |
| Wednesday | under.the.hood | lilac `#B7A6FF` |
| Friday | mind.the.gap | coral `#FF6A4D` |
| Tuesday, Thursday, Saturday, Sunday | off day | mint `#7EF0C0`; never a series colour, name, pill or days row |

An asset on a series day that is not the week's series piece, and does not carry it, is an off-day asset.

## The formats, in one line each

- **Long cut (16:9).** Opens on the hook. On a series day the series sting follows the hook. The body carries the icon tile only, with the series pill on section beats. Closes on `statement_card`.
- **Short cut (9:16).** Opens on the hook, with no intro card and no sting. The body carries captions only: no icon, no wordmark, no pill. Closes on `statement_beat`, the only place a wordmark appears.
- **Carousel (4:5).** Card 1 is the cover scene, with no logo at the top. Every card carries the wordmark small in the bottom right. The last card is `house_close_slide`.
- **Meme and Notes image.** No logo at the top, and the wordmark small in the bottom right. No close.
- **Saturday good news.** Photo cover. The wordmark in a bottom corner. Krish's fixed good-news close.
- **Wide thumbnail.** No logo.
- **Tall cover.** A separate cover, never the opening frame, with the masthead inside the cover grid.

## Who checks what

| Maker | Where the guard runs | What happens on a miss |
|---|---|---|
| quick-edit (`scripts/quick-edit/make.py`) | `palette_problems`, before any render, for every dated cut | Stops with `Brand palette (config/brand-palette.json): ...` |
| The day runner (`scripts/produce_day.py`) | Through make.py; it no longer swaps in any outro of its own | The same stop |
| ve (`scripts/velib/lint.py`) | `palette_lints`, the `brand.palette` lint, read from compile's own close length and sting position | `ve lint` fails |
| Growth's carousels | `engine/run/artdirect.py` `OWN_CLOSE`: a new piece kit may not ship its own close | The art-direction gate refuses the kit |
| Tests | `tests/brand_palette_test.py` here; `tests/test_render_templates.py` `FollowsThePalette` in Growth | CI fails |

The palette binds every piece dated from **16 Nov 2026** (`applies_from`). Fri 13 Nov is made on a frozen engine (F33).

## Retired: never use again

The palette lists these under `retired`, and the guard refuses a close whose file name matches one:

- **Closes:** the 4 s publication card, the story stand-off outro (`StoryOutroStandoff`, `story_io.py`), the one-screen outro, ve's ticker band, the per-piece close cards in `docs/plans/*/rebuild`, the sting held as an outro, the border-control packaging outro, and Growth's per-piece kit endings.
- **Openings:** the story intro card, the sting in front of the hook, and make.py's 3 s opening logo.

One-off piece scripts (`docs/plans/*/rebuild`, `short-composite`, `build_cut.py`) drew five of the seven outros found in the audit. A cut from per-piece code is never filed (`config/music-bed.json` receipt engines). Make a cut through ve or quick-edit, or not at all.

## Changing the palette

1. Only Krish's own words change it. Quote them, dated, in the palette's `approved` block and in the commit body as `Ruling (Krish, YYYY-MM-DD): ...`.
2. Change `config/brand-palette.json` first. Then change the maker that draws it (kit, ve, Growth), then the tests.
3. A one-off exception for one piece is `"palette_exception": "Krish, YYYY-MM-DD: <his words>"` in that cut's config. make.py prints it and lets the cut through. Nothing else lets a cut through.
4. Never add a close, intro, mark position or colour anywhere except the palette.

## Still to follow, and refused until it does

Both engines still play the series sting in front of the hook on a series long cut, so from 16 Nov `ve lint` and
make.py refuse those long cuts until the sting follows the hook. Moving it mid-cut changes every check that maps a
frame of the file back to the cut (`velib.qc.lead_frames` and its callers, the premix lead in `velib.audio.premix`,
`sting_problems`, the opening gate), so it is built with a proof Krish approves on his own take (F04, F13). Until
then a series long cut renders only on his words in its config (`palette_exception`), or without the sting if he
rules that. Both tall closes, kit's and ve's, are the palette's 2 s beat, and an off-day close shows no series days.
