---
card: ve-carousel-midterms-2
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

# Fix the midterms carousel renderer for the real words

## Goal
The renderer from ve-carousel-midterms-1 (.scratch/carousel/midterms/draw.py, same worktree) fails on the session's real words in .scratch/carousel/midterms/words.json, which are full sentence-case sentences of 11 to 19 words, longer than the sample. Do not change words.json. Rework draw.py so every card passes on those words: the cover headline at least 1.3 times the body headline size and different from the body cards in at least two of scale, headline position and share of picture (keep the scoreboard night scene full-bleed, headline big over the lower field); body headline and line type at least 35 px of ink, wrapped to fit, never shrunk below that; every line centred within 24 px; nothing outside 80 px of any edge (card 4's line currently overruns the bottom); keep the board at least 12% of each card. Keep the look: the stadium scoreboard with lamp digits, brand colours and fonts only.

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
{"card": "ve-carousel-midterms-2", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
