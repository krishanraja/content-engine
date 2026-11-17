---
card: ve-cover-face-4
kind: cover
model: gpt-6.1-sol
effort: medium
max_minutes: 30
max_calls: 30
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-cover-face-1
write_allow: [.scratch/covers/draw.py, .scratch/covers/out/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, config/channel-safe-zones.json, docs/production/COVER-STANDARD.md, .scratch/covers/photos/*, .scratch/covers/brand/wordmark.png
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-led covers, round four: the wordmark, and one design across both sizes

## Goal
Krish: "we do need the makeyourmindup wordmark somewhere that looks good and aligned properly". Change .scratch/covers/draw.py so all six files carry it:
1. The wordmark is .scratch/covers/brand/wordmark.png (the official file, sha256 f896cc62...; white type, mint UP and mark, on transparent). Place it unedited: scale only, never recolour, crop or redraw. It sits only on the near-black ground (it disappears on yellow).
2. Wide covers: on the dark side, its left edge exactly on the headline's left edge, at the bottom of the dark area with the same margin as the series label has at the top; about 40 percent of the headline's width. Keep option-1 and option-2 wide otherwise as they are.
3. Tall covers: give them the wide covers' scheme, so each option reads as one design: the top part near-black with the series label, the headline in the series yellow and the wordmark under it, all left-aligned on one edge; your cutout on a yellow panel in the lower part as now (about a third of the frame, shoulders off the bottom edge, no straight photo edge on the yellow). The wordmark stays inside the 3:4 grid crop and clear of the caption zone.
4. Nothing else changes: same headline, same photos, no other parts.

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
{"card": "ve-cover-face-4", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
