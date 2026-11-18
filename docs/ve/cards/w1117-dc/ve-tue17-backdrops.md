---
card: ve-tue17-backdrops
motion_style: eating-jobs-ladder
kind: plates
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 40
cwd: /tmp/ve-local/worktrees/content-engine/ve-card/ve-tue17-backdrops
write_allow: [docs/plans/2026-11-17-tuesday/ve/plates/**]
read: [docs/plans/2026-11-17-tuesday/ve/spec.json]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Tue 17: four full-screen backdrops, made by Codex

## Goal
Krish, 18 Nov 2026, on Tue 17's piece (b019dbf8): the full-screen moments must use the whole screen ("often I'm seeing it cut away to a black screen with not much on it but subtitles") and "Just get Codex to generate the scenes." Make four backdrop photographs with your `image_generation` tool, two candidates each, 9:16 at 1024x1536 or larger. They sit behind animated graphics, so: a documentary photograph, natural light, a muted grade with deep ink-green shadows, the lower third calm and dark enough for captions, no words, numbers, logos or recognisable people anywhere.

- `bg-data-hall`: The inside of a vast data centre hall: long rows of black server racks with small blue and green status lights receding into the distance, cool haze, cinematic depth.
- `bg-city-dusk`: A small Midwestern American city skyline at dusk seen from a low hill: brick downtown, water tower, warm window lights, power lines in the foreground.
- `bg-polling`: A small-town American polling place inside a community hall: voting booths with privacy screens in a row, a ballot box on a table, folding chairs, morning light.
- `bg-pylons`: A line of tall steel electricity pylons marching across flat Ohio farmland towards the horizon under a dramatic overcast sky.

Write each candidate to `docs/plans/2026-11-17-tuesday/ve/plates/<id>-<n>.png` (n = 1, 2) and one sidecar `docs/plans/2026-11-17-tuesday/ve/plates/backdrops.json`: {"<id>": {"prompt": the exact prompt, "model": the image model, "candidates": ["<id>-1.png", "<id>-2.png"]}}. Look at each image (view_image) and regenerate any with words or a recognisable person. Never edit anything outside that folder.

## Contract
Stills only, made with the image_generation tool; no code, no edits outside the plates folder.

## Motion style: One object carries the story (from the eating-its-own-jobs cut) (eating-jobs-ladder, untested)
One object, a career ladder, carries the whole piece: every number is counted onto, beside or in place of a part of it, on a vignetted ink desk or in a butter tray over his chest, and every scene that steps away ends by turning back into the ladder, changed.
Build to these rules; brand roles (config/ve/brand-tokens.json) and the design lock win where they differ.
- one through-line object for the whole piece, changed on screen, never replaced
- numbers roll onto the object on the enter curve and land on their word
- a slow push holds every panel; nothing holds still
- every change is a 10-frame crossfade on its word; no slide or whip exits
- mint marks only the answer; the series colour is never a warning
Never:
- figures or icons acting out a sentence
- on-screen words repeating what he says
- eyebrow labels, kickers or asterisks
- a hard cut between panels except into the end card

## Acceptance (every command must exit 0 inside your sandbox)
python3 -c "import json,os,sys;d=json.load(open('docs/plans/2026-11-17-tuesday/ve/plates/backdrops.json'));ids=['bg-data-hall','bg-city-dusk','bg-polling','bg-pylons'];[sys.exit('missing '+i) for i in ids if i not in d];[sys.exit('missing '+c) for i in ids for c in d[i]['candidates'] if not os.path.isfile('docs/plans/2026-11-17-tuesday/ve/plates/'+c)];print('ok')"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-tue17-backdrops", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
