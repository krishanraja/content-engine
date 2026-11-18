---
card: ve-carousel-adsswitch
kind: carousel
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-carousel-adsswitch
write_allow: [.scratch/carousels/adsswitch/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, docs/CAROUSEL-STANDARD.md, docs/plans/2026-11-16-week/ads-carousel/deck.json, .scratch/carousels/adsswitch/scenes/*, .scratch/carousels/adsswitch/brand/*, assets/fonts/makeyourmindup/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Ads carousel in the house look: Free ChatGPT has ads now, three ways round them (7 cards, 4:5)

## Goal
THE HOUSE LOOK (docs/CAROUSEL-STANDARD.md, "The house carousel look"; Krish, 18 Nov: covers as the Git and homework covers, body cards as the Erdos deck, real-world images first). Every card is 1080x1350 on the ink ground (#0C1512) and is image-led.
COVER (card 1): the cover scene fills the top 0-820 px edge to edge (scale to cover, centre crop, never stretch), then fades into the ink over its last 140 px (a straight vertical fade to solid ink, nothing else). Below, left-aligned at x=72, max width 936: (a) the company wordmark when the deck names one, white, 40-48 px tall, at y~850; (b) the headline in Anton, ALL CAPS, as large as fits two to four lines (aim 104-124 px, tight 0.95 leading): the first sentence in cream #F4EFE4, the turn (second sentence) in mint #7EF0C0; (c) one subline in Archivo SemiBold 34-38 px, cream at 85%; (d) the makeyourmindup mark small (150 px wide) at the bottom right, 56 px from the right and bottom edges. Nothing else.
BODY CARDS: the card's own scene fills the top 0-760 px edge to edge, fading into ink over its last 120 px. Below, left-aligned at x=72, max width 936: the card's headline sentence in Archivo Bold 54-62 px cream, line height 1.12, at most four lines; one key number or phrase in it may be mint; then the card's small line (if any) in Archivo Regular 32 px, cream at 75%, 22 px below. The mark small at the bottom right as on the cover. Each card's sentence must sit clear of the mark.
CLOSE (last card): its scene in the top 0-700 px with the same fade; the takeaway in Anton 84-96 px, cream with the turn in mint; then "Subscribe free (makeyourmindup.ai)" in Archivo SemiBold 38 px mint; the mark at the bottom right.
TYPE: fonts only from assets/fonts/makeyourmindup (Anton-Regular.ttf, Archivo-Variable.ttf set to its Bold/SemiBold/Regular named instances). Never a system font. No card numbers, no footnotes, no URLs other than the close's subscribe line, no extra badges, no gradients other than the scene fade, no drawn icons or diagrams: the scene is the picture.
WORDS: exactly the deck's words (cards[].headline and cards[].line), never rewritten. Scenes are used as given (scale and crop only, never redrawn or recoloured).
THIS DECK: docs/plans/2026-11-16-week/ads-carousel/deck.json, 7 cards. Scenes: .scratch/carousels/adsswitch/scenes/ads-1.png is card 1's, ads-2.png card 2's, and so on to ads-7.png for card 7 (the close). Company wordmark on the cover: .scratch/carousels/adsswitch/brand/openai-wordmark-dark.png (OpenAI's official wordmark for dark grounds; ChatGPT is OpenAI's). The mark: .scratch/carousels/adsswitch/brand/wordmark.png. Cover headline: 'FREE CHATGPT HAS ADS NOW.' in cream, 'HERE ARE THREE WAYS ROUND THEM.' in mint; subline the cover's line.

## Contract
Outputs: .scratch/carousels/adsswitch/card-1.png to card-7.png (1080x1350) and .scratch/carousels/adsswitch/render.py (Pillow). Everything in THE HOUSE LOOK above; the words exactly the deck's.

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
