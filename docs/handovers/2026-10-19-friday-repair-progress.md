# Friday video repair: execution checkpoint

Status: in progress; neither replacement is ready. Krish's approved plan is the
authority, including the sample-approval and final-filing gates. Board migration
is deferred until the repairs and review are complete.

## Reproducible environment and source identity

- Checkout: `C:\Users\krish\dev\mindmake\content-engine`.
- Branch: `codex/friday-video-repairs`; base main `d8c098768e18f98f6b38c1d8369889b7a87d03f3`.
- Isolated Python 3.12 `.venv`, pinned requirements installed with hashes; npm lock installed.
- Renderer doctor passed; initial failure checker: 31 guarded, two open.
- Work root: `.cache/produce/2026-10-16-904658db` (W below).
- Long recording: `ee91ab41bc6ff0e25c2d7c2039c0bd55131ce7630110668c826e191605f0fd9f`.
- Short recording: `f5401564f492d7f8299335dec4a8499af15a4977e3d0a82419704d34895a4e7f`.
- Rejected deep output: `c4996a001c07698c484697b9b300d9567bc710b75b917f4da894cfe9839cc402`.
- Rejected short output: `bcc51515b63ef4b0987cfd048225b2ef994a1c19e48e1f39edd4f296644f1590`.
- 217 working assets fetched through the engine. `W/baseline/making-before.json`
  preserves the live making record before this repair. Recording/script matches
  verified. Article fact gate failed and remains distinct from video acceptance.

## Sync investigation

Pinned upstream: `joonson/syncnet_python` revision
`907c0b579c2e2d83f0eae1b2ac9e720cde4e5623`; local model SHA256
`961e8696f888fce4f3f3a6c3d5b3267cf5b343100b238e79b2659bff2c605442`.
Separate `.cache/syncenv` uses torch 2.5.1+cpu, NumPy 2.2.6, SciPy 1.15.3,
opencv-python 4.11.0.86 and python-speech-features 0.6.

`scripts/quick-edit/sync_check.py` sequentially decodes frame-index windows and
audio samples. It does not seek by timestamps or apply sync corrections. Reports
include source hash, confidence, face detection, model identity and calibration.
Its analysis bins are 40 ms, not sub-frame proof. Low confidence is inconclusive.

| Approximate time | Source offset, ms | Rejected offset, ms |
|---|---:|---:|
| 0:30 | 0 | 0 |
| 2:00 | 0 | 40 |
| 4:00 | 0 | 80 |
| 6:00 | 0 | 160 |
| 8:00 | 0 | 320 |
| 10:00 | 0 | 480 |
| 12:00 | 40 | 560 |
| 13:00 | 40 | 680 |

Each checkpoint recovered injected ±200 ms offsets. Reports and crops are in
`W/sync-source` and `W/sync-rejected`. Source frame-index versus PTS deviations do
not progressively reach hundreds of milliseconds; the old timestamp-hole claim
has not been reused.

`.cache/reproduce-edited.py` recreates the original stage-one edit at diagnostic
270×480 resolution with the historical transcript solely to reproduce the fault.
`W/diagnostic-edited/part-clock-report.json` counts video packets and PCM samples:
62 parts total 668.44 ms less audio than picture. The six-second segment beginning
at 11.9 s had 144 frames but 286,969 samples (expected 288,000).

The candidate encoder in `segment_clock.py` uses bounded video/audio filters,
allows both streams to drain, and validates every part plus the join. That same
six-second segment now has exactly 144 frames and 288,000 samples. It applies no
global offset. The complete repaired diagnostic has eight calibrated offsets
40, 0, 0, 40, 40, 0, 40, 40 ms, confidence 6.12–7.59. Evidence is in
`W/sync-fixed`; preserve the original diagnostic parts. This proves the repaired
diagnostic, not either finished replacement.

## Code changes drafted, not yet release-ready

- Transcript provenance binds source SHA, processing speed/clock and transcriber
  version. All renders reject legacy or stale words.
- Explicit page phrases anchor page changes to words; ambiguous matches refuse.
- Word-boundary checks reject retained-word clipping and removed words left in
  the retained audio. Segment frame rounding now rounds outward.
- `music_mode: episode_bed` has a continuous track with card-window lifts and
  two-second crossfades. Local three-second loudness measurement adjusts the
  music stem without globally renormalizing the approved voice/bed balance.
  Silence and out-of-range speech windows fail continuity. Full deep-cut music
  still requires final rendering and measurement.
- Post-render transcript comparison and hash-bound draft receipts added. Receipts
  deliberately keep unperformed sync, visual and full-playback checks incomplete.
- Finished-video send/making paths refuse absent, stale, failed or inconclusive receipts
  before writes. Final report integration, full-size font checks, manual review
  evidence and archive flow still need completion/review.
