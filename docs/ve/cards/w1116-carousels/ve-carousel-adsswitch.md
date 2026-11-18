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
FIX ROUND: rewrite .scratch/carousels/adsswitch/render.py to the corrected spec below and re-render every card; the last round set text left-aligned and too small, left empty bands, and typed the word 'Codex' on the cover where the OpenAI wordmark image belongs.
THE HOUSE LOOK (docs/CAROUSEL-STANDARD.md, "The house carousel look"; Krish, 18 Nov: covers as the Git and homework covers, body cards as the Erdos deck, real-world images first). Every card is 1080x1350 on the ink ground (#0C1512), image-led, and ALL TEXT IS CENTRED on x=540 inside the safe box (80 px in from every edge: x 80-1000, y 80-1270). It must pass scripts/carousel_check.py --cards (lines centred within 24 px, nothing outside the safe box, no empty band over 12% of the height, body ink at least 35 px, picture at least 12%, cover headline at least 1.3x the body headlines and different from them in at least 2 of 3 ways).
COVER (card 1): the scene fills the top 0-800 px edge to edge (scale to cover, centre crop, never stretch), fading into the ink over its last 160 px. Then, centred, stacked with no empty gaps over 60 px and filling down to y~1250: (a) the company wordmark image when the deck names one, white, 46 px tall, using the exact file named below (never typed text); (b) the headline in Anton ALL CAPS at 112-128 px, leading 0.95: the first sentence cream #F4EFE4, the second sentence mint #7EF0C0; (c) the subline in Archivo SemiBold 40 px cream; (d) the makeyourmindup mark (the file named below, 150 px wide) at x 850-1000, y ~1230-1270.
BODY CARDS: the card's scene fills the top 0-700 px edge to edge, fading into ink over its last 140 px. Then, centred, the card's headline sentence in Archivo Bold 56 px cream (at most five lines, leading 1.15), its key number or phrase may be mint; then 28 px below, the card's line in Archivo Regular 40 px cream at 80%. Vertically centre that text block between y 720 and y 1200 so no empty band exceeds 12%. The mark as on the cover.
CLOSE (last card): its scene in the top 0-640 px with the same fade; the takeaway centred in Anton ALL CAPS 78-88 px, the first clause cream and the turn mint; then "Subscribe free (makeyourmindup.ai)" in Archivo SemiBold 44 px mint; the mark as on the cover.
TYPE: fonts only from assets/fonts/makeyourmindup (Anton-Regular.ttf; Archivo-Variable.ttf at its Bold, SemiBold and Regular named instances). Never a system font. No card numbers, footnotes, URLs (except the close's subscribe line), badges, extra gradients, drawn icons or diagrams: the scene is the picture.
WORDS: exactly the deck's words (cards[].headline and cards[].line), never rewritten and never replaced with other text. Scenes used as given (scale and crop only).
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
