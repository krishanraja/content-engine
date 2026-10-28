---
card: ve-dl-2-composition
kind: qc_module
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-dl-2-composition
write_allow: [scripts/velib/qc_composition.py, scripts/velib/qc.py, scripts/ve.py, tests/ve_composition_test.py]
read: scripts/velib/qc.py, scripts/velib/qc_captions.py, scripts/velib/designlock.py, scripts/ve.py, config/ve/design-lock.json, config/ve/brand-tokens.json, config/studio.json, docs/ve/design/TEMPLATE.md, fixtures/ve/design-lock/**, assets/fonts/makeyourmindup/*.ttf
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies (numpy, PIL and the tesseract CLI the repo already uses are allowed), editing config/ve/design-lock.json, editing any fixture, any change to apps/renderer
---

# Composition QC: measure the screen, not just the mechanics

## Why (root cause F19)
The first proofs passed all 11 mechanical checks and Krish rejected them: "the use of the screen is terrible", "cramped into corners", "Microsoft Excel from 20 years ago". Nothing measured screen use, text size, corners or the caption and platform zones. This module measures them against `config/ve/design-lock.json` (`zones`, `thresholds`). It must PASS the approved frames and FAIL the rejected ones, and tests assert both.

## Fixtures (already in the repo; do not edit)
- `fixtures/ve/design-lock/approved/*.jpg`: approved 1080x1920 key frames (grayscale JPEG). Each is a designed still with a translucent `CAPTION` placeholder in the caption zone. Names are `H-f1.jpg` to `H-f5.jpg` and `P-f1.jpg` to `P-f5.jpg`. Treat every approved frame as `plate_on_screen=True`.
- `fixtures/ve/design-lock/rejected/tall-1.jpg` to `tall-4.jpg`: frames from the rejected proof. All four must fail, each for at least one named finding.

## Contract: `scripts/velib/qc_composition.py` (numpy, PIL, the tesseract CLI the repo already uses; read `qc_captions.py` and reuse its OCR invocation and spaceless-fuzzy matching helpers instead of writing new ones)
`measure(image, lock, *, plate_on_screen=False, exempt=(), caption_words=None, ocr_words=None) -> dict`
- `image`: path or PIL image, must be 1080x1920 (ValueError otherwise). `exempt`: list of `(x, y, w, h)` boxes (real footage) whose OCR words are ignored by the text checks. `caption_words`: set of lower-cased alphanumeric words allowed in the caption zone; None means the only allowed word is `caption`. `ocr_words`: optional pre-computed list of `{text, conf, x, y, w, h}` so tests can run without tesseract.
- Metrics and findings (each check has `pass` and `value`):
  1. `fill_pct`: share of the canvas outside `zones.caption` that carries content. Content mask: luminance contrast against the ground (`ink` luminance, Rec.601, from the tokens) of at least 14 levels, and/or local gradient energy, then dilated by 31 px (do it on a 4x downscaled mask for speed). You choose the exact mask so that every approved frame scores at least `fill_min_pct + 3` and every rejected frame scores at most `fill_min_pct - 15`. Grain must not make an empty ink region count as content: test with a synthetic empty ink frame plus 7% noise and assert it fails.
  2. `small_text`: OCR words (conf >= 60, at least 2 alphanumerics, not exempt) whose box height is below `floor(0.62 * thresholds.min_text_px)` px; list them. (Caps at 30 px render about 21 px tall, 24 px text about 17 px.)
  3. `caption_zone`: OCR words whose centre lies inside `zones.caption` and that are not in `caption_words`. The placeholder word `CAPTION` is allowed only when `caption_words` is None.
  4. `platform_zone`: OCR words (not exempt, not inside `zones.marquee`) whose box ends beyond `zones.platform.right_x` or `bottom_y`.
  5. `edges`: OCR words closer than `thresholds.edge_margin_px` to any canvas edge, or starting left of `thresholds.key_content_margin_px - 12`.
  6. `illustration`: when `plate_on_screen`, some OCR word (or the spaceless join of neighbours on one line) fuzzy-matches `ILLUSTRATION` with ratio >= 0.8; otherwise pass (value `n/a`).
  Return `{"pass": all, "checks": {...}, "findings": [str]}`; each finding is a plain sentence naming the value and the limit (for example `fill 37% of the screen outside the caption zone, the lock needs 80%`).

`composition_checks(video, props, lock) -> dict`: for a 9:16 cut, for each beat in `props['beats']`, extract the frame at the beat's `keyFrame` if present, else 80% through the beat (use the pinned ffmpeg the same way qc.py does), build `caption_words` from `props['captions']` pages covering that frame, set `plate_on_screen` from `props['illustrationLabels']` covering the frame, call `measure`, and return `{"applies": True, "pass": ..., "beats": {beat_id: result}}`. For a 16:9 cut return `{"applies": False, "note": "the design lock is 9:16 only"}`.

## Wiring
- `qc.py::run_qc`: when the cut is 9:16, add a check row `composition` (the aggregate) to the QC result; it counts toward `measured_pass` and `complete`. Keep every existing row and the JSON keys the existing tests read; add the per-beat detail under a new key `composition`. A 16:9 cut gets a row with status `not applicable` that does not fail.
- `ve comp IMAGE... [--plate] [--json]`: runs `measure` on stills and prints the verdict line and findings per image; exit 1 if any image fails.

## Tests: `tests/ve_composition_test.py` (unittest)
- all approved fixtures pass with `plate_on_screen=True`; all four rejected fail and each has at least one finding; print the measured `fill_pct` of every fixture in the test output;
- synthetic cases (use PIL and the vendored fonts under `assets/fonts/makeyourmindup`, canvas ink-coloured with a photo-like gradient where needed): empty ink plus 7% noise fails fill; a widget in one corner fails fill; 20 px text fails `small_text`; 30 px Plex Mono caps pass; a word at x 1000 fails `platform_zone`; a word at x 10 fails `edges`; a non-caption word inside the caption zone fails `caption_zone` while a word listed in `caption_words` passes; `plate_on_screen` without ILLUSTRATION fails and with a 28 px ILLUSTRATION tag passes; an exempt box silences small text inside it only;
- `composition_checks` on a 2 s synthetic video made with the pinned ffmpeg (skip with a printed reason if ffmpeg is missing) returns a per-beat result for a two-beat props stub; a 16:9 stub returns `applies: False`;
- every existing ve python test still passes.

## Acceptance (every command exits 0)
python tests/ve_composition_test.py
python tests/ve_qc_modules_test.py
python scripts/ve.py comp fixtures/ve/design-lock/approved/H-f1.jpg --plate
python scripts/ve.py doctor

(`ve comp` on the rejected tall-1.jpg must exit 1; run it and report the exit code in `commands`.)

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-dl-2-composition", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Put the fixture scores table in open_questions as one string. Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
