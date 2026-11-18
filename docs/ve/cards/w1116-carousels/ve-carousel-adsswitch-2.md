---
card: ve-carousel-adsswitch-2
kind: carousel
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-carousel-adsswitch
write_allow: [.scratch/carousels/adsswitch/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, docs/CAROUSEL-STANDARD.md, docs/plans/2026-11-16-week/ads-carousel/deck-v2.json, assets/logos/openai-logo.svg, assets/fonts/makeyourmindup/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Ads carousel v2 in the house look: Free ChatGPT has ads now, what switching them off costs (8 cards, 4:5)

## Goal
Build 8 cards 1080x1350 to the house look (docs/CAROUSEL-STANDARD.md, 'The house carousel look'). Ink ground, image-led, ALL TEXT CENTRED on x=540 inside the safe box (80 px in from every edge). Words exactly the deck's headline and line, never rewritten.
SCENES: download each once into .scratch/carousels/adsswitch/scenes/ (base https://d8j0ntlcm91z4.cloudfront.net/user_3EHoG5PVkilXbvUobkwyA3pk0A2/): ads-1.png = hf_20261118_203846_07ee6d27-fd44-42e6-b67f-343a0f27ac2f.png; ads-3.png = hf_20261118_203844_339961bd-d986-48ad-ae6d-de61543e0e8b.png; ads-4.png = hf_20261118_203845_962a3964-f775-42ee-99a1-df1781bf1c9c.png; ads-5.png = hf_20261118_203844_5e27398c-f400-46c6-9cae-398b4c31587c.png; ads-6.png = hf_20261118_203845_0f43fd44-d6e8-4598-8e56-6524b65cf227.png; ads-7.png = hf_20261118_203844_cba4a5a9-cac3-4b3e-953f-50095c24bd90.png; ads-8.png = hf_20261118_203845_4ec924cf-2d31-4d81-bc77-8a1b8a932dbc.png. Card 2 uses the real OpenAI help-page image https://images.ctfassets.net/j22is2dtoxu1/45gBDlpsPyrcBXyq6KoPOD/c8f39c602ea719d7ad9f14e774dd1aa4/97cc3e77-9a02-4ef4-bd75-d347531609b4.png : crop the LEFT phone (x160-480, y15-660), place it sharp and centred in the top 700 px over a darkened (ink 80%), blurred copy of the same image, with a faint mint glow. Other scenes: scale-to-cover, centre crop, never stretch.
MARKS: OpenAI wordmark = assets/logos/openai-logo.svg (white). Make Your Mind Up wordmark and mark = the files in krishanraja/makeyourmindup apps/cover/public/brand on this machine ('makeyourmindup wordmark.png', 'makeyourmindup mark.png'), sha256 checked against config/brand-palette.json marks; never typed or redrawn.
COVER (card 1): scene fills 0-800 fading into ink over its last 160 px. Centred below, no gap over 60 px, down to y~1250: OpenAI wordmark white 46 px tall; headline Anton ALL CAPS 112-128 px leading 0.95, first sentence cream #F4EFE4, second sentence mint #7EF0C0; the card's line in Archivo SemiBold 40 px cream; the mark 150 px wide at x850-1000,y~1230-1270.
BODY CARDS 2-7: scene fills 0-700 fading into ink over its last 140 px. Then centred: a small IBM Plex Mono kicker in mint (2 WHAT HAPPENED, 3 WHY, 4 THE BIGGER PICTURE, 5 THE TRAP, 6 THE SWITCH, 7 THE WORKAROUND), a short mint rule, the headline in Archivo Black 52-56 px cream, leading 1.12, at most five lines, its key phrase in mint (2 'a labelled ad', 3 'ads help pay', 4 'paying its way the same way', 5 'still shows ads', 6 'fewer daily messages and no image creation', 7 'erases the conversation'); 28 px below, the line in Archivo Regular 38 px cream 80%. Centre the block between y 720 and y 1200 so no empty band exceeds 12%. Mark bottom right as on the cover.
CLOSE (card 8, the palette's house_close_slide): scene in 0-600 with the same fade; the headline as the takeaway in Anton ALL CAPS 66-76 px, first clause cream ('CHOOSE YOUR PRICE ON PURPOSE:') and 'ADS, MONEY OR LIMITS,' mint, rest cream; then 'Follow for more' in Archivo SemiBold 48 px mint; then the Make Your Mind Up wordmark centred directly under it, about 420 px wide. NO corner mark on this card, no URL.
Fonts only from assets/fonts/makeyourmindup. No card numbers, footnotes, badges or icons.

## Contract
Outputs: .scratch/carousels/adsswitch/card-1.png to card-8.png (1080x1350) and render.py (Pillow). Words exactly the deck-v2 words.

## Brand (carousel, off, 2026-11-20; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"body": {"icon": false, "wordmark": "bottom_right_small"}, "close": "house_close_slide", "kind": "off", "logo_top": false, "opening": "own_idea", "series": null, "shape": "4x5"}
Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.

## References (the inspiration cards Krish ticked; build to them, never copy them)
- drive:1emR7rjLsYEgS5bkJbYgvjyjbNjtSw0vI (Krish's research doc saved for this carousel, 'When the Assistant Becomes the Ad', 6 Nov)

## Deck (8 cards; the words are fixed and passed scripts/carousel_check.py)
- card 1: cover, one picture of its point
- card 2: happened, one picture of its point
- card 3: why, one picture of its point
- card 4: so_what, one picture of its point
- card 5: do, one picture of its point
- card 6: do, one picture of its point
- card 7: do, one picture of its point
- card 8: last card, one picture of its point
Template every card with placeholders; the session fills in the deck's words when it renders.

## Acceptance (every command must exit 0 inside your sandbox)
python3 .scratch/carousels/adsswitch/render.py
python3 scripts/carousel_check.py --cards .scratch/carousels/adsswitch/card-1.png .scratch/carousels/adsswitch/card-2.png .scratch/carousels/adsswitch/card-3.png .scratch/carousels/adsswitch/card-4.png .scratch/carousels/adsswitch/card-5.png .scratch/carousels/adsswitch/card-6.png .scratch/carousels/adsswitch/card-7.png .scratch/carousels/adsswitch/card-8.png

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-carousel-adsswitch-2", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
