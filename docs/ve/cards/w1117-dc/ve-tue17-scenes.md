---
card: ve-tue17-scenes
motion_style: eating-jobs-ladder
kind: plates
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: /tmp/ve-local/worktrees/content-engine/ve-card/ve-tue17-scenes
write_allow: [docs/plans/2026-11-17-tuesday/ve/plates/**]
read: [docs/plans/2026-11-17-tuesday/ve/spec.json]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Tue 17: the seven comic scenes, made by Codex

## Goal
Krish, 18 Nov 2026, on Tue 17's piece (b019dbf8): "Just get Codex to generate the scenes. Not Higgsfield." Make the seven comic scenes from the piece's production plan with your `image_generation` tool: two candidates each, as photographs that make his own words literal (the plan's gags), never evidence.

The scenes (id, shape, picture):
- `s3-nameplate` (9:16): A small-town Ohio city hall front door in brick, on an overcast morning. The small brass nameplate that read MAYOR has been unscrewed and lies face up on the doorstep; two empty screw holes and a clean rectangle mark where it hung. Far behind, an enormous windowless grey data centre sits on the horizon, untouched, humming.
- `s13-ban-sign` (9:16): A green roadside town sign reading WELCOME TO PIQUA with a freshly bolted white plate beneath it reading NO DATA CENTRES. Right behind the sign a tower crane lifts a grey concrete wall panel onto a half-built windowless data centre. Flat Ohio farm fields, overcast.
- `l13-ban-sign` (16:9): The same scene wide: a green roadside sign reading WELCOME TO PIQUA with a new white plate beneath reading NO DATA CENTRES; behind it a tower crane swings a concrete wall panel onto a half-built windowless data centre across flat Ohio fields, overcast.
- `l18-back-garden` (16:9): An ordinary American suburban back garden on a sunny afternoon: a barbecue grill, a child's paddling pool, a wooden fence, and directly behind the fence a huge industrial gas power station with turbines and chimneys towering over the garden.
- `l20-cow` (16:9): A small white shipping-container data centre beside tall wind turbines in an empty green field under an overcast sky; its only neighbour is a single cow grazing right next to it, completely unbothered. Wide shot.
- `l22-boardroom` (16:9): A corporate boardroom with a long empty table; an iPhone stands propped upright in the chairman's leather chair at the head of the table, its screen showing a loading spinner. Quiet, slightly absurd, documentary lighting.
- `l27-fly-on-wall` (16:9): View from high on the wood-panelled wall of a packed small-town council chamber in Ohio: residents on their feet holding handmade signs about the data centre; in the foreground a house fly on the wall, in sharp focus.

Rules for every image: a documentary photograph, natural light, a muted slightly desaturated grade with deep ink-green shadows; no people's faces in close-up and nobody recognisable; no logos or brand marks; the only words in the frame are the sign or plate words written above, spelled exactly; nothing else written. 9:16 scenes at 1024x1536 or larger, 16:9 at 1536x1024 or larger.

Write each candidate to `docs/plans/2026-11-17-tuesday/ve/plates/<id>-<n>.png` (n = 1, 2) and one sidecar `docs/plans/2026-11-17-tuesday/ve/plates/plates.json`: {"<id>": {"prompt": the exact prompt you used, "model": the image model, "candidates": ["<id>-1.png", "<id>-2.png"], "shape": "9:16"|"16:9"}}. Look at every image you make (view_image) and regenerate any whose sign words are misspelled or that shows a recognisable person, before writing the sidecar. Never edit anything outside that folder.

## Contract
Stills only, made with the image_generation tool; no code, no edits outside the plates folder. Codex never renders, cuts or files a video.

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
python3 -c "import json,os,struct;d=json.load(open('docs/plans/2026-11-17-tuesday/ve/plates/plates.json'));ids=['s3-nameplate','s13-ban-sign','l13-ban-sign','l18-back-garden','l20-cow','l22-boardroom','l27-fly-on-wall'];assert all(i in d for i in ids);import sys;[sys.exit('missing '+c) for i in ids for c in d[i]['candidates'] if not os.path.isfile('docs/plans/2026-11-17-tuesday/ve/plates/'+c)];print('ok')"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-tue17-scenes", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
