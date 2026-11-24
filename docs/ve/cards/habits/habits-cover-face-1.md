---
card: habits-cover-face-1
kind: cover
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/habits-cover-face-1
write_allow: [.scratch/covers-habits/draw.py, .scratch/covers-habits/out/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, config/channel-safe-zones.json, docs/production/COVER-STANDARD.md, .scratch/covers-habits/photos/*, .scratch/covers-habits/proofs/*, .scratch/covers-habits/brand/wordmark.png
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-led tall covers, real variant: 71% of HR chiefs want AI overruled

## Goal
Write .scratch/covers-habits/draw.py (Pillow): three TALL face-led covers, 1080x1920 only, to .scratch/covers-habits/out/option-{1,2,3}-tall.png. No wide file (a 9:16 short only).
Words, exactly: 71% OF HR CHIEFS WANT AI OVERRULED. No series label (an off day carries none).
Each: flat ink ground; the headline in Anton, cream, as large as fits, left-aligned, the largest thing (OVERRULED may be mint); under it on the same edge the official wordmark .scratch/covers-habits/brand/wordmark.png, scaled only, on the ink; under that the proof once, a crisp card (the real IBM capture, scaled only, never redrawn or retyped), soft shadow, tilt at most 4 degrees, in its own space between the wordmark and his head; below, his cutout about a third of the frame, shoulders off the canvas bottom.
- option 1: shoulders.png + proofs/proof-71.png (IBM's paragraph with the date and the 71% sentence)
- option 2: natural.png + proofs/proof-title.png (IBM's masthead mark and the release title)
- option 3: glasses.png + proofs/proof-71-strip.png (the three lines of the 71% sentence)
Every word (headline, wordmark, proof text) inside x 72-860, y 280-1300: Instagram's caption starts at y 1320, the rails at x 880 (config/channel-safe-zones.json). Face and shoulders may go below 1300.
NOTHING BEHIND OR OVER HIS HEAD (Krish, 2026-11-18: "The screenshots hide behind my head a little bit too much here."): assert no pixel of the card or its shadow overlaps the cutout's opaque pixels.
SHOULDERS (Krish: "the fact that my shoulders cut off is unacceptable"): no photo edge visible in the canvas. shoulders.png touches only its bottom edge: that edge on the canvas bottom. natural.png's alpha meets its left side from 88% of its height, its right from 76%; glasses.png's left from 70%: every row from there down lies below the canvas bottom. Assert no opaque photo pixel sits on a photo edge inside the canvas.
Classy: generous margins; no glow, neon, gradients, arrows, emoji, badges, logos or his name.

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
python3 scripts/channel_safe.py .scratch/covers-habits/out/option-1-tall.png --shape cover_tall
python3 scripts/channel_safe.py .scratch/covers-habits/out/option-2-tall.png --shape cover_tall
python3 scripts/channel_safe.py .scratch/covers-habits/out/option-3-tall.png --shape cover_tall

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "habits-cover-face-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
