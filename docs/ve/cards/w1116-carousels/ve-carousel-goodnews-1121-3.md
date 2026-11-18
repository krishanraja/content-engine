---
card: ve-carousel-goodnews-1121-3
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

# Good-news carousel, fix round 3: headline-only body cards, a cover that differs, a fuller close

## Goal
FIX ROUND on G = .scratch/carousels/goodnews. Edit G/render.py and re-render all ten cards. Scenes, photos, logos unchanged. G/deck.json changed: cards 3, 7 and 9 have new headlines (read them, never type words). G/round2/ holds the last render.
1 BODY CARDS 2-9: DRAW NO LINE under the headline any more (deck lines_where: the lines live in the caption). Picture fills y 0-640 edge to edge, fading to ink over its last 120 px, with the top fade and logo tiles as now. Then body_a() from G/body_a.py exactly, with top=680 and bottom=1170 (kicker 50, rule, Archivo Black 70 that steps down past five lines, the 'mint' phrase in mint). Nothing but the mark below y 1175. Mark: G/brand/mark.png 120 px wide at x 880-1000, y 1195-1270, alone in its rows.
2 COVER 1: the scene fills y 0-1000 edge to edge (cover-crop keeping the robot whole and the signing mother and daughter), then a gradient to ink from y 600 (clear) through y 820 (80% ink) to y 1000 (solid). The four cover_lines in Anton 104 px, true proportions, leading 0.9, centred, the first line's top at y 640: lines 1-2 cream, 3-4 mint. Then the cover line in Archivo SemiBold 38 cream, at most 700 px wide, ending above y 1180. Mark as on the body cards. The cover headline must start at least 135 px higher than the body headlines and be at least 1.3 times their size.
3 CLOSE 10: circles 260 px across with an 8 px mint ring: cards 2,3,4 centred on y 230, cards 5,6 centred on y 450 between them, on a soft green radial glow behind both rows. Then, centred: line 1 Archivo SemiBold 52 cream with its top at y 650; line 2 Anton 120 mint on one line, top at y 735; line 3 Archivo SemiBold 52 cream, top at y 885; line 4 Archivo SemiBold 60 mint, top at y 985; G/brand/wordmark.png 680 px wide centred, top at y 1095. No corner mark.
Everywhere: all type centred on x=540 inside the safe box; no empty band over 12% of the height; no font ever condensed or stretched; no card numbers, footnotes, URLs, badges or extra boxes.

## Contract
Outputs: G/render.py and G/card-1.png to G/card-10.png (1080x1350); every acceptance command exits 0.

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
{"card": "ve-carousel-goodnews-1121-3", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
