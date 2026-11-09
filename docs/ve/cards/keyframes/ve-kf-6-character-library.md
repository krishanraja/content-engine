---
card: ve-kf-6-character-library
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 120
max_calls: 120
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-kf-6-character-library
write_allow: [scripts/velib/character_library.py, tests/ve_character_library_test.py]
read: _corpus/keyframes-character.md, config/ve/character.json, config/ve/character-poses.json, scripts/velib/character.py, tests/ve_character_test.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Krish's character: draw the base, then the pose library from the approved base

## Goal
Draw Krish as the house cartoon (_corpus/keyframes-character.md 2 to 5) with GPT Image 2, your built-in image tool on the ChatGPT sign-in, and nothing else: no key, no other provider. If the image tool is unavailable, say so in open_questions and draw nothing. Work only in .cache/character/krish/ (git-ignored; Claude stages input/photo.jpg, input/notes.txt and house/style.png there and files the results to his library afterwards).

Write scripts/velib/character_library.py, subcommands:
- prompt --job base|pose|open|blink --pose <id>: the prompt from config/ve/character-poses.json templates and identity.md (## Keep, ## Hidden, Glasses, Key, Mirror); one key colour chosen in code, never an if-then.
- key, align, patch: key on the flat colour with the edge un-mixed; scale and crop to the 1024x1036 canvas with the head on the neutral pose's head box (a low match keeps its own box); patch only the changed mouth pixels (squashed to 60% height) or eye pixels into the closed pose.
- check: library.json (per pose: files, use_when, head box, mouth centre, fingertip or grip, faces), contact-sheet.png, check.json.

The run follows config/ve/character.json status:
- drawing_base: write identity.md, draw the base (photo + style image), key it to base.png, stop. Never draw a pose: Krish approves the base first.
- drawing_library (approved is true): every pose in the file's order, each closed, open and blink, from base.png only (the photo is never sent again). Skip files that exist. A failed pose is re-described and redrawn, never painted over. Then check.
Any other status: build and test the code only.

## Tests
tests/ve_character_library_test.py on synthetic images made inside the test (none committed):
- the base prompt names one key colour and the style image's sunglasses, red t-shirt, hair and mustache as not his; no prompt has an if-then
- key leaves no key-coloured fringe; align puts the head on the neutral head box
- patch changes only mouth (or eye) pixels; the open mouth is 60% of the drawn height
- check fails a pose missing open or blink, an unchanged blink, a hand outside the canvas, anything above the hair
- poses are refused unless config/ve/character.json approved is true

## Contract
Read _corpus/keyframes-character.md whole first. The built-in image tool is the one exception to network in never: nothing else leaves the sandbox. Python with PIL and numpy only (no new dependency). Never write config/ve/character.json approved or approval: only Krish approves. Never commit an image: everything you draw stays in .cache/character/krish/. Never use a photo other than input/photo.jpg, never draw a stranger in his place. The library only grows: never overwrite an existing pose file. Report the count of images drawn in open_questions, and any pose that failed twice.

## Acceptance (every command must exit 0 inside your sandbox)
python tests/ve_character_library_test.py
python tests/ve_character_test.py
python scripts/velib/character_library.py check --library .cache/character/krish --allow-empty

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-kf-6-character-library", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
