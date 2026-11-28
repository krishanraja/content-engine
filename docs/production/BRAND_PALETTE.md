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
| The marks | The v5 icon (`d-face-off.svg`), the masthead (the horizontal lockup `v9.svg`) and the wordmark (`v4.svg`), by sha256 | `config/brand-palette.json` `marks`; the files are in this repository at `assets/brand/makeyourmindup/v5` (since the v5 lock, 25 Nov 2026; the v4 PNGs at makeyourmindup `apps/cover/public/brand` are gone) |
| The series close, from Thu 26 Nov | The v5 outro card on every video, series or off day, wide or tall (Ruling, Krish, 2026-11-26: "1 agreed", to "retire them and end on the plain v5 outro card"). The card is the Library's outro: `video-wide-outro` for `statement_card` and `video-vertical-outro` for `statement_beat`, approved in the Library's `lock.json`. It shows S3h, the one wordmark, "Follow for more", makeyourmindup.ai and the climb bars, and nothing else: no tagline, no stacked V10 mark, no days row and no series name (ONE-MARK: "there should only be one of these wordmarks on any given artifact or page"; Krish, 26 Nov: "the sub brands do not need to feature"). No intro sting clip goes anywhere in a cut. The sting close of 20 Nov is retired; a series cut dated 23 to 25 Nov keeps it, as signed (F33), and the palette leaves that close unchecked | `config/brand-palette.json` `series_close` (`outro`); ve `V5Outro.tsx` (props `ending.look` `v5_outro`, set by ve compile); `EndingBand.tsx` draws the statement card and `StingClose` only for cuts signed with them; `ve lint` refuses a spec naming a sting clip (`guards.close_problems`), `ve render` refuses props carrying one, drawn in another theme, closing on the old card or showing a days row (`compile.ending_problems`); `config/intro-sting.json` `close` keeps the record, `retired` |
| The close's words | From 26 Nov the Library outro's own: "Follow for more" and makeyourmindup.ai. Before: "Built to help you decide.", "Subscribe free", makeyourmindup.ai, one copy | `docs/ve/cards/library/library.json` (the two outro templates); `config/brand-palette.json` `close_copy` for the statement card, read by compile and kit |
| The wide close | `statement_card`: from 26 Nov the Library's `video-wide-outro`: the four bars fill the frame and drop into the staircase, S3h lands, then the words; settled by 2.4 s, 6 s, held for YouTube's end screen. A cut dated before 26 Nov keeps the statement card it was signed with ("Built to help you decide.", masthead, days on a series day, Subscribe free, address) | ve `apps/renderer/src/engine/chrome/V5Outro.tsx`; quick-edit's kit `scripts/quick-edit/kit-v5/v5-outro.html` (`page_outro`); the old card in `EndingBand.tsx` and `scripts/quick-edit/kit-v5/v5-close.html` (wide) |
| The tall close | `statement_beat`: from 26 Nov the Library's `video-vertical-outro`, its 90 frames played inside the 2 s beat, settled by 1.33 s, inside the Library's content box x 145 to 935, y 87 to 1353. A cut dated before 26 Nov keeps the ink beat it was signed with, every word inside the tall core box x 120 to 820, y 330 to 1180 | ve `V5Outro.tsx`; its length `ENDING_FRAMES_BY_ASPECT` in `scripts/velib/compile.py`; quick-edit's kit `scripts/quick-edit/kit-v5/v5-outro.html` (`page_outro`); the old beat in `EndingBand.tsx` (`ENDING_TIMING_TALL`) and `scripts/quick-edit/kit-v5/v5-close.html` (tall) |
| The sting | Retired for good as an opening (Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove the sting exception for good."): no cut carries anything before its hook. From 23 to 25 Nov the same clips were the series close, retired on 26 Nov (above) | `config/intro-sting.json` (`retired` as an opening, `close.status` retired; the clips stay in the Drive brand kit, unused by any new cut) |
| The carousel close | `house_close_slide`: the v5 close (`config/carousel-format.json` `close`): the takeaway, the S3h wordmark and the site, never "Follow for more" (Krish, 26 Nov, carousel format; it supersedes the 18 Nov close) | the locked v5 Library's carousel close (`make_piece.py --set <set>`; `docs/CAROUSEL-STANDARD.md`). Growth's `render/templates/carousel-close.html` drew it until Growth's renderer was deleted on 26 Nov 2026 |

## The days

Record only for cuts signed before 26 Nov. In v5 the day colours and pills are retired; coral, butter and lilac code a climb only.

| Day | Kind | Colour |
|---|---|---|
| Monday | follow.the.money | butter `#FFD84D` |
| Wednesday | under.the.hood | lilac `#B7A6FF` |
| Friday | mind.the.gap | coral `#FF6A4D` |
| Tuesday, Thursday, Saturday, Sunday | off day | mint `#7EF0C0`; never a series colour, name, pill or days row |

An asset on a series day that is not the week's series piece, and does not carry it, is an off-day asset.

## The logo on a cut: the title frame and the close, nowhere else

Ruling (Krish, 2026-11-17): "we decided to eliminate all logos from everywhere other than the final animated close
card and the title frame that animates as I introduce the title of the piece (like we did in the ai-music video) so we
can have focuson the hook in the opening seconds"; then "yes, change the brand rules". On 10 Nov, of the wide cut's
mark tile: "I don't get why that icon even appears ... Get rid of it."

So a cut, wide or tall, shows the logo in two places only: the one full-frame title in the pause after he says the
piece's title, with the stacked logo underneath it (the AI music piece, Wed 11 Nov), and the close card. No mark tile,
no header logo and no wordmark anywhere else in the body. It binds every piece published from Mon 23 Nov
(`config/brand-palette.json` `logo_rule`); the pieces in production in the week of 16 Nov keep the engine their
storyboard was signed on (F33). ve draws it from compile's `bodyLogo: false`; ve has no built title frame yet, so
until it does the logo appears on the close alone.

From 26 Nov the title lockup carries no wordmark. The stacked V10 it carried is retired (S3h replaced V10 and V6), and
the cut's one wordmark is S3h on its v5 outro (Krish, 2026-11-25, `docs/ve/cards/library/ONE-MARK.md`: "there should
only be one of these wordmarks on any given artifact or page"). ve compile marks such a cut `titleMoment.wordmark`
false and `FormatMaster.tsx` (`titleWordmark`) draws the lockup without it; a cut dated before keeps the lockup it was
signed with.

## One wordmark per video, and no sub brands, from 27 Nov

Ruling (Krish, 2026-11-27): "agree", to each of four recommendations (`config/brand-palette.json` `marks_rule`):

1. "The opening title of a video carries no wordmark. S3h on the v5 outro is the only wordmark per video." Done from
   26 Nov (above).
2. "Remove the V4 wordmark from the wide quick-edit frame ... and from the why-ladder title card. The outro carries the
   brand." From 27 Nov quick-edit's `frame-16x9.png` (`kit-v5/v5-frame.html`, `page_frame16`) draws no V4 behind the
   speaker, and ve's why-ladder title card (`engine/v5/Cards.tsx` `v5_title`, props `titleCardMark` false) draws none
   under the title.
3. "Remove the series-name pills ("follow.the.money" and the like) from the body sections of wide videos." His earlier
   words: "the sub brands do not need to feature" (26 Nov). From 27 Nov no beat carries one: ve's `ChannelPill` and the
   `StageHeader` pill (props `seriesPill` false) and quick-edit's wide panel pill (`page_panel`).
4. "The 9:16 outro stays at 2 s, settled by 1.33 s. Do not lengthen it to the template's 3.6 s."

A cut dated before 27 Nov renders exactly as it was signed (F33): ve compile adds neither flag, and quick-edit keeps the
frame and panels it had. `ve lint` (`guards.marks_problems`) refuses a spec from 27 Nov naming V4 or asking for a body
logo, a series pill or a title wordmark; `ve render` (`compile.marks_problems`) refuses props from 27 Nov that would draw
one.

No V10 from 27 Nov either (Ruling (Krish, 2026-11-25): wordmark on ink only; V10 retired). The theme
`makeyourmindup-v5` still pins `v10.svg` as `stacked` (hash-pinned for Studio V2 jobs, and kept so older cuts render as
signed), so ve compile puts S3h (`marks.square`) in that slot for a cut dated from 27 Nov (`stacked_slot`): a close that
draws the slot draws S3h, and the title lockup draws nothing when the slot holds S3h (`FormatMaster.tsx`
`titleWordmark`). `ve lint` and `ve render` refuse a cut from 27 Nov naming V10, V6 or any `-ink` drawing by path or
sha256, `props.brand` included (`marks.retired`; `carried_retired`). A Studio V2 render on the theme still draws V10 in
`HouseShort.tsx`'s ending band: its manifest carries no date to gate it.

## The formats, in one line each

- **Long cut (16:9).** Opens on the hook, with nothing before it (the sting is retired). The body carries no logo (from 16 Nov; no icon tile) and, from 27 Nov, no series pill; a series cut dated before keeps the pill on its section beats. Closes on `statement_card`, from 26 Nov the Library's `video-wide-outro`, with no days row (series pieces dated 23 to 25 Nov keep the retired `sting_card`).
- **Short cut (9:16).** Opens on the hook, with no intro card and no sting. The body carries captions only: no icon, no wordmark, no pill. Closes on `statement_beat`, from 26 Nov the Library's `video-vertical-outro`, with no days row (series pieces dated 23 to 25 Nov keep the retired `sting_beat`); the title frame and the close are the only places a logo appears.
- **Carousel (4:5).** Card 1 is the cover scene, with no logo at the top. Every card carries the wordmark small in the bottom right. The last card is `house_close_slide`.
- **Meme and Notes image.** No logo at the top, and the wordmark small in the bottom right. No close.
- **Saturday good news.** Photo cover. The wordmark in a bottom corner. Krish's fixed good-news close.
- **Wide thumbnail.** No logo.
- **Tall cover.** A separate cover, never the opening frame, with the masthead inside the cover grid.

A tall meme is its own format, `meme_tall` (9x16; Ruling, Krish, 2026-11-15: tall memes are centred, his words "The
POV computer meme, it's not centralized on the screen"): the same skin as the square meme, the wordmark small in the
bottom-right corner, and its picture centred on the screen by the bars in `formats.meme_tall.centre`, which
`python3 scripts/layout_centre.py FILE` checks in `ve qc` and before filing.

## Who checks what

| Maker | Where the guard runs | What happens on a miss |
|---|---|---|
| quick-edit (`scripts/quick-edit/make.py`) | `palette_problems`, before any render, for every dated cut | Stops with `Brand palette (config/brand-palette.json): ...` |
| The day runner (`scripts/produce_day.py`) | Through make.py; it no longer swaps in any outro of its own | The same stop |
| ve (`scripts/velib/lint.py`) | `palette_lints`, the `brand.palette` lint, read from compile's own close length and sting position | `ve lint` fails |
| Carousels (since 26 Nov 2026, content-engine) | the v5 Library's templates fix the close; `scripts/carousel_make.py` and `config/carousel-format.json` refuse a deck whose last slide is not the set's close | the run fails before anything is drawn. Growth's `engine/run/kits.py` `OWN_CLOSE` held its piece kits until its renderer was deleted on 26 Nov 2026 |
| Tests | `tests/brand_palette_test.py` and `tests/carousel_format_test.py` here | CI fails |

The palette binds every piece dated from **16 Nov 2026** (`applies_from`). Fri 13 Nov is made on a frozen engine (F33).

## Retired: never use again

The palette lists these under `retired`, and the guard refuses a close whose file name matches one:

- **Closes:** the 4 s publication card, the story stand-off outro (`StoryOutroStandoff`, `story_io.py`), the one-screen outro, ve's ticker band, the per-piece close cards in `docs/plans/*/rebuild`, the sting held as an outro, the series close on the sting (`close-sting-*`, 23 to 25 Nov), the border-control packaging outro, and Growth's per-piece kit endings.
- **Openings:** the story intro card, the sting in front of the hook, and make.py's 3 s opening logo.

One-off piece scripts (`docs/plans/*/rebuild`, `short-composite`, `build_cut.py`) drew five of the seven outros found in the audit. A cut from per-piece code is never filed (`config/music-bed.json` receipt engines). Make a cut through ve or quick-edit, or not at all.

## Changing the palette

1. Only Krish's own words change it. Quote them, dated, in the palette's `approved` block and in the commit body as `Ruling (Krish, YYYY-MM-DD): ...`.
2. Change `config/brand-palette.json` first. Then change the maker that draws it (kit, ve, the v5 Library), then the tests.
3. A one-off exception for one piece is `"palette_exception": "Krish, YYYY-MM-DD: <his words>"` in that cut's config. make.py prints it and lets the cut through. Nothing else lets a cut through.
4. Never add a close, intro, mark position or colour anywhere except the palette.

## The sting, retired

Krish, 12 Nov 2026, first: "Happy with your recommendations" (the sting paused until it could follow the hook); then,
the same day, answering the openings question: "Nothing before the hook, ever. Remove the sting exception for good."
`config/intro-sting.json` says `retired`; `intro.py` gives no cut a sting and refuses every approval, ve compile's
`sting_props` lays none and `sting_problems` refuses props that carry one, ve lint and the contract refuse a spec that
names one or an episode card in its place, and make.py leaves out any intro clip and stops a cut handed one. The
palette's long cut keeps `sting_when_built: after_hook` as the record of the sheet he approved: a sting after the hook
would be a new design, built, proved on his own take (F04, F13) and approved in his words first.

**Built in ve, not switched on (13 Nov 2026, after Krish: "Can you sort out the sting now?").** ve can now play a
sting straight after the hook and never in front of it: `compile.hook_end` (the end of beat 0, at least 3 s so the
opening gate measures the hook), `props.sting.atFrame`, `VeCut.tsx` (hook, clip, then the cut on), premix's
`sting_at_frame` (his voice to the hook's end, the sting's frames of silence, the bed lifted under them), and every check
through `velib.qc.to_file`. A sting with no `atFrame` is refused everywhere. Nothing lays one: `sting_props` still
gives no cut a sting and the config stays retired, so `sting_problems` refuses any sting. To use it, Krish approves a
proof on his own take, in his words; then the config, `intro.py` and `sting_props` change to lay it after the hook.
quick-edit cannot lay it.

Both tall closes, kit's and ve's, are the palette's 2 s beat, and an off-day close shows no series days.
