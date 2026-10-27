---
card: ve-card-6-qc-modules
kind: qc_module
model: gpt-6.1-sol
effort: medium
max_minutes: 55
max_calls: 50
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-card-6-qc-modules
write_allow: [scripts/velib/qc_sync.py, scripts/velib/qc_joins.py, scripts/velib/qc_captions.py, scripts/velib/qc_brand.py, scripts/velib/qc_cues.py, scripts/velib/qc.py, tests/ve_qc_modules_test.py]
read: scripts/velib/qc.py, scripts/velib/common.py, tests/ve_qc_test.py, config/ve/formats/scoreboard-test.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# The five QC checks that still report not_run

## Goal
Replace qc.py's five not_run checks with real measurements. Use numpy and ffmpeg only (no new dependencies), and test each one on synthetic lavfi media.

## Contract
- **qc_sync.av_xcorr(render, dialogue_master, edl).** For each EDL segment, cross-correlate the render's audio envelope (10 ms RMS) with the master's over that span. Pass if every lag is at most 1 frame (33 ms). Report every segment's lag.
- **qc_joins.decoder(render, joins).** In a ±60 ms window around each join, measure the RMS step (dB), a click (sample-difference spike over 6x local median) and spectral flux. Fail any join over its thresholds, and return a list of join times so `ve` can cut a joins reel.
- **qc_captions.ocr(render, pages, region).** If `tesseract` is on PATH, OCR the caption box once per page and compute token agreement against the page words; pass at 0.98 or above. If tesseract is missing, return status `not_run` with that reason; never pass silently.
- **qc_brand.mark_tile(render, mark_png, beats, aspect).** Template-match (normalised cross-correlation in numpy on greyscale) at each beat's midpoint frame, in the aspect's mark box. Pass if every beat scores at least 0.8.
- **qc_cues.cue_sync(render, events, slots).** For each event, find the frame-difference peak inside the event's slot box, within ±6 frames of `atFrame`. Pass if every peak is within ±2 frames.
- **Wiring.** `run_qc` calls these when its optional inputs are given, otherwise leaves `not_run`.
- **Tests.** `tests/ve_qc_modules_test.py` must catch, on synthetic media:
  - a 0.5 s A/V offset;
  - a 2 ms hard join with a click;
  - a mark-tile absence on one beat;
  - a cue 5 frames late.

## Acceptance (every command must exit 0 inside your sandbox)
python tests/ve_qc_modules_test.py
python tests/ve_qc_test.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-card-6-qc-modules", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