- Thirteen focused Python regressions passed, including an actual FFmpeg
  VFR/repeated-join fixture. make/music/send/making self-tests passed earlier.
  Full verification found five failures, with 1,770 tests passing and one skipped.
  Fixes now isolate credentials, bind synthetic transcript provenance, avoid
  platform font discovery and isolate repeat intro test directories. The mix
  fixture exposed a real overlay-tail overrun; the composed main picture now
  trims to its exact frame count before concat. Latest verification log is
  `.cache/verify-friday-final.log`; do not infer it passed from an earlier run.
  The zoom-analysis self-test also fails on base d8c0987 with the font-only
  contact-sheet workaround (`.cache/references-baseline.log`); it is unresolved.
- Do not mark either failure closed, commit a success claim or publish this branch
  until complete output verification. No push, PR, merge or deployment performed.

## Approval package and next actions

User-facing files are in `C:\Users\krish\Documents\Codex\2026-10-19\pic\outputs`:
mapping-step-1/2.png, deep-cut-treatment-preview.png, friday-repair-beat-sheet.md,
friday-music-audition.wav and its measurement JSON. The audition is a 32-second
sample with a demonstration chapter window at 15–18 seconds, not final timing.
Measured bed −30.99 LUFS, chapter −22.00, post-transition bed −30.17, speech −14.51,
mix −14.46 and true peak −1.17 dBTP. Actual playback has not been certified.

Krish approved: "Approve this treatment and music balance". This permits the
remaining treatment and production. He subsequently authorized Drive filing once
the repairs are complete: "After these videos are repaired, make sure they go in
the right place in my Google Drive, in place of the old videos, and then give me
the two links here." The exact instruction is appended to the approval JSON.
Keep approved titles,
thumbnails and story clips. Mercedes = Claude and C-Class = Opus 5.5 are two
separate comparisons. Approved track is no-curves-instrumental; do not reopen its
licence approval.

Fresh transcripts are complete in `W/words-fresh/long.words.json` and short.words.json.
The short must use the processed 1.1x source in `W/short-processing`; never divide
those word times by 1.1 again. Resolve removals and cue phrases afresh, then rebuild
both cut configs. Both now explicitly use the approved 0.18/0.25-second pads.
The completed 63-segment deep intermediate used the former 0.2/0.3 values and
must be rebuilt. Its exact sample/frame check passed, but it is not current.

## Current production checkpoint

- First short candidate: `W/repair-short/why-so-many-ais-short-repair-19oct-9x16.mp4`,
  SHA256 `2e17c7c53b533f30ae44f0eefa6974cb2985f168a51f605032954d3a3453e939`.
  Six calibrated checkpoints at 5, 18, 31, 44, 57 and 71 seconds pass at -40 to
  0 ms (`W/sync-short-final`). Speech span 3.5–81.2 seconds. Coverage 99.95%,
  longest gap 0.036 seconds, 24.71 changes/minute. These are candidate-specific.
- First-candidate measured mix -14.5 LUFS, true peak -1.8 dBTP, speech window
  -14.2 LUFS. Its receipt remains failed/inconclusive; do not hand-edit it to pass.
- Caption issues include the Sally opening, missing "like", and "Maybe 5%"
  versus intended "I'm 85%". Medium recognition on both source and final is in
  `.cache/native-transcription/short-check`; it does not resolve every ambiguity.
  A large-v3 attempt on the existing server was killed before completing and
  produced no usable final report. Do not repeatedly rerun that resource-heavy job.
- Updated short SVGs use the approved orange and larger readable labels; PNGs
  were regenerated, then the wide mapping heading was moved to avoid overlap.
  Run the builder and pinned renderer again before the next render. Preserve
  candidate one and use a new candidate filename. Revalidate the new hash.
- `scripts/quick-edit/friday_repair.py` produces 32 short steps and 77 deep cues.
  Real car photographs and licence/source records are in `W/repair-assets/photos`.
  Existing deep non-car cards still need font/claim/Claude-logo corrections.
- Renderer: `npm ci --prefix scripts/quick-edit/svg-render`, then
  `node scripts/quick-edit/svg-render/render.cjs <SVG folder>`. Font files and
  licences are committed inputs; each rendering emits exact source/output hashes.
- Actual Claude model/effort and ChatGPT thinking-control screenshots are absent.
  Archived assets show help text. The available browser route cannot attach to
  the local logged-in browser. Ask for a screenshot attachment in plain language,
  not a filesystem path. Never manufacture an authentic control screenshot.
- Frame samples exist in `W/review-short`; partial native-frame/contact-sheet
  inspection is not full playback with sound. No completed watch/listen is claimed.

Delivery remains blocked until both complete files have been watched/heard,
native captions inspected, frame sheets checked, six reliable sync checkpoints
per replacement are within 40 ms, loudness/music/visual requirements pass and the
reports bind exact bytes. Filing is now conditionally authorized by Krish's latest
instruction; finished review remains outstanding. File both as the current cuts
under the existing post's `3 Video` folder, preserve the rejected bytes as
superseded copies, hash-verify the actual library copies and update making records.
Return the two verified Google Drive video links in this chat. Do not re-ask the
routine filing permission already granted, and do not treat it as video acceptance.
Then prepare the reviewed branch/PR and resume the selected board migration.
