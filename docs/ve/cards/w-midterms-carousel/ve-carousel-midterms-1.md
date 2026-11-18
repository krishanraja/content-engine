---
card: ve-carousel-midterms-1
kind: carousel
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-carousel-midterms-1
write_allow: [.scratch/carousel/midterms/draw.py, .scratch/carousel/midterms/words.sample.json, .scratch/carousel/midterms/out/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, config/carousel-layout.json, docs/CAROUSEL-STANDARD.md, scripts/carousel_layout.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Thursday off-day carousel: six 4:5 cards on one running stadium scoreboard

## Goal
Build a six-card 4:5 carousel (1080x1350 each) as code. One visual system across the deck: a stadium scoreboard with lamp-style digits. Card 1 is a full-bleed front cover: a night scene drawn in code, the scoreboard glowing over an empty small-town field, the board reading VOTERS 40, DATA CENTRES 1; the headline below the board at least 1.3 times the body headline size, laid out differently from the body cards. Cards 2 to 5: the headline at the top, then the board as a sourced chart taking at least 40% of the card: card 2 a grid of 41 ballot squares, 40 lit LIMIT and 1 plain; card 3 one bar filled to 43%; card 4 three panels (a big 59, small sites beside a solar field, a phone with a glowing chip); card 5 a two-question checklist. Card 6 is the palette's close: the takeaway headline, the board dimmed, then 'Subscribe free (makeyourmindup.ai)' and the wordmark small bottom right. Write .scratch/carousel/midterms/draw.py that reads every word from a JSON file given as its first argument (keys: cards[].headline, cards[].line, cards[].board, close_cta) and writes .scratch/carousel/midterms/out/card-1.png to card-6.png. Ship .scratch/carousel/midterms/words.sample.json with placeholder words of realistic length, and run draw.py on it.

## Contract
Outputs: .scratch/carousel/midterms/draw.py, words.sample.json, out/card-{1..6}.png at 1080x1350. Colours and fonts only from the Brand section and config/ve/brand-tokens.json, fonts from the repository's font files, never a system font. Every line of type centred; nothing outside 80 px of every edge; body headline ink at least 35 px tall; no empty band over 12% of the height. No card numbers, no footnotes, source strips, dates or URLs except the close's CTA. No logos, no stock icons, no clipart people. The mark is the official file, never type.

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
python3 .scratch/carousel/midterms/draw.py .scratch/carousel/midterms/words.sample.json
python3 -c "from PIL import Image; import sys; [sys.exit(1) for n in range(1,7) if Image.open(f'.scratch/carousel/midterms/out/card-{n}.png').size!=(1080,1350)]"
python3 scripts/carousel_check.py --cards .scratch/carousel/midterms/out/card-1.png .scratch/carousel/midterms/out/card-2.png .scratch/carousel/midterms/out/card-3.png .scratch/carousel/midterms/out/card-4.png .scratch/carousel/midterms/out/card-5.png .scratch/carousel/midterms/out/card-6.png

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-carousel-midterms-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
