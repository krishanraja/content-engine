# How every video ends

Krish, 10 Nov 2026, on the Fri 13 Nov piece's cards: "This house card looks awful. The copy should read: "Built to help you decide." And the component spacing and where all the components are are ridiculously poorly designed. Can you spin off a sub-session to upgrade these cards permanently and come up with a much more powerful closing strategy?"

He was shown three directions as stills and 6 second clips (A, the masthead: an editorial card; B, the band: his last caption growing into a band in the series colour; C, the statement: the tagline as the picture). He picked **C: the statement** on 10 Nov 2026. This page is the close that every video now ends on. It works inside the floor: one opening and one close (never 7), and a spoken outro pointing to the full article plus a visible call to action (`config/rejection-floor.json`, `s463635e2ea`).

## The close, second by second

One sequence of about 9 seconds: his last line, then one card. No second screen, no stacked logo sting, no transition card in between (`se67ed0142d`: "we also don't need three separate outro transitions and screens. Ever.").

| When | Picture | Sound |
|---|---|---|
| His last line | He says the outro line that points to the full article. Its caption is on screen as he says it. | His voice over the bed at `bed_lufs`. |
| His last word | A hard cut to ink, with no wipe and no fade card. The type brings the motion. | The bed starts its rise to the ledger's `outro_lufs` over 1 s (`config/music-bed.json`, `close_rise_s`). |
| Card 0.10 to 0.85 s | "BUILT TO", "HELP YOU", "DECIDE." each rise out of their own mask, 0.14 s apart. "DECIDE." is in the series colour (follow.the.money #FFD84D, under.the.hood #B7A6FF, mind.the.gap #FF6A4D). | The rise lands under the statement. |
| Card 1.3 to 2.1 s | In reading order: the masthead (on ink, level, untouched), the three days in their series colours, "Subscribe free", then the address. Each arrives fast and settles softly (0.8 s, expo-out). | Music at `outro_lufs` (-18). |
| Card 2.05 to 2.75 s | The address's underline draws on from the left, in the series colour. | |
| Card 2.75 to 6 s | Everything has settled. The card holds still to be read, a little over 3 s. | The bed fades over the last second (`fade_out_s`). |

A long episode keeps its own longer close. `end_hold_s` holds the settled last frame so YouTube's end-screen tiles sit over it (Krish, 2026-10-16), and the hold frame is now the settled statement.

## Layout

- **Tall, 1080 x 1920.** Every word sits inside x 100 to 880, y 200 to 1320, clear of Instagram's and TikTok's top bar, action rail and caption (`config/channel-safe-zones.json`). The rest of the frame is ink. One column, top to bottom: the masthead (520 px), the statement (Anton 204 px, three lines), then the days, "Subscribe free" and the address.
- **Wide, 1920 x 1080.** A 160 x 120 px margin. The masthead sits top left and the statement in two lines (Anton 190 px). The bottom row has "Subscribe free" and the address on the left and the days on the right.
- The tagline breaks only between words. The last word always stands alone in the series colour (`statement_lines` in `scripts/quick-edit/kit.py`). The fit step shrinks the type if a line would ever overflow.

## Where it lives

- `scripts/quick-edit/kit/endcard.html` is the card and its motion, as CSS animations.
- `scripts/quick-edit/kit.py` fills it: `TAGLINE`, `CTA`, `ENDCARD_SECONDS = 6`, `statement_lines`, `page_endcard`. `Drawer.film` films the motion at 30 fps by stepping every animation to each frame's time, so the result never depends on the machine's speed. `Drawer.shoot` draws every still at its settled last frame. A drawer that cannot film (the self-test's paper one) falls back to the settled still.
- `python scripts/quick-edit/kit.py --self-test` holds the exact tagline, the line breaks, the series colour, one address and no old tagline. Where a browser is present, it also checks that both shapes draw with nothing past an edge.

The same session fixed the wide cut's background (`scripts/quick-edit/kit/frame16.html`). A title never breaks inside a word ("COUNTIN / G RAT / TAILS" was `overflow-wrap: break-word`). The fit step shrinks it instead. The two columns share one grid: the series pill and the wordmark on one top line, the title centred, and the day and address on one bottom line. The right column is full-height ink rather than a floating tile. The tilted sticker is gone ("minimal random components and labels").

## ve

ve closes on the same card (`apps/renderer/src/engine/chrome/EndingBand.tsx`). It replaces the ticker band, which sat over the last shot. On his last word the frame cuts to full ink. The statement and the rest arrive on the same timings as kit's card (`ENDING_TIMING`, settled by 2.75 s). The close lasts 6 s (`ENDING_FRAMES = 180` in `scripts/velib/compile.py`, which also passes the tagline, "Subscribe free" and the three days in their series colours). `ending.ticker` is still accepted on old props and draws nothing. Tests in `apps/renderer/src/engine/chrome/ending.test.ts` cover the exact words, the line breaks, reading order, settling and the safe box. The house golden was regenerated for this change.

The renderer is inside ve's engine freeze (F33, `config/ve/production-guards.json`). A piece whose storyboard was signed on the old engine is refused at `ve proof` and `ve render` until Krish approves this change for it, or until its storyboard is re-signed with `ve expect`. He approved it for Wed 11 Nov on 10 Nov ("approve the engine change for Wednesday"). The approval is in `docs/plans/2026-11-11-wednesday/ve/engine-exceptions.json`, bound to engine sha256 `eefc1bc04b391bc4642807a368768142431dd8bce3b1498c2438074b5a60a0c6`. `velib/guards.py` reads that file beside the spec's approvals. An approval with `scope: "engine"` waives no lint check and is not a press on a cut (F34). If the engine changes again before Wednesday renders, the hash no longer matches and he is asked again.

## Not yet

- Off-day pieces through kit still use the series list. An off-day cut there should take the house mint for the last word, with no series promise (F36). ve already does this, because compile sets the channel colour to mint on an off day.
