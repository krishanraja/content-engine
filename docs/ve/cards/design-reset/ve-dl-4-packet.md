---
card: ve-dl-4-packet
kind: pipeline_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-dl-4-packet
write_allow: [scripts/velib/packet.py, scripts/velib/verdict.py, scripts/ve.py, config/ve/verdict.schema.json, config/ve/crew/critic.card.md, config/ve/crew/critic.lens.md, tests/ve_packet_test.py]
read: scripts/ve.py, scripts/velib/qc.py, scripts/velib/qc_composition.py, scripts/velib/qc_keyframes.py, scripts/velib/designlock.py, scripts/velib/common.py, config/ve/crew/critic.*, config/ve/design-lock.json, packages/contracts/src/production-spec.ts, docs/ve/RUNBOOK.md, docs/ve/ENGINE.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, any publish/send/schedule verb, a flag that skips a refusal
---

# ve packet: nothing goes to Krish for approval unless it has been measured and judged

## Why (root cause F19)
The Gate 2 packet went to Krish with mechanical QC only. The Critic never ran, no composition check existed, and `ve status` said nothing about design. Krish had to find "terrible use of the screen" himself. `ve status` already refuses READY without a Critic verdict and Krish's exact-file approval; what was missing is a gate on **assembling the packet**, a verdict that is bound to the file and shows what was looked at, and a status that separates "mechanically valid" from "design approved".

## Contract
1. `config/ve/verdict.schema.json` + `scripts/velib/verdict.py`:
   - verdict shape: `schema "ve-verdict/1"`, `piece`, `cut`, `sha256` (of the mp4), `reviewer` (string, never empty, must not equal the producer id `ve`), `reviewed_at`, `lens_sha256` (of `config/ve/crew/critic.lens.md`), `frames_viewed` (non-empty list of `{"at_s": number}`; at least one per beat), `findings` (list of `{"severity": "block"|"fix"|"note", "area": "composition"|"brand"|"motion"|"evidence"|"copy"|"other", "frame_s": number, "text": str}`), `blocking` (true if any finding is `block`).
   - `ve verdict write PIECE CUT --reviewer NAME --findings FILE.json [--viewed S1,S2,...]`: refuses unless `qc.<cut>.json` exists, its `sha256` matches the file on disk, and its `composition` row is present for a 9:16 cut; refuses an empty `frames_viewed`; computes `sha256`, `lens_sha256`, `blocking`; writes `verdict.<cut>.json` in the piece's ve dir (same place `ve status` reads it).
2. `scripts/ve.py status PIECE` prints, per cut, two blocks and then the existing READY / NOT READY line (keep the exit code rule: 0 only when ready):
   - `mechanical: VALID|INVALID (reasons)`: the existing qc and sfx reasons, plus `composition fails: <first finding>` and `keyframe_match fails: <first finding>` when those rows fail.
   - `design: APPROVED|NOT APPROVED (reasons)`: reasons include `format <id> has no frozen design lock` for a locked format; for a format not in the lock (legacy), `legacy format: needs Krish's proof approval of this exact file` unless `approvals` holds `gate: "proof"` with `artifact_hash` equal to the file sha; `no Critic verdict for this file` / `Critic verdict is for a different file` (hash mismatch) / `Critic blocks: <first block finding>` / `Critic did not view every beat`.
   - READY additionally requires `design: APPROVED`, so a cut with a clean mechanical block and no design approval is NOT READY and says why in one line.
3. `ve packet PIECE [--out DIR]` (new, `scripts/velib/packet.py`): for each cut, refuse (exit 1, print every reason, assemble nothing) unless the QC file matches the mp4 hash, `measured_pass` and `complete` are true, the composition row passes when it applies, the keyframe row passes when it applies, the format is locked and frozen (or the cut is explicitly marked `--legacy-ok`, which only prints a loud `LEGACY: no design lock` header and still requires composition, QC and Critic), and a non-blocking verdict exists for that exact hash that viewed every beat. When it passes it writes, under `DIR` (default: `<piece ve dir>/packet`): the mp4s, one 4x2 contact sheet per cut (ffmpeg, pinned toolchain, same way `qc.py` finds it), the qc and verdict JSON, and `PACKET.md`. `PACKET.md` is generated from data, plain sentences: what was measured with the numbers (fill %, smallest text, keyframe ssim per beat), every verdict finding with severity `fix` or `note` verbatim (never summarised away), anything not measured, and the line `Not yet approved: design and final, both Krish's, both by exact file hash.` There is no flag that skips a refusal.
4. `config/ve/crew/critic.card.md` and `critic.lens.md`: add Question 8 `Does every frame use the whole screen with one focal point and one scribble, nothing under 30 px, nothing in a grid of cells or a corner widget, and the caption zone clear?`; add a Calibration section: the Critic must fail `fixtures/ve/design-lock/rejected/*.jpg` and pass `fixtures/ve/design-lock/approved/*.jpg`, and until it has done so it blocks only on items it can cite by frame; require it to list `frames_viewed`. Do not delete any existing text.

## Tests: `tests/ve_packet_test.py` (unittest, temp piece dirs, synthetic small mp4s made with the pinned ffmpeg; skip video steps with a printed reason if ffmpeg is missing)
- `verdict write` refuses: no qc file, qc for a different hash, empty frames, missing composition row; writes a verdict with the right hashes and `blocking` true when a finding is `block`;
- `status` shows both blocks; a cut with passing qc but no verdict is `mechanical: VALID` and `design: NOT APPROVED (no Critic verdict for this file)` and NOT READY; a verdict for another hash is rejected; a blocking verdict blocks; a locked-and-frozen format (temp lock via the `designlock` API) plus a good verdict gives `design: APPROVED`; a legacy format needs the `proof` approval hash;
- `packet` refuses with every reason listed for: failing composition, missing verdict, hash mismatch, unlocked format; succeeds for a fully valid temp cut and the `PACKET.md` contains each `fix` and `note` finding verbatim and the exact `Not yet approved` line; `--legacy-ok` prints the LEGACY header and still refuses without a verdict;
- the existing ve python tests still pass.

## Acceptance (every command exits 0)
python tests/ve_packet_test.py
python tests/ve_qc_modules_test.py
python tests/ve_designlock_test.py
python scripts/ve.py status -h

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-dl-4-packet", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
