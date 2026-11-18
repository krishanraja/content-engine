---
card: ve-carousel-goodnews-1121-2
kind: carousel
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 50
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-carousel-goodnews-1121
write_allow: [.scratch/carousels/goodnews/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, .scratch/carousels/goodnews/*, assets/fonts/makeyourmindup/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Good-news carousel, fix round 2: cover type, house body type, card 9 margin, a fuller close

## Goal
FIX ROUND on G = .scratch/carousels/goodnews. Edit G/render.py and re-render all ten cards. Keep the four scenes, photos, logos and every word as they are (G/deck.json was updated: cover_lines are now four lines and the kickers are shorter; read them, never type words). G/round1/ holds the last render for comparison.
1 COVER. Never condense, stretch or squash any font: type keeps its true proportions everywhere. Scene fills y 0-940 edge to edge, then a gradient to ink from y 560 (clear) through y 760 (85% ink) to y 940 (solid). The four cover_lines in Anton at 120 px, leading 0.9, centred, starting at y 690 over the faded scene: lines 1-2 cream, lines 3-4 mint. Then the cover line in Archivo SemiBold 38 cream (two lines if needed), then the mark at bottom right as now.
2 BODY CARDS 2-9. Picture fills y 0-580 edge to edge, fading to ink over its last 120 px, plus a top fade (ink at y 0 to clear by y 170) on every body card so the logo tiles sit on dark and no text inside a photo reads in the top margin (card 9's phone failed that). Logo tiles stay as now, top-left inside the safe box. Under the picture, use body_a() from G/body_a.py exactly (import it): kicker in IBM Plex Mono SemiBold 50 mint, the 64 px mint rule, the headline in Archivo Black at 70 px (it steps down by itself past five lines), its 'mint' phrase in mint; set top so the block starts below the picture. Then the card's line in Archivo SemiBold 38 cream at 85%, centred, at most two lines. The block and line together are centred between y 600 and y 1225. Mark as on the cover.
3 CLOSE 10. Two rows of mint-ringed story photos, honeycomb: three circles 240 px across (8 px mint ring) centred across y 110-350, two more centred below them across y 300-540, in story order (cards 2,3,4 then 5,6), on a larger soft green radial glow. Then close_lines centred and stacked tight: line 1 Archivo SemiBold 52 cream; line 2 Anton 112 mint on one line; line 3 Archivo SemiBold 52 cream; line 4 Archivo SemiBold 58 mint, lower case; directly under it G/brand/wordmark.png 600 px wide, centred, ending above y 1265. No corner mark on this card.
Keep: all text centred on x=540 inside the safe box (x 80-1000, y 80-1270); no empty band over 12% of the height; no card numbers, footnotes, URLs, badges or extra boxes.

## Contract
Outputs: G/render.py and G/card-1.png to G/card-10.png (1080x1350), every acceptance command exit 0. Scenes, photos, logos and words unchanged.

## Brand (saturday_good_news, off, 2026-11-21; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"body": {"icon": false, "wordmark": "bottom_corner_small"}, "close": "good_news_close", "kind": "off", "logo_top": false, "opening": "photo_cover", "series": null, "shape": "4x5"}
Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.

## References (the inspiration cards Krish ticked; build to them, never copy them)
- goodnews-source: Krish's saved Instagram post asking for a positive ray of sunshine, https://www.instagram.com/p/DfAY9PWFuEX/
- goodnews-lookalike: the weekly-roundup post this beats, https://www.instagram.com/evolving.ai/p/DfPW8fmgCnt/
- house-look: Git and homework covers, Erdos body cards; body type as G/body_a.py from the approved v2 ads and midterms decks (Krish, 18 Nov)

## Deck (10 cards; the words are fixed and passed scripts/carousel_check.py)
- card 1: cover, one picture of its point
- card 2: happened, one picture of its point
- card 3: happened, one picture of its point
- card 4: happened, one picture of its point
- card 5: happened, one picture of its point
- card 6: happened, one picture of its point
- card 7: why, one picture of its point
- card 8: so_what, one picture of its point
- card 9: do, one picture of its point
- card 10: last card, one picture of its point
Template every card with placeholders; the session fills in the deck's words when it renders.

## Acceptance (every command must exit 0 inside your sandbox)
python3 .scratch/carousels/goodnews/render.py
python3 scripts/carousel_check.py --cards .scratch/carousels/goodnews/card-1.png .scratch/carousels/goodnews/card-2.png .scratch/carousels/goodnews/card-3.png .scratch/carousels/goodnews/card-4.png .scratch/carousels/goodnews/card-5.png .scratch/carousels/goodnews/card-6.png .scratch/carousels/goodnews/card-7.png .scratch/carousels/goodnews/card-8.png .scratch/carousels/goodnews/card-9.png .scratch/carousels/goodnews/card-10.png

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-carousel-goodnews-1121-2", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
