---
card: ve-fix-7-ocr-carry
kind: qc_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-fix-7-ocr-carry
write_allow: [scripts/velib/qc_captions.py, tests/ve_qc_modules_test.py, apps/renderer/src/engine/devices/test_grid/state.ts, apps/renderer/src/engine/devices/test_grid/index.tsx, apps/renderer/src/engine/devices/test_grid/device.test.ts]
read: scripts/velib/qc_captions.py, scripts/velib/qc.py, scripts/velib/qc_cues.py, tests/ve_qc_modules_test.py, fixtures/ve/my-test-19s/ocr/cases.json, apps/renderer/src/engine/devices/test_grid/*
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies (numpy is present; PIL is not), edits outside write_allow, lowering any threshold (0.98 agreement, the cue threshold)
---

# Two QC failures on the 19 s proofs: OCR of highlighted captions, and the carry cue on tall

## A. captions.ocr (tesseract 5.4 is on PATH)
Evidence from the real renders (`fixtures/ve/my-test-19s/ocr/`): `cases.json` lists six gzip P5 PGM crops (`*.pgm.gz`, the caption region of pages 1, 9, 10 in tall and wide) with the expected page text. Captions are cream text on dark ink; the keyword word sits on a **mint highlight box in dark text**. Current OCR reads those pages as "fforced{El-rite" (agreement 0.5-0.8). Pages 6 and 8 report "No fully revealed caption window" because the last word appears 4 frames before the page ends.

Fix in `scripts/velib/qc_captions.py` without lowering 0.98:
1. **Sampling window:** the sample frame is the middle of [revealed, last_frame - 1] where `revealed = max(first, last word atFrame + 2)` and the page's `toFrame` is exclusive. A page is `not_sampled` only if `revealed > last - 1`.
2. **Preprocessing:** build candidate images from the grey crop with numpy: raw, polarity-normalised (pixels brighter than a local ink threshold become black text on white, and the dark-on-mint word is inverted back to black on white: for example threshold at the midpoint between the darkest and brightest modes, then per connected highlight box invert), and each upscaled 2x by nearest neighbour. Run tesseract (`--psm 6`) on each candidate, keep the best `agreement`. Report which candidate won in the row (`variant`). Time limit: at most 4 tesseract calls per page.
3. Tests in `tests/ve_qc_modules_test.py`: for each case in cases.json (decode gzip + PGM with numpy, no PIL), `ocr` agreement >= 0.98 with the real tesseract. Skip the case only if `shutil.which('tesseract')` is None. Add a unit test for the window rule (pages 6 and 8 timings: from 311 to 356 with last word 352, and 436 to 479 with last word 475, are sampled).

## B. motion.cue_sync for b5-every-3 on tall
The cue is the `carry` event on test_grid: the evidence card "shrinks back into its cell: ANSWER DELETED in hollow mono". In the tall render the grid is small, so the change is tiny (peak 0.238 vs threshold 0.415) although it passes on wide. Do not touch the QC threshold. Make the carry visibly strong in `test_grid` (state.ts, index.tsx):
1. A carried cell's background flips from cream to `tokens.ink` over `MOTION.dropFrames` (cross-fade by `carryProgress`), keeping its border; the hollow `ANSWER DELETED` stroke becomes `tokens.cream` on the ink cell.
2. The dashed outline rectangle starts at scale 6 (not 2.4) and shrinks to 1 over the same frames, drawn **inside the whole grid's bounds clipped to the device box**, with `tokens.cream` dashes at 3px*layout.scale on the dark theme.
3. Update device.test.ts for the new fields (`carryProgress` unchanged; add `carryFill`: 0..1 equal to `carryProgress`).
Claude re-renders both proofs and runs `ve qc` outside the sandbox. Report in open_questions that this part needs that re-render.

## Acceptance (sandbox may not reach node_modules or ffmpeg: say so in open_questions)
python tests/ve_qc_modules_test.py
npx tsc --noEmit
npx vitest run apps/renderer/src/engine/devices/test_grid

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fix-7-ocr-carry", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
