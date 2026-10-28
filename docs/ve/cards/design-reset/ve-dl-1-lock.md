---
card: ve-dl-1-lock
kind: pipeline_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-dl-1-lock
write_allow: [scripts/velib/designlock.py, scripts/velib/cards.py, scripts/velib/lint.py, scripts/ve.py, tests/ve_designlock_test.py]
read: scripts/ve.py, scripts/velib/cards.py, scripts/velib/lint.py, scripts/velib/common.py, config/ve/design-lock.json, config/ve/brand-tokens.json, config/ve/formats/*.json, docs/ve/design/TEMPLATE.md, docs/ve/ENGINE.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, editing config/ve/design-lock.json (only `freeze` code may rewrite it, and tests only write temp copies), any change to apps/renderer
---

# Design lock: a format cannot be built, linted or approved without a frozen lock

## Why (root cause F19)
The first Gate 2 proofs passed every mechanical check and were rejected on design: small widgets in fixed boxes, a spreadsheet look, wrong branding. Nothing in ve required an approved design before device cards or specs were built. `config/ve/design-lock.json` now records the approved direction (zones, type roles, thresholds, kit, scribble, plate rules, formats). This card makes the lock a hard dependency.

## Contract
1. `scripts/velib/designlock.py` (stdlib + PIL only; PIL is installed):
   - `load(path=None) -> dict` reads `config/ve/design-lock.json` (path relative to the repo root).
   - `validate(lock, root=None) -> list[str]` returns findings (empty = valid). Check: `schema == "design-lock/1"`; `status` in `{"direction_approved","frozen"}`; canvas 1080x1920 at 30 fps; zones lie inside the canvas; `zones.caption` has y == 1180 and its bottom (y+h) equals `geometry.caption_block_bottom_max_y` in `brand-tokens.json` (1500); thresholds hold numbers in sane ranges (`min_text_px` 24-48, `fill_min_pct` 50-100, `keyframe_ssim_min` 0.5-1); `scribble.stroke_px == 8` and `keyline_px == 16`; every `type_roles.*.family` is a key of `brand-tokens.json` `type_roles`; `gates` equals exactly `["design_lock","composition_qc","keyframe_match","mechanical_qc","critic_verdict","packet","krish_final_hash"]`; each format has non-empty `beats`, and its `anatomy` and `motion` files exist under `root` (default: the repo root; `root` exists so tests can point at a temp tree).
   - `golden_path(lock, fmt, beat, root=None) -> Path`.
   - `frozen(lock, fmt, root=None) -> tuple[bool, list[str]]`: true only if `keyframes` has exactly one entry per beat and every entry's file exists and its sha256 equals the entry's `sha256`. Reasons list is empty when frozen.
   - `freeze(fmt, src_dir, mapping, *, lock_path=None, force=False, today=None) -> dict`: for each `beat -> filename` in `mapping`, open `src_dir/filename` with PIL, refuse (ValueError naming the file) unless it is exactly 1080x1920, downscale to `thresholds.keyframe_compare_size` with LANCZOS, save as JPEG quality 85 at `<formats[fmt].frames_dir>/<beat>.jpg` (create the dir), and record `{"file": ..., "sha256": <of the golden jpg>, "source_sha256": <of the source file>, "size": [w,h]}` under `formats[fmt].keyframes[beat]`. Mapping must cover every beat of the format exactly. Refuse to replace existing keyframes unless `force`. Set `formats[fmt].frozen_on` to the ISO date and set top-level `status` to `"frozen"` only when every format in the lock is frozen. Write the lock back with `json.dumps(..., indent=2)` + newline, keeping key order and ASCII.
2. `scripts/ve.py`:
   - `ve lock check` prints each finding and exits 1 if any; prints `design lock: valid` and one line per format (`frozen` or `not frozen: <reasons>`) and exits 0 otherwise. A format that is not frozen does not fail `check`.
   - `ve lock show [FORMAT]` prints the lock (or one format) as JSON.
   - `ve lock freeze FORMAT --from DIR [--map beat=file ...] [--force]`; without `--map` use the format's beats in order against `f1.png`, `f2.png`, ... in DIR.
   - `ve doctor` gains a hard row `design lock` running `validate()`. Keep every existing row.
3. Refusals (additive; nothing existing may change when the lock does not apply):
   - `ve card` (and `cards.write_card` / `cards.dispatch`): if the card's front matter has `format: <id>` and `kind` is `device` or `format_config`, refuse unless `<id>` is in the lock and `frozen()` is true; the message must say `no frozen design lock for <id>: run ve lock freeze`. A card with no `format` field is untouched.
   - `ve lint SPEC`: read how lint gets the spec's format id. If that id is in `design-lock.json` formats and is not frozen, add a finding `format <id> has no frozen design lock`. If the id is not in the lock, do NOT add a finding; instead `cmd_lint` prints one line `note: format <id> is legacy: composition and design approval are enforced at packet time` (so existing clean specs still exit 0).

## Tests: `tests/ve_designlock_test.py` (unittest, temp dirs only)
- the real lock validates clean; mutations of a deep copy each give a finding that names the problem (caption zone moved down 10 px, `min_text_px` removed, a type role with an unknown family, a missing anatomy file, `gates` reordered, scribble stroke 9);
- `frozen()` is false with empty keyframes and names why; after `freeze` from a temp dir of synthetic 1080x1920 PNGs it is true, golden files are 540x960 JPEGs, hashes match, `source_sha256` matches; altering a golden file's byte makes `frozen()` false;
- `freeze` refuses a 1000x1900 image (names the file), a mapping missing a beat, and an existing freeze without `force`;
- `ve card` style refusal: a temp card with `format: hand-held-screen` and `kind: device` is refused with the exact phrase while the lock is unfrozen, and a card without `format` is accepted;
- `ve lint` on an existing fixture spec still exits 0 and prints the legacy note.

## Acceptance (every command exits 0)
python tests/ve_designlock_test.py
python scripts/ve.py lock check
python scripts/ve.py doctor
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

(If the lint fixture path differs, find the spec the existing tests use with `grep -rn "lint(" tests | head` and use that; report the path you used.)

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-dl-1-lock", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
