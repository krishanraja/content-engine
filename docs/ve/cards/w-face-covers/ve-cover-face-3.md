---
card: ve-cover-face-3
kind: cover
model: gpt-6.1-sol
effort: medium
max_minutes: 30
max_calls: 30
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-cover-face-1
write_allow: [.scratch/covers/draw.py, .scratch/covers/out/option-1-tall.png, .scratch/covers/out/option-2-tall.png, .scratch/covers/out/option-3-tall.png, .scratch/covers/out/option-3-wide.png]
read: config/ve/brand-tokens.json, config/brand-palette.json, config/channel-safe-zones.json, docs/production/COVER-STANDARD.md, .scratch/covers/photos/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-led covers, round three: the critic's fixes

## Goal
A separate critic judged round two. Fix exactly these in .scratch/covers/draw.py, nothing else:
1. Tall covers (all three): the cutout is about half the frame and outweighs the headline. Scale it so the head and shoulders take about a third of the frame and the headline stays the largest thing, still anchored at the bottom with the shoulders running off the bottom edge.
2. Tall covers: each photo's own straight vertical edge shows at a shoulder (option 1 at both sides, option 2 on the left, option 3 at both sides). Place each cutout so any straight edge of the photo lies outside the frame: a side edge runs off the left or right edge of the canvas, or the shoulders are cropped by the canvas, never ending in a vertical line on the yellow.
3. option-3-wide.png: the jacket's right side ends in a straight cut at about x 1255; run it off the frame edge.
Leave option-1-wide.png and option-2-wide.png byte-for-byte unchanged.

## Contract
Outputs: .scratch/covers/out/option-{1,2,3}-wide.png (1280x720) and option-{1,2,3}-tall.png (1080x1920). Colours and fonts only from the Brand sections below and config/ve/brand-tokens.json; fonts from the repository's font files named there, never a system font. At most three parts besides the headline: the face, the quiet series label, the wordmark. No logos, badges or proof tags. His name never appears. The tall cover keeps the headline and face inside the 3:4 grid crop and clear of the caption zone (config/channel-safe-zones.json). Never edit, recolour or redraw the photos: scale and position only.

## Brand (thumbnail_wide, series, 2026-11-16; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"kind": "series", "logo": "none", "series": "follow_the_money", "shape": "16x9", "why": "the corpus: avoid small logos and lower-right text on YouTube thumbnails"}

## Brand (cover_tall, series, 2026-11-16; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"kind": "series", "logo": "masthead_in_cover_grid", "series": "follow_the_money", "shape": "9x16", "why": "a separate cover, never the opening frame; proof, headline and brand inside tall_cover_grid"}

## Face (channel tiktok; Ruling, Krish, 2026-11-17)
His cutout headshot fills about a third of the frame, cut out on the series colour, never a circle; the headline is the largest thing (at most 7 words, docs/production/COVER-STANDARD.md); at most three parts besides it; no badge; his name never appears. Use only these photos, unedited apart from scale and position: .scratch/covers/photos/denim.png, .scratch/covers/photos/glasses.png, .scratch/covers/photos/natural.png.
Draw both sizes: 1280x720 and 1080x1920, the tall one clear of the 3:4 grid crop (scripts/channel_safe.py).
Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.

## References (the inspiration cards Krish ticked; build to them, never copy them)
- krish-chat-2026-11-17-rio-meets (the Rio Meets 'I LOVE CRISTIANO!' thumbnail Krish sent: two cutout faces large either side, the headline huge between them on a deep colour)

## Acceptance (every command must exit 0 inside your sandbox)
python3 .scratch/covers/draw.py
python3 -c "from PIL import Image; import sys; [sys.exit(1) for n in (1,2,3) for s,w,h in (('wide',1280,720),('tall',1080,1920)) if Image.open(f'.scratch/covers/out/option-{n}-{s}.png').size!=(w,h)]"
python3 scripts/channel_safe.py --shape cover_tall .scratch/covers/out/option-1-tall.png
python3 scripts/channel_safe.py --shape cover_tall .scratch/covers/out/option-2-tall.png
python3 scripts/channel_safe.py --shape cover_tall .scratch/covers/out/option-3-tall.png

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-cover-face-3", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
