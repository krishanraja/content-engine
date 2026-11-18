---
card: ve-carousel-goodnews-1121-4
kind: carousel
model: gpt-6.1-sol
effort: medium
max_minutes: 25
max_calls: 30
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-carousel-goodnews-1121
write_allow: [.scratch/carousels/goodnews/*]
read: config/ve/brand-tokens.json, .scratch/carousels/goodnews/*, assets/fonts/makeyourmindup/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Good-news carousel, fix round 4: the close's lines lower, Glidance's symbol, two headline updates

## Goal
FIX ROUND on G = .scratch/carousels/goodnews. Edit G/render.py and re-render all ten cards. Everything not named here stays exactly as round 3 drew it (G/round3/ holds it).
1 G/deck.json changed: cards 7 and 9 have new headlines, card 7's mint phrase is now 'buy AI', and card 4's logo_files is now logos/glidance-symbol.png (Glidance's own symbol, no lettering). Read them; never type words.
2 CLOSE 10: keep the two rows of ringed photos and the glow as they are. Move the type down so the big Anton line starts well below the cover's headline: line 1 (Archivo SemiBold 52 cream) top at y 700; line 2 (Anton 120 mint, one line) top at y 790; line 3 (Archivo SemiBold 52 cream) top at y 930; line 4 (Archivo SemiBold 60 mint) top at y 1020; the wordmark 680 px wide, centred, top at y 1110, ending above y 1265. Check no empty band over 12% of the height remains.
3 Nothing else changes: cover, body layout, scenes, photos, tiles, mark.

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
{"card": "ve-carousel-goodnews-1121-4", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
