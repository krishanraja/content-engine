---
card: ve-carousel-goodnews-1121
kind: carousel
model: gpt-6.1-sol
effort: medium
max_minutes: 50
max_calls: 60
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-carousel-goodnews-1121
write_allow: [.scratch/carousels/goodnews/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, docs/CAROUSEL-STANDARD.md, .scratch/carousels/goodnews/*, assets/fonts/makeyourmindup/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Saturday good news in the house look: This week AI helped people speak, sign and get around (10 cards, 4:5)

## Goal
Work only in .scratch/carousels/goodnews (G). Read G/deck.json: every word comes from it (cover_lines, headline, line, kicker, mint, close_lines), never typed or rewritten.
SCENES FIRST. Use your image generation tool. View G/robot/robot-standing.webp and robot-theatre.webp, then generate the cover from G/scenes/record.json 'prompt' exactly, holding the robot to those photos; then card-7, card-8, card-9 from its 'scenes'. Save as G/scenes/cover.png, card-7.png, card-8.png, card-9.png (landscape, at least 1400 wide). Put each generation's id in the record (job_id; scene_ids). Regenerate once if a scene shows words, a logo, a different robot or a warped face or hand.
RENDER. Write G/render.py (Pillow) drawing G/card-1.png to card-10.png, 1080x1350, ink ground, colours from config/ve/brand-tokens.json only, fonts only from assets/fonts/makeyourmindup. ALL TEXT CENTRED on x=540 inside the safe box (x 80-1000, y 80-1270); no empty band over 12% of the height; body ink at least 35 px.
COVER (1): cover.png fills y 0-810 edge to edge (scale to cover, never stretch), fading to ink over its last 170 px. Under it, stacked tight: cover_lines in Anton caps 120-132 px, leading 0.95, first line cream, second mint; then the cover line in Archivo SemiBold 40 cream; mark G/brand/mark.png 120 px wide at bottom right inside the safe box.
BODY (2-9): its photo_file or scene_file fills y 0-700 (cover-crop on the faces and the device, never cut a head), fading to ink over 140 px. If logo_files: each on a cream rounded tile, logo 60 px tall, tiles in a row at top-left inside the safe box. Under the picture, centred: kicker in IBM Plex Mono SemiBold 28 mint, letter-spaced; a mint rule 96x4; the headline in Archivo Black 54-60 px cream, at most five lines, its 'mint' phrase in mint; the line in Archivo Regular 36 px cream at 80%. Centre this block between y 720 and 1210. Mark as on the cover.
CLOSE (10): the five story photos (cards 2-6), each a circle 170 px across in a 6 px mint ring, in story order in a gentle arc across y 140-470, on a soft green radial glow. Then close_lines centred: line 1 Archivo SemiBold 46 cream; line 2 Anton 104 mint on one line; line 3 Archivo SemiBold 46 cream; line 4 Archivo SemiBold 50 mint, lower case; directly under it G/brand/wordmark.png 520 px wide, centred. No corner mark on this card.
Never: card numbers, footnotes, URLs, badges, drawn icons, diagrams, extra boxes, a system font, any word not in the deck.

## Contract
Outputs: G/scenes/cover.png, card-7.png, card-8.png, card-9.png, the filled G/scenes/record.json, G/render.py, G/card-1.png to G/card-10.png (1080x1350). Words exactly the deck's; photos and logos used as given (scale and crop only).

## Brand (saturday_good_news, off, 2026-11-21; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"body": {"icon": false, "wordmark": "bottom_corner_small"}, "close": "good_news_close", "kind": "off", "logo_top": false, "opening": "photo_cover", "series": null, "shape": "4x5"}
Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.

## References (the inspiration cards Krish ticked; build to them, never copy them)
- goodnews-source: Krish's saved Instagram post asking for a positive ray of sunshine, https://www.instagram.com/p/DfAY9PWFuEX/ (option goodnews, week 2026-11-16 ideas.json)
- goodnews-lookalike: the weekly-roundup post this beats, https://www.instagram.com/evolving.ai/p/DfPW8fmgCnt/ (one topic, every story checked, its own photo)
- house-look: the Git and homework covers and the Erdos body cards (Drive 3 Posts, 'AI fixing what we got wrong v2', folder 1feD3BsGArlyUQTK_TTtNf8EqgV-c3qA6; Krish, 18 Nov)

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
python3 scripts/post-pack/cover_scene.py check .scratch/carousels/goodnews/scenes/record.json
python3 scripts/carousel_check.py --cards .scratch/carousels/goodnews/card-1.png .scratch/carousels/goodnews/card-2.png .scratch/carousels/goodnews/card-3.png .scratch/carousels/goodnews/card-4.png .scratch/carousels/goodnews/card-5.png .scratch/carousels/goodnews/card-6.png .scratch/carousels/goodnews/card-7.png .scratch/carousels/goodnews/card-8.png .scratch/carousels/goodnews/card-9.png .scratch/carousels/goodnews/card-10.png

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-carousel-goodnews-1121", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
