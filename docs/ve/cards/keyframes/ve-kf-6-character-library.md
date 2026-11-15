---
card: ve-kf-6-character-library
kind: code
model: gpt-6.1-sol
effort: medium
max_minutes: 60
max_calls: 60
cwd: C:\Users\krish\dev\makeyourmindup\.worktrees\content-engine\ve-card\ve-kf-6-character-library
write_allow: [scripts/velib/character_library.py, tests/ve_character_library_test.py]
read: [config/ve/character.json, config/ve/character-poses.json, config/studio.json, scripts/velib/character.py, scripts/velib/common.py, tests/ve_character_test.py]
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# Krish's character: read, check and stage the drawn library

## Goal
The library is drawn: Krish approved base v2 on 9 Nov and all 65 poses were drawn closed, open and blink on 10 Nov, filed in his brand kit at `1 Brand kit (permanent)/character/krish/` (config/ve/character.json, status ready). This card draws nothing.

Write scripts/velib/character_library.py (PIL and numpy). It runs as a script and imports as velib.character_library, so no relative import at its top. Card ve-kf-7 imports library_dir(), index() and stage().
- `index --library DIR` / index(dir): for each pose in character.json library.poses, its three files `poses/<pose>-closed.png`, `-open.png`, `-blink.png`: sha256, size, the opaque box (alpha over 128), the mouth box (pixels that differ, closed against open) and the eye box (closed against blink), plus family, side and use_when from config/ve/character-poses.json. Measured from the images only; printed, never written into the library.
- `check --library DIR [--allow-empty] [--out FILE]`: fails a missing file, an image not 1024x1036 with alpha, an open or blink identical to its closed, an open whose changed pixels do not fit one 320x220 box or a blink whose do not fit one 420x200 box (a pixel is changed when a channel differs by more than 8), and opaque pixels on the left, right or top edge. `--allow-empty` passes when DIR does not exist. check.json goes only to --out.
- `poses`: every pose with its family, side, use_when line and whether it is built: what a session reads to pick the pose that matches a beat's point, by the rule in .agents/skills/motion-designer/references/character.md (never in the hook, 9:16 only). Code never picks a pose.
- stage(index, poses, assets): copies the named poses' three files to `<assets>/character/<pose>-<state>.png`, checked by sha256 after the copy; refuses a pose not in the index.
library_dir(): character.json home under runtime.library_root (config/studio.json, MINDMAKE_LIBRARY_ROOT), the default for --library. Every entry point refuses unless character.json approved is true.

## Tests (tests/ve_character_library_test.py, on images made in the test, none committed)
- index measures the opaque, mouth and eye boxes of a synthetic pose to the pixel
- check fails each fault above and passes a clean pose; --allow-empty passes with no folder
- stage copies exactly the named poses, sha256 matching, and refuses an unknown pose
- the library folder's listing is identical after index, check and stage
- every entry point refuses when approved is false

## Contract
Python 3 with PIL and numpy only (no new dependency). Draw nothing: no image tool, no image written but stage's copies into an assets folder. Never write config/ve/character.json, never touch the brand kit or Google Drive: tests build a library in a temp folder. Existing tests/ve_character_test.py must still pass.

## Acceptance (every command must exit 0 inside your sandbox)
python tests/ve_character_library_test.py
python tests/ve_character_test.py
python scripts/velib/character_library.py check --library .cache/character/krish --allow-empty

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-kf-6-character-library", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
