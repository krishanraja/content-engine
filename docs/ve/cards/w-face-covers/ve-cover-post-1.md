---
card: ve-cover-post-1
kind: cover
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: /root/dev/makeyourmindup/.worktrees/content-engine/ve-card/ve-cover-face-1
write_allow: [.scratch/covers/draw_posts.py, .scratch/covers/out-posts/*]
read: config/ve/brand-tokens.json, config/brand-palette.json, config/channel-safe-zones.json, docs/production/COVER-STANDARD.md, .scratch/covers/photos/*, .scratch/covers/brand/wordmark.png, .scratch/covers/posts/*, .scratch/covers/draw.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Face-led covers with each post's own imagery: three old posts

## Goal
Krish: "the fact that my shoulders cut off is unacceptable. also can we experiment with imagery (real life or generated) that the covers would be generating for a specific post, being incorporated with my headshot? run examples of old posts so we can see what they look like - keep it classy". Write .scratch/covers/draw_posts.py (Pillow) making wide 1280x720 and tall 1080x1920 covers for three published posts, into .scratch/covers/out-posts/{music,rats,seniors}-{wide,tall}.png:
- music: "AI IS ALREADY IN THE MUSIC YOU LOVE", Wed under.the.hood, series colour #B7A6FF; image .scratch/covers/posts/music-figure-charts.png (the real Official Charts page); photo denim.png.
- rats: "COUNTING RAT TAILS", Fri mind.the.gap, #FF6A4D; image posts/rats-figure-leaderboard.png; photo glasses.png.
- seniors: "WHO TRAINS YOUR 2030 SENIORS?", Mon follow.the.money, #FFD84D; image posts/seniors-figure-ladder.png; photo shoulders.png.
Each cover: near-black ground; the headline large in the series colour with the quiet series label above and the wordmark (.scratch/covers/brand/wordmark.png, unaltered, on the dark only) under it, all left-aligned on one edge; the cutout large on one side; the post's image once, as a crisp lit card with a soft shadow, tilted at most 4 degrees, partly behind the cutout's shoulder, never covering the face or the headline. Classy: generous margins, no glow, neon, gradients, arrows, emoji or extra text.
SHOULDERS (hard rule): no edge of a photo may ever be visible inside the canvas. shoulders.png touches only its bottom edge: put that edge exactly on the canvas bottom. denim.png's alpha meets its left side from 77% of its height and its right from 73%; glasses.png's left from 70%: position and scale each so every row from that point down lies below the canvas bottom, and the bottom edge is off-canvas too. Check it in the script: assert no opaque photo pixel sits on a photo edge inside the canvas.

## Contract
Outputs: .scratch/covers/out/option-{1,2,3}-wide.png (1280x720) and option-{1,2,3}-tall.png (1080x1920). Colours and fonts only from the Brand sections below and config/ve/brand-tokens.json; fonts from the repository's font files named there, never a system font. At most three parts besides the headline: the face, the quiet series label, the wordmark. No logos, badges or proof tags. His name never appears. The tall cover keeps the headline and face inside the 3:4 grid crop and clear of the caption zone (config/channel-safe-zones.json). Never edit, recolour or redraw the photos: scale and position only.

## Brand (thumbnail_wide, series, 2026-11-16; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"kind": "series", "logo": "none", "series": "follow_the_money", "shape": "16x9", "why": "the corpus: avoid small logos and lower-right text on YouTube thumbnails"}

## Brand (cover_tall, series, 2026-11-16; config/brand-palette.json, Ruling, Krish, 2026-11-12)
{"kind": "series", "logo": "masthead_in_cover_grid", "series": "follow_the_money", "shape": "9x16", "why": "a separate cover, never the opening frame; proof, headline and brand inside tall_cover_grid"}

## Face (channel tiktok; Ruling, Krish, 2026-11-17)
His cutout headshot fills about a third of the frame, cut out on the series colour, never a circle; the headline is the largest thing (at most 7 words, docs/production/COVER-STANDARD.md); at most three parts besides it; no badge; his name never appears. Use only these photos, unedited apart from scale and position: .scratch/covers/photos/shoulders.png, .scratch/covers/photos/denim.png, .scratch/covers/photos/glasses.png.
Draw both sizes: 1280x720 and 1080x1920, the tall one clear of the 3:4 grid crop (scripts/channel_safe.py).
Colours and type only from the brand tokens; the mark is the official file, sized and placed, never type.

## References (the inspiration cards Krish ticked; build to them, never copy them)
- krish-chat-2026-11-17-rio-meets (the Rio Meets 'I LOVE CRISTIANO!' thumbnail Krish sent: two cutout faces large either side, the headline huge between them on a deep colour)

## Acceptance (every command must exit 0 inside your sandbox)
python3 .scratch/covers/draw_posts.py
python3 -c "from PIL import Image; import sys; [sys.exit(1) for n in ('music','rats','seniors') for s,w,h in (('wide',1280,720),('tall',1080,1920)) if Image.open(f'.scratch/covers/out-posts/{n}-{s}.png').size!=(w,h)]"
python3 scripts/channel_safe.py --shape cover_tall .scratch/covers/out-posts/music-tall.png
python3 scripts/channel_safe.py --shape cover_tall .scratch/covers/out-posts/rats-tall.png
python3 scripts/channel_safe.py --shape cover_tall .scratch/covers/out-posts/seniors-tall.png

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-cover-post-1", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
