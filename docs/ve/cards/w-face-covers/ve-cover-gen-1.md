---
card: ve-cover-gen-1
kind: cover
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-cover-face-1
write_allow: [.scratch/covers/draw_gen.py, .scratch/covers/out-gen/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, config/channel-safe-zones.json, docs/production/COVER-STANDARD.md, .scratch/covers/gen/*, .scratch/covers/brand/wordmark.png, .scratch/covers/draw_posts.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Covers from generated headshots and generated post imagery

## Goal
Same three posts, headlines and series colours as .scratch/covers/draw_posts.py, but built from generated images. Write .scratch/covers/draw_gen.py making .scratch/covers/out-gen/{music,rats,seniors}-{wide,tall}.png (1280x720 and 1080x1920):
- Each post has a generated headshot (.scratch/covers/gen/head-<post>.png, a full photo with its own backdrop) and a generated scene (.scratch/covers/gen/scene-<post>.png).
- The headshot is a full-bleed photo panel, never cut out: on wide covers it fills the right 45% of the canvas from top to bottom; on tall covers it fills the lower half edge to edge. Crop it with cover-fit so the panel's edges are the canvas edges and the head and both shoulders sit naturally inside, nothing of the face cut.
- The scene fills the rest of the canvas as the background behind the text, darkened with a flat near-black overlay (about 70%) so the headline reads at full contrast. A clean straight seam between scene and headshot panel; no feathering, glow, gradients or borders.
- Headline in the series colour, the quiet series label above, the wordmark (.scratch/covers/brand/wordmark.png, unaltered) under it, all left-aligned on one edge with generous margins, exactly as in draw_posts.py.
Classy: nothing else on the cover.

## Contract
Outputs: .scratch/covers/out/option-{1,2,3}-wide.png (1280x720) and option-{1,2,3}-tall.png (1080x1920). Colours and fonts only from the Brand sections below and config/ve/brand-tokens.json; fonts from the repository's font files named there, never a system font. At most three parts besides the headline: the face, the quiet series label, the wordmark. No logos, badges or proof tags. His name never appears. The tall cover keeps the headline and face inside the 3:4 grid crop and clear of the caption zone (config/channel-safe-zones.json). Never edit, recolour or redraw the photos: scale and position only.

## Brand (thumbnail_wide, series, 2026-11-16; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"kind": "series", "logo": "none", "series": "follow_the_money", "shape": "16x9", "why": "the corpus: avoid small logos and lower-right text on YouTube thumbnails"}

## Brand (cover_tall, series, 2026-11-16; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"kind": "series", "logo": "masthead_in_cover_grid", "series": "follow_the_money", "shape": "9x16", "why": "a separate cover, never the opening frame; proof, headline and brand inside tall_cover_grid"}

## Face (channel tiktok; Ruling, Krish, 2026-11-17)
His cutout headshot fills about a third of the frame, cut out on the series colour, never a circle; the headline is the largest thing (at most 7 words, docs/production/COVER-STANDARD.md); at most three parts besides it; no badge; his name never appears. Use only these photos, unedited apart from scale and position: .scratch/covers/gen/head-music.png, .scratch/covers/gen/head-rats.png, .scratch/covers/gen/head-seniors.png.
Draw both sizes: 1280x720 and 1080x1920, the tall one clear of the 3:4 grid crop (scripts/channel_safe.py).
Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.

## References (the inspiration cards Krish ticked; build to them, never copy them)
- krish-chat-2026-11-17-rio-meets (the Rio Meets 'I LOVE CRISTIANO!' thumbnail Krish sent: two cutout faces large either side, the headline huge between them on a deep colour)

## Acceptance (every command must exit 0 inside your sandbox)
python3 .scratch/covers/draw_gen.py
python3 -c "from PIL import Image; import sys; [sys.exit(1) for n in ('music','rats','seniors') for s,w,h in (('wide',1280,720),('tall',1080,1920)) if Image.open(f'.scratch/covers/out-gen/{n}-{s}.png').size!=(w,h)]"
python3 scripts/channel_safe.py --shape cover_tall .scratch/covers/out-gen/music-tall.png
python3 scripts/channel_safe.py --shape cover_tall .scratch/covers/out-gen/rats-tall.png
python3 scripts/channel_safe.py --shape cover_tall .scratch/covers/out-gen/seniors-tall.png

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-cover-gen-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
