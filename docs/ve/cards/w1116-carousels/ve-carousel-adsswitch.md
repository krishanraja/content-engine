---
card: ve-carousel-adsswitch
kind: carousel
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-carousel-adsswitch
write_allow: [.scratch/carousels/adsswitch/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, docs/CAROUSEL-STANDARD.md, docs/plans/2026-11-16-week/ads-carousel/deck.json, .scratch/carousels/adsswitch/brand/wordmark.png (the official wordmark, unaltered), .scratch/carousels/adsswitch/brand/robot-standing-source.webp (the house felt robot, config/brand-robot.json: cut it out and place it, never redraw, recolour or stretch it)
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Off-day carousel: Free ChatGPT has ads now, three ways round them (7 cards, 4:5)

## Goal
Draw the seven 1080x1350 cards of the deck named below, each card's point as one picture of real size (at least 12% of the card), never type on plain ground. Card 1 is a full-bleed scene of one specific funny moment (a phone on a kitchen table showing a ChatGPT answer with a Sponsored card under it, the house felt robot (the reference photo named in Read, cut out and placed, never redrawn) beside it holding a price tag reading 0), headline at least 1.3 times the body cards' size, a different layout from the body cards in two of three ways. The experiment: a trade-off scale on every body card after the cover, what you give up against what you get, so each workaround reads in one glance. Card 7 is the palette's close: the takeaway, one picture, 'Subscribe free (makeyourmindup.ai)', the wordmark small bottom right.

## Contract
Outputs: .scratch/carousels/adsswitch/card-{1..7}.png (1080x1350) and .scratch/carousels/adsswitch/render.py. Colours, type and the mark only from the Brand section below and config/ve/brand-tokens.json; fonts from the repository's font files, never a system font. Body type at least 35 px of ink. No card numbers, footnotes, dates or URLs on the art other than the close's subscribe line. No real logo except ChatGPT's own where the card names ChatGPT, monochrome. Nothing outside the safe box; no empty band over 12%.

## Brand (carousel, off, 2026-11-19; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"body": {"icon": false, "wordmark": "bottom_right_small"}, "close": "house_close_slide", "kind": "off", "logo_top": false, "opening": "own_idea", "series": null, "shape": "4x5"}
Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.

## References (the inspiration cards Krish ticked; build to them, never copy them)
- drive:1emR7rjLsYEgS5bkJbYgvjyjbNjtSw0vI (Krish's research doc saved for this carousel, 'When the Assistant Becomes the Ad', 6 Nov)

## Deck (7 cards; the words are fixed and passed scripts/carousel_check.py)
- card 1: cover, one picture of its point
- card 2: happened, one picture of its point
- card 3: why, one picture of its point
- card 4: so_what, one picture of its point
- card 5: so_what, one picture of its point
- card 6: do, one picture of its point
- card 7: last card, one picture of its point
Template every card with placeholders; the session fills in the deck's words when it renders.

## Acceptance (every command must exit 0 inside your sandbox)
python3 .scratch/carousels/adsswitch/render.py
python3 scripts/carousel_check.py --cards .scratch/carousels/adsswitch/card-1.png .scratch/carousels/adsswitch/card-2.png .scratch/carousels/adsswitch/card-3.png .scratch/carousels/adsswitch/card-4.png .scratch/carousels/adsswitch/card-5.png .scratch/carousels/adsswitch/card-6.png .scratch/carousels/adsswitch/card-7.png

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-carousel-adsswitch", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
