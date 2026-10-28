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
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies (numpy, PIL and the repo's tesseract CLI are allowed), editing config/ve/design-lock.json or any fixture, any change to apps/renderer
---

# Composition QC: measure the screen, not just the mechanics

## Why (F19)
The first proofs passed all 11 mechanical checks and Krish rejected them ("terrible use of the screen", "cramped into corners", "Excel"). Nothing measured screen use, text size, corners or the caption and platform zones. This module measures them against `config/ve/design-lock.json` (`zones`, `thresholds`). It must PASS the approved frames and FAIL the rejected ones.

## Fixtures (in the repo; do not edit)
`fixtures/ve/design-lock/approved/H-f1.jpg`..`H-f5.jpg`, `P-f1.jpg`..`P-f5.jpg`: approved 1080x1920 key frames (grayscale JPEG, a translucent `CAPTION` placeholder in the caption zone); treat all as `plate_on_screen=True`. `fixtures/ve/design-lock/rejected/tall-1.jpg`..`tall-4.jpg`: the rejected proof; all four must fail, each with at least one named finding.

## Contract: `scripts/velib/qc_composition.py`
Reuse the OCR call and spaceless fuzzy matching in `qc_captions.py`; write no new OCR code.
`measure(image, lock, *, plate_on_screen=False, exempt=(), caption_words=None, ocr_words=None) -> dict`
- `image`: path or PIL image, 1080x1920 (else ValueError). `exempt`: `(x,y,w,h)` boxes (real footage) skipped by the text checks. `caption_words`: allowed lower-case words in the caption zone (None: only `caption`). `ocr_words`: optional precomputed `{text,conf,x,y,w,h}` list so tests can skip tesseract.
- Checks, each `{pass, value}`:
  1. `fill_pct`: share of the canvas outside `zones.caption` that carries content: luminance contrast of at least 14 levels against the ground (`ink`, Rec.601, from the tokens) and/or local gradient energy, dilated 31 px (work on a 4x downscaled mask). Choose the mask so every approved frame scores at least `fill_min_pct + 3` and every rejected frame at most `fill_min_pct - 15`. 7% grain on an empty ink frame must NOT count as content.
  2. `small_text`: OCR words (conf >= 60, 2+ alphanumerics, not exempt) shorter than `floor(0.62 * min_text_px)` px (30 px caps render about 21 px tall).
  3. `caption_zone`: OCR words centred inside `zones.caption` and not in `caption_words`.
  4. `platform_zone`: non-exempt words, outside `zones.marquee`, ending beyond `platform.right_x` or `bottom_y`.
  5. `edges`: words closer than `edge_margin_px` to an edge or starting left of `key_content_margin_px - 12`.
  6. `illustration`: when `plate_on_screen`, a word (or the spaceless join of line neighbours) matches `ILLUSTRATION` at ratio >= 0.8.
  Return `{pass, checks, findings}`; each finding is a plain sentence with value and limit (`fill 37% outside the caption zone, the lock needs 80%`).

`composition_checks(video, props, lock) -> dict`: for a 9:16 cut, per beat take the frame at `beat.keyFrame` if present, else 80% through the beat (pinned ffmpeg, as `qc.py` does); `caption_words` from `props['captions']` pages covering it; `plate_on_screen` from `props['illustrationLabels']`; return `{applies: True, pass, beats: {id: result}}`. A 16:9 cut returns `{applies: False, note: "the design lock is 9:16 only"}`.

## Wiring
- `qc.py::run_qc`: for 9:16 add a row `composition` (aggregate) that counts toward `measured_pass` and `complete`; per-beat detail under a new key `composition`. A 16:9 cut gets a `not applicable` row that never fails. Keep every existing row and JSON key.
- `ve comp IMAGE... [--plate] [--json]`: runs `measure` on stills, prints verdict and findings, exit 1 if any fails.

## Tests: `tests/ve_composition_test.py` (unittest)
- every approved fixture passes, every rejected one fails with a finding; print each fixture's `fill_pct`;
- synthetic cases (PIL plus the vendored fonts): empty ink plus 7% noise fails fill; one corner widget fails fill; 20 px text fails `small_text`, 30 px Plex Mono caps pass; a word at x 1000 fails `platform_zone`; at x 10 fails `edges`; a non-caption word in the caption zone fails, a listed word passes; `plate_on_screen` without ILLUSTRATION fails, with a 28 px tag passes; an exempt box silences only its own text;
- `composition_checks` on a 2 s synthetic two-beat video (pinned ffmpeg; skip with a printed reason if missing), and a 16:9 stub returns `applies: False`;
- existing ve python tests still pass.

## Acceptance (every command exits 0)
python tests/ve_composition_test.py
python tests/ve_qc_modules_test.py
python scripts/ve.py comp fixtures/ve/design-lock/approved/H-f1.jpg --plate
python scripts/ve.py doctor
(`ve comp` on rejected/tall-1.jpg must exit 1: run it and report the code.)

## Return
Final message only JSON per config/ve/task-result.schema.json: {"card": "ve-dl-2-composition", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}. Put the fixture scores table in open_questions as one string. Stop after two failed attempts at the same acceptance command and report it in open_questions.
