---
card: ve-carousel-goodnews-1121-6
kind: carousel
model: gpt-6.1-sol
effort: medium
max_minutes: 15
max_calls: 20
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-carousel-goodnews-1121
write_allow: [.scratch/carousels/goodnews/*]
read: config/ve/brand-tokens.json, .scratch/carousels/goodnews/*, assets/fonts/makeyourmindup/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Good-news carousel, fix round 6: card 6 edge to edge

## Goal
FIX ROUND on G = .scratch/carousels/goodnews. Change card 6 only; every other card must come out byte-identical to G/round5/ (it passed every check). Card 6 now shows the photo boxed with dark bars at its sides: it must fill the full 1080 px width edge to edge like every body card (scale G/photos/visionably.jpg to 1080 wide, about 1440 tall, never letterboxed, never stretched). Take the 640 px window about 200 px higher in the photo than G/round4/card-6.png did, so the top of the boy-in-glasses' head sits near y 200, all three faces are whole between y 200 and y 620, and the logo tile at x 80-170, y 80-170 covers only the wall. Keep the fades, kicker, rule, headline and mark exactly as round 5.

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
{"card": "ve-carousel-goodnews-1121-6", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
