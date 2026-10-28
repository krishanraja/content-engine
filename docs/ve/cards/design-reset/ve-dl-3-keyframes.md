---
card: ve-dl-3-keyframes
kind: qc_module
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-dl-3-keyframes
write_allow: [scripts/velib/qc_keyframes.py, scripts/velib/qc.py, scripts/velib/lint.py, scripts/ve.py, tests/ve_keyframes_test.py]
read: scripts/velib/qc.py, scripts/velib/qc_composition.py, scripts/velib/designlock.py, scripts/velib/lint.py, scripts/ve.py, config/ve/design-lock.json, config/ve/formats/*.json, docs/ve/design/TEMPLATE.md, fixtures/ve/design-lock/**
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies (numpy and PIL only; there is no scipy or scikit-image), editing config/ve/design-lock.json, editing any fixture, any change to apps/renderer
---

# Golden key frames: the render must match the approved still

## Why (root cause F19)
An approved design is only real if the engine's render reproduces it. A locked format stores one approved key frame per beat (`design-lock.json` `formats.<id>.keyframes`, golden JPEGs at 540x960). QC must render-compare, so a layout, brand or composition drift fails before Krish sees it.

## Contract: `scripts/velib/qc_keyframes.py` (numpy and PIL)
- `ssim(a, b) -> float`: structural similarity of two equal-size grayscale arrays (0-255), standard constants (K1 0.01, K2 0.03, L 255), uniform 7x7 window done with cumulative sums or an integral image (no scipy), mean over the valid area. Identical images give 1.0 (within 1e-9); independent noise gives under 0.1.
- `compare(rendered, golden_path, lock) -> dict`: load both, convert to grayscale, resize the render to `thresholds.keyframe_compare_size` (LANCZOS), return `{"ssim": float, "min": thresholds.keyframe_ssim_min, "pass": bool}`.
- `keyframe_checks(video, props, lock, fmt) -> dict`: only when `fmt` is in `lock["formats"]` and `designlock.frozen()` is true; otherwise return `{"applies": False, "note": ...}` (note says `not frozen` or `legacy format`). For each beat in `props["beats"]`, require `beat["id"]` to equal the lock beat of the same index (list any mismatch as a finding and fail), extract the frame at `beat["keyFrame"]` if present else 80% through the beat with the pinned ffmpeg (same way `qc.py` and `qc_composition.py` do), and `compare` it with `designlock.golden_path`. Return `{"applies": True, "pass": all, "beats": {id: {...}}, "findings": [...]}`; each finding says the beat, the ssim and the minimum.
- `sheet(video, props, lock, fmt, out_path)`: write a JPEG contact sheet, one row per beat: golden | render | absolute difference (amplified x4), so a human sees what drifted.

## Wiring
- `qc.py::run_qc`: add a check row `keyframe_match` (aggregate of `keyframe_checks`); status `not applicable` when `applies` is False. It counts toward `measured_pass` and `complete` only when it applies. Keep every existing row and JSON key; per-beat detail goes under a new key `keyframes`.
- `ve keyframes FORMAT VIDEO PROPS [--sheet OUT.jpg]` prints one line per beat (`open ssim 0.91 min 0.80 pass`) and exits 1 on any failure; `--sheet` writes the contact sheet.
- `lint.py`: for a spec whose format is in the lock, every beat id must equal the lock's beat names in order (extra or missing or renamed beats are findings `beat ids must be <names> for format <id>`). Formats not in the lock are untouched.

## Tests: `tests/ve_keyframes_test.py` (unittest, temp dirs; use the card's own synthetic goldens, never the real lock file)
- `ssim`: identical = 1; the same image with mild noise above 0.9; two unrelated layouts below 0.5; a shifted-by-40-px copy below 0.8; shapes must match or ValueError;
- `compare` with a temp lock: pass above the minimum, fail below, resize works when the render is 1080x1920 and the golden 540x960;
- `keyframe_checks` with a 3-beat temp lock frozen via `designlock.freeze` from synthetic 1080x1920 PNGs, and a 3-beat synthetic video built with the pinned ffmpeg (skip with a printed reason if ffmpeg is missing) that shows those same images: passes; the same video with beats swapped fails and names the beats; a beat id mismatch fails; an unfrozen or legacy format returns `applies: False`;
- `sheet` writes a JPEG with three columns;
- lint rule: a temp spec for a locked format with a renamed beat gives the finding; the existing fixture spec still lints clean;
- every existing ve python test still passes.

## Acceptance (every command exits 0)
python tests/ve_keyframes_test.py
python tests/ve_qc_modules_test.py
python tests/ve_designlock_test.py
python scripts/ve.py lint fixtures/ve/my-test-19s/spec.json

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-dl-3-keyframes", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
