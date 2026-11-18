---
card: ve-carousel-midterms-3
kind: carousel
model: gpt-6.1-sol
effort: medium
max_minutes: 30
max_calls: 30
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-carousel-midterms-1
write_allow: [.scratch/carousel/midterms/draw.py, .scratch/carousel/midterms/out/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, config/carousel-layout.json, scripts/carousel_layout.py, .scratch/carousel/midterms/words.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Midterms carousel: fix the cover overlap, the close board and the last two checker failures

## Goal
Same worktree and renderer (.scratch/carousel/midterms/draw.py, words.json unchanged). Five fixes, seen at full size by the session: 1) Card 1: the headline's last line collides with the line under it; give the headline and the line their own space with a clear gap, headline still at least 1.3 times the body size, the scoreboard scene still full-bleed. 2) Card 6: the board's lamp '=' signs read as noise; on card 6 draw the board as two lit text rows, WHERE IT'S BUILT then WHAT IT COSTS, joined by one clear large '=' drawn as two bars, no lamp digits. 3) Card 3: close the 12.1% empty band (at most 12%) by sizing the board or spacing. 4) Card 4: every piece of type at least 35 px of ink, the board label included. 5) Make the lamp digits on cards 1, 3 and 4 read clearly as 40, 1, 43 and 59 at phone size (390 px wide): bigger lamps or tighter spacing.

## Contract
Edit only draw.py; outputs out/card-1.png to card-6.png at 1080x1350 from words.json. Colours and fonts only from config/ve/brand-tokens.json and the Brand section; no system font; no logos, clipart people, card numbers, footnotes or URLs except the close CTA; the mark is the official file.

## Brand (carousel, off, 2026-11-19; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"body": {"icon": false, "wordmark": "bottom_right_small"}, "close": "house_close_slide", "kind": "off", "logo_top": false, "opening": "own_idea", "series": null, "shape": "4x5"}
Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.

## References (the inspiration cards Krish ticked; build to them, never copy them)
- fortytoone-direction (the infographic style Krish saved for this idea: one number per card, a stadium scoreboard; week 2026-11-16 ideas.json, option fortytoone)
- instagram-inspo-sheet (Krish's Drive 'Instagram inspo.xlsx': off-day utility bar, a scroll-stopping cover and cards the reader can use the same day; Krish, 2026-11-16)

## Deck (6 cards; the words are fixed and passed scripts/carousel_check.py)
- card 1: cover, one picture of its point
- card 2: happened, one picture of its point
- card 3: why, one picture of its point
- card 4: so_what, one picture of its point
- card 5: do, one picture of its point
- card 6: last card, one picture of its point
Template every card with placeholders; the session fills in the deck's words when it renders.

## Acceptance (every command must exit 0 inside your sandbox)
python3 .scratch/carousel/midterms/draw.py .scratch/carousel/midterms/words.json
python3 scripts/carousel_check.py --cards .scratch/carousel/midterms/out/card-1.png .scratch/carousel/midterms/out/card-2.png .scratch/carousel/midterms/out/card-3.png .scratch/carousel/midterms/out/card-4.png .scratch/carousel/midterms/out/card-5.png .scratch/carousel/midterms/out/card-6.png

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-carousel-midterms-3", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
