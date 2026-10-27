---
card: ve-fix-3-qc
kind: qc_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 50
max_calls: 50
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-fix-3-qc
write_allow: [scripts/velib/qc.py, scripts/velib/qc_sync.py, scripts/velib/qc_joins.py, scripts/velib/qc_captions.py, scripts/velib/qc_brand.py, scripts/velib/qc_cues.py, tests/ve_qc_test.py, tests/ve_qc_modules_test.py, scripts/ve.py]
read: scripts/velib/qc.py, scripts/velib/qc_cues.py, scripts/velib/qc_captions.py, apps/renderer/src/engine/geometry.ts, apps/renderer/src/engine/props.ts
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, any change in scripts/ve.py outside cmd_qc and the qc subparser line (another card owns the rest)
---

# QC module fixes from the independent review

## Goal
`ve qc` must measure the right thing and be able to reach READY with one command. A check that has nothing to measure must never pass.

## Contract
1. **qc_captions.**
   - OCR only frames where a page is fully revealed: from the page's last word `atFrame + 3` up to the page's `toFrame - 2`.
   - Sample the middle of that window.
   - A page with no such window is reported as `not_sampled`. It is never a pass, and it counts toward incomplete.
2. **qc_brand.**
   - Mark geometry mirrors geometry.ts. Wide: left 64, top 56, size 112, image 80. Tall: the tall mark box from geometry.ts `boxFor('mark', '9:16')`.
   - Put both in one Python dict with a comment citing the file.
   - Template-match inside those boxes.
3. **qc_joins.**
   - Measure the click ratio locally: compare the join window (±10 ms) with a reference of 300 ms on each side, excluding ±40 ms around the join.
   - Never compare against the whole file.
4. **qc_cues.**
   - An event passes only if the region change at its frame (±2 f) exceeds `max(FLOOR, 3 × the region's median change over the 15 frames before)`. FLOOR is the current absolute threshold.
   - `exit` events are checked the same way.
   - An empty event list fails with the reason `no cues to check`.
5. **`ve qc` reaches READY with one command.**
   - Add `--props <props.json>` to the qc subparser and `cmd_qc`.
   - From the props, derive `pages` (captions), `beats`, `aspect`, `events`, `slots` (via the layout tables mirrored from apps/renderer/src/engine/layouts/index.ts, cited in a comment), `mark_png` (`brand.mark.src`) and `dialogue_master` (`audio.stem.src`), and pass them to `run_qc`.
   - Without `--props`, behave as today and report incomplete.

## Tests (unittest; synthetic numpy and ffmpeg lavfi fixtures, no repo media)
- Captions: the sample frame falls inside the fully revealed window, and a page with no window gives `not_sampled`.
- Brand: the wide box is 64, 56, 112.
- Joins:
  - a loud but click-free file passes;
  - an injected 2 ms click fails;
  - the same click in a file that is loud elsewhere still fails.
- Cues:
  - a real change passes;
  - drift-only motion fails;
  - an empty list fails;
  - an exit event is checked.
- `--props` derivation: given a minimal props dict, `run_qc` receives every derived input. Mock the measurement functions.

## Acceptance (every command must exit 0 inside your sandbox)
python -m unittest tests/ve_qc_test.py tests/ve_qc_modules_test.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fix-3-qc", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
