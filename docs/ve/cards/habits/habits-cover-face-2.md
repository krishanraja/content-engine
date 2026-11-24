---
card: habits-cover-face-2
kind: cover
model: gpt-6.1-sol
effort: medium
max_minutes: 30
max_calls: 30
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/habits-cover-face-1
write_allow: [.scratch/covers-habits/draw.py, .scratch/covers-habits/out/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, config/channel-safe-zones.json, docs/production/COVER-STANDARD.md, .scratch/covers-habits/photos/*, .scratch/covers-habits/proofs/*, .scratch/covers-habits/brand/wordmark.png
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-led tall covers, repair 1: options 2 and 3

## Goal
Card habits-cover-face-1 (the same worktree) drew option 1 and stopped on two assertions in .scratch/covers-habits/draw.py. Option 1 is right: keep its geometry exactly, so .scratch/covers-habits/out/option-1-tall.png stays byte-for-byte as it is. Change only what follows, then draw options 2 and 3.
1. Opaque means alpha above 16, in every test: the photo-edge test (natural.png's alpha meets its left side from 88% of its height, its right from 76%; glasses.png's left from 70%, measured at alpha above 16) and the overlap test (a pixel counts when the card or its shadow has alpha above 16 and the cutout has alpha above 16). Faint halo below 16 is invisible and does not count; nothing else in the tests is loosened.
2. Keep at least 24 px of ink between the bottom of the card's visible shadow and the top of his hair in every option.
3. Option 2 (natural.png + proofs/proof-title.png): the card is too tall to clear his head. Draw that card at 640 px wide on the same left edge (x 72) so it ends higher, and place the photo so his face is still about a third of the frame with every edge row below the canvas bottom.
4. Option 3 (glasses.png + proofs/proof-71-strip.png): draw it with the same rules as option 1.
All other rules of habits-cover-face-1 stand: the exact words, every word inside x 72-860, y 280-1300, nothing behind or over his head (Krish, 2026-11-18: "The screenshots hide behind my head a little bit too much here."), no photo edge visible (Krish: "the fact that my shoulders cut off is unacceptable"), and no glow, gradients, badges, logos or his name.

## Contract
Outputs: .scratch/covers-habits/out/option-{1,2,3}-tall.png (1080x1920) and .scratch/covers-habits/draw.py. Colours and fonts only from config/ve/brand-tokens.json (ink, cream, mint) and the repository's font files, never a system font. At most three parts besides the headline: face, proof card, wordmark. His name never appears. Never edit, recolour or redraw the photos or proofs: scale, place and tilt only.

## Brand (thumbnail_wide, series, 2026-11-17; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"house": "brand-tokens roles: ink ground, cream text, mint brand; official wordmark on ink", "kind": "off", "palette": "none (the palette has no off thumbnail_wide (it is made only on shape, series days))"}

## Brand (cover_tall, series, 2026-11-17; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"house": "brand-tokens roles: ink ground, cream text, mint brand; official wordmark on ink", "kind": "off", "palette": "none (the palette has no off cover_tall (it is made only on shape, series days))"}

## Face (channel tiktok; Ruling, Krish, 2026-11-17)
His cutout headshot fills about a third of the frame, cut out on the series colour, never a circle; the headline is the largest thing (at most 7 words, docs/production/COVER-STANDARD.md); at most three parts besides it; no badge; his name never appears. Use only these photos, unedited apart from scale and position: .scratch/covers-habits/photos/shoulders.png, .scratch/covers-habits/photos/natural.png, .scratch/covers-habits/photos/glasses.png.
Draw both sizes: 1280x720 and 1080x1920, the tall one clear of the 3:4 grid crop (scripts/channel_safe.py).
Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.

## References (the inspiration cards Krish ticked; build to them, never copy them)
- krish-chat-2026-11-17-rio-meets (the Rio Meets 'I LOVE CRISTIANO!' thumbnail Krish sent: cutout faces large, the headline huge on a deep colour)
- 7f43c6b5-a468-40f3-ad66-c988cdc16072 instagram_DePHDr_jRed (his note: 'a really good thumbnail like this one': one short plain line in one bright colour, set high and clear, nothing else competing)

## Acceptance (every command must exit 0 inside your sandbox)
python3 .scratch/covers-habits/draw.py
python3 -c "from PIL import Image; import sys; [sys.exit(1) for n in (1,2,3) if Image.open(f'.scratch/covers-habits/out/option-{n}-tall.png').size!=(1080,1920)]"
python3 -c "import hashlib,sys; sys.exit(hashlib.sha256(open('.scratch/covers-habits/out/option-1-tall.png','rb').read()).hexdigest()!='0fd979cbefe5bdfd85b216b9b01badcd3988997080d800907ac6aef0e649d4e4')"
python3 scripts/channel_safe.py .scratch/covers-habits/out/option-1-tall.png --shape cover_tall
python3 scripts/channel_safe.py .scratch/covers-habits/out/option-2-tall.png --shape cover_tall
python3 scripts/channel_safe.py .scratch/covers-habits/out/option-3-tall.png --shape cover_tall

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "habits-cover-face-2", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
