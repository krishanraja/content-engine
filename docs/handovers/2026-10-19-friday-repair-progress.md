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
  The zoom-analysis baseline failure is repaired using the bounded Pillow estimator
  consistently on all machines; known push/pull, static and flat-colour fixtures
  pass (16 self-tests). A loaded verify run hit eight 5-second timeouts, with
  1,767 tests passing. Unloaded rerun: `.cache/verify-friday-unloaded.log`; read its
  result before claiming success.
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
The deep intermediate has been rebuilt with 0.18/0.25 pads and passes exact
sample/frame checks (`W/repair-long/prepare-approved-padding.log`). The previous
intermediate is preserved as `why-so-many-ais-deep-repair-19oct.old-padding.edited.mkv`.

## Current production checkpoint

- First short candidate: `W/repair-short/why-so-many-ais-short-repair-19oct-9x16.mp4`,
  SHA256 `2e17c7c53b533f30ae44f0eefa6974cb2985f168a51f605032954d3a3453e939`.
  Six calibrated checkpoints at 5, 18, 31, 44, 57 and 71 seconds pass at -40 to
  0 ms (`W/sync-short-final`). Speech span 3.5–81.2 seconds. Coverage 99.95%,
  longest gap 0.036 seconds, 24.71 changes/minute. These are candidate-specific.
- First-candidate measured mix -14.5 LUFS, true peak -1.8 dBTP, speech window
  -14.2 LUFS. Its receipt remains failed/inconclusive; do not hand-edit it to pass.
- Krish confirmed "I'm 85% sure of this" after listening to the nine-second source
  clip. `repair-evidence-19oct/caption-adjudications.json` records this scoped ruling.
  Bounded large-v3 recognition resolves missing "like" and "So picture a business
  owner"; those caption replacements are in the builder. Medium recognition on both source and final is in
  `.cache/native-transcription/short-check`; it does not resolve every ambiguity.
  A large-v3 attempt on the existing server was killed before completing and
  produced no usable final report. Do not repeatedly rerun that resource-heavy job.
- Updated short SVGs use the approved orange and larger readable labels; PNGs
  were regenerated, then the wide mapping heading was moved to avoid overlap.
  Run the builder and pinned renderer again before the next render. Preserve
  candidate one and use a new candidate filename. Revalidate the new hash.
- `scripts/quick-edit/friday_repair.py` produces 32 short steps and 77 deep cues.
  Real car photographs and licence/source records are in `W/repair-assets/photos`.
  Forty-eight deep cards now use readable type, concise headlines, correct Claude
  logos and source-reference captures; three use actual Claude controls. The index
  comparison is 42 to 58, up 16 points. Inspect the regenerated PNGs before rendering.
- Renderer: `npm ci --prefix scripts/quick-edit/svg-render`, then
  `node scripts/quick-edit/svg-render/render.cjs <SVG folder>`. Font files and
  licences are committed inputs; each rendering emits exact source/output hashes.
- Krish supplied actual Claude model/effort captures. Byte-preserved originals are
  `W/repair-assets/controls/claude-models-original.png` and `claude-effort-original.png`.
  Provenance: `repair-evidence-19oct/control-sources.json`. Viewports magnify original
  control text; no UI labels are generated. ChatGPT controls remain unavailable;
  archived OpenAI help captures remain source references, not controls.
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

## Latest continuation, 19 October afternoon

- The pinned Python 3.12 test run passed all 141 files: 1,775 tests, one skipped.
  `npm run verify` then found invalid YAML in produce-video's unquoted description.
  Quoting it and syncing the Claude copy passes skill validation. All remaining
  verify checks passed individually (`.cache/verify-friday-remaining.log`); the
  control-plane guards explicitly skip Linux-only paths on Windows. Initial
  unloaded attempt used system Python 3.14 and was interrupted; do not cite it.
- Native inspection caught and fixed nested screenshot clipping, a cost card
  mistakenly showing index scores, and small wide forecast qualifiers. Renderer
  now reuses only exact source/output/font hashes; a corrupt-output rebuild check
  passed. These are asset checks, not complete finished playback.
- Candidate v2 rendered: short SHA
  `ab54fb9d81d6b45a4358a47e1024d9dcb2a5b652964b3e53740336614ce34abe`.
  Voice -13.9 LUFS, mix -14.5, true peak -1.8; all 743 eligible music windows pass.
  It is superseded: source rechecks suggest the original word timestamps clipped
  the start of Her and I'm 85%. Retain the spoken The in the how it thinks too.
- Builder now creates short.adjudicated.words.json with immutable original-doc
  identity and individual timing adjustments from bounded large-v3 recognition.
  Her starts at source 29.98 s and the confidence phrase at 70.32 s. Config pins
  the complete revised transcript hash. Source speed remains 1.1x, not applied twice.
- Candidate v3 is rendering (`W/repair-short/render-v3.log`). Its final checks must
  use its own hash. The v2 sync job was stopped because those bytes are superseded.
- Fresh review restores deep-cut sounds and most of us: former removals dropped
  a verb and subject. The deep render uses the restored phrases and approved pads
  (`W/repair-long/render-restored-words.log`). Part reuse now keys by complete recipe
  rather than sequence number, with byte and frame/sample validation unchanged.
- After that cache change, 13 quality regressions and 78 make self-tests passed.
  Re-run the relevant checks after any further code edits.
- Revised numerical evidence and preserved article findings are in
  repair-evidence-19oct/revised-card-evidence.json. These do not clear publication.


## 19 October, no-label correction

Krish reviewed short v4 and rejected its eyebrows and source-credit overlays:
"these eyebrows and source citations are prohibited, they are awful". This applies
to both cuts. Removed the added series eyebrow, Car analogy/an analogy, source,
photo/licence and control-origin footers. Source records remain in accompanying
documentation. All 109 generated SVGs have no remaining added metadata text nodes;
representative PNGs were inspected. The produce-video rule and its Claude copy now
carry his ruling. The observation service recorded the correction as inbox 70.

Short v4 SHA 7c2d20562ba99298aac6e41bac573deb5e9bf34c47f83e7f0bee67aad1775925
is rejected. Voice -13.9 LUFS, mix -14.5 LUFS, TP -1.8 dBTP, coverage 99.96166%,
max gap .030 s, 24.53674 changes/min. Its 88 one-second and 38 quarter-second
intro/outro samples were inspected, with native control and caption frames. Audio
is decoded-sample identical to v3, which has independent medium.en recognition.
Raw ASR differences and source adjudications are preserved; full heard gate has
not passed. Native representative glyph heights were 70–86 px at 1080 output.
Only two of its six sync windows completed before supersession; never call that
a final sync pass. Human review record explicitly fails v4.

Current renders reuse unchanged exact-clock intermediates under new filenames:
- W/repair-short/why-so-many-ais-short-repair-19oct-v6-9x16.mp4;
  log repair-short/render-v6.log.
- W/repair-long/why-so-many-ais-deep-repair-19oct-v2-16x9.mp4;
  log repair-long/render-v2-no-labels.log.

The earlier deep encoder was stopped at the user's correction; its partial output
is preserved but not playable/deliverable. No replacement was filed. Independent
medium.en checking of the deep retained voice is running in the existing private
transcription runtime under deep-voice-check. It is before the final mix and must
not be described as finished-video listening. Source voice and transport audio
hashes are in .cache/native-transcription/deep-voice-check/job.json.

frame_review.py extracts all requested samples by sequential frame index and binds
them to the exact video hash. It cannot certify playback. independent_transcript.py
now leaves max_new_tokens unset for full medium runs (448 plus prompt overflows the
model limit); bounded source clips still use an explicit small limit.


## Deep caption investigation; short v6 review

Short v6 is complete, SHA 373194ee309a9e531fc83bf89408d97e0dbcf536cae4c90e278a9b34debc2fef.
It removes all added eyebrows/source credits, including the standalone Artificial
Analysis detail. All 88 one-second samples and 38 intro/outro samples inspected.
Its decoded audio is identical to v3/v4. Presented locally in this chat as
outputs/why-so-many-ais-short-review-v6.mp4; awaiting Krish's finished acceptance.
Six-point calibrated sync is running in W/sync-short-v6. Do not count partial
checkpoint results as a pass.

The deep medium.en retained-voice recognition has completed. Comparing with its
captions raises possible omissions of spoken repetitions and ad-libs, plus many
recognizer-only differences. Deep v2's render was stopped before completion to
resolve these first. Original audio is preserved. Thirty-three bounded passages
(total 564 seconds) are undergoing independent large-v3 recognition with beam 1
and max_new_tokens 160 on the same private runtime. Outputs: remote deep-bounded;
local .cache/native-transcription/deep-bounded. Use agreement and exact timing,
not blind replacement: overlapping large-model clips already disagree near edges.

quality.repaired_caption_words and make.py now support an exact-hash caption
repair document on the edited clock. It binds source provenance, edited bytes,
base-token digest, original words, each new timed word and evidence. It changes no
media and never reapplies speed. Fifteen quality tests and 78 renderer self-tests
pass. No deep caption repair document has yet been applied. The original source
words and 794-second sample-exact intermediate remain unchanged.


## Current checkpoint — 19 Oct, 16:45 London

Short v6 calibrated sync is complete: six reliable checkpoints, offsets
[-40,0,0,0,-40,-40] ms at 40 ms resolution, calibrated with injected offsets.
Native decoded representative essential text measures 70–87 px. Reports are
sync-short-v6.json and short-v6-native-text.json. Finished human acceptance remains
pending in this chat. No new filing or publication authority is needed beyond the
conditional instruction already recorded; acceptance and technical gates remain.

Deep v3 is rendering in repair-long (render-v3.log), session 99227. It uses the
same exact edited MKV (d816e518dfef96b1097d79c98c3328ab9dbb774a6a50c2d6a1b38d7a3d100928).
Four explicit caption corrections are in deep-caption-repairs.json: ChatGPT
spelling, See OpenAI, answer (previously arm/So), and an I/what false start. They
have exact baseline provenance and do not alter source media or recut audio.
A full medium transcript plus all 33 bounded large-v3 transcripts are stored in
repair-evidence-19oct/deep-independent-transcript, with manifest hashes. Several
medium-model repetitions are contradicted by the bounded checks; do not blindly
restore them. Remaining recognition disagreements require finished review.

Verification: the full npm run verify reached skills validation after both
TypeScript checks and 141 test files (1775 pass, 1 skip). Skills failed on Claude's
model key and a 1026-character description. The description is shortened and the
validator now validates the explicit Claude model extension separately, preserving
it in source and passing all other keys to strict Codex validation. Tests prove
unknown keys and invalid/duplicate models still fail. Skill validation and every
subsequent verify command passed when resumed; engine-gates then passed 13 tests,
including the added validator regression. Windows still skips Linux runtime paths.
No claim that full final video playback has happened. Nothing filed or recorded.


Deep v3 encoding is active (renderer session 99227, Python 48328; encoder 34576
observed at 16:47). Its bed continuity passed all 7331 eligible speech windows,
normal_fraction 1.0, with no speech silence. A local continuation script
W/finish-deep-review.ps1 is running in session 54961: after the renderer exits and
an exact-video receipt exists it runs six calibrated deep sync windows (30,180,
330,480,630,780; speech span 3.5–797.5), then frame_review with intro 3.5/outro 19.
Logs: repair-long/sync-v3.log and frames-v3.log. Final job state goes to
repair-long/review-jobs-v3.json. It cannot approve playback or file anything.
Read running state before starting duplicate jobs. Review both uncovered hidden
joins at edited 172.62 and 326.62 seconds in full playback.

Evidence JSON is marked -text in .gitattributes so Git cannot silently rewrite
bytes on another platform. All 39 indexed deep evidence hashes match the saved
manifest. Caption repair bytes are also preserved across checkouts.


## Composition ruling and current jobs — 19 Oct, 17:15 London

Krish rejected Meet Sally's empty image slot, requested an amusing character and
said not to leave random big spaces. Then asked whether other areas were similarly
sparse. All 109 card inputs were audited. The exact findings, 65 changed-card hashes
and full renderer manifest are in composition-audit-v8-v4.json (use its count as
truth if it differs). The generated fictional Sally and exact image_gen prompt are
in illustrations/sally-v1.png and sally-v1-provenance.json. The composed preview is
illustrations/sally-card-v8.png. This is a routine repair inside the approved look.

The earlier short v7 and deep v3 render trees were stopped deliberately. Their
partial files are preserved and not deliverable. Old waiting checker jobs cannot
pass them because completed receipts do not exist. Current renders:
- short v8: session 99204, repair-short/render-v8.log;
- deep v4: session 7726, repair-long/render-v4.log.
Both read repair-kit-v8, immutable after its 109-card render and inspection.
A new sequential checker is running in session 61229 via
W/finish-composition-review.ps1. It waits for each exact render's receipt, runs
six calibrated sync checkpoints, extracts every-second and quarter-intro/outro
frames, and hash-verifies a local preview copy in this chat's outputs directory.
Outputs: W/sync-short-v8, W/review-short-v8, W/sync-deep-v4, W/review-deep-v4;
review-jobs-v8.json / review-jobs-v4.json inside each render folder. The checker
never certifies full playback, changes making records or files to Drive. It leaves
visual/human acceptance pending. Inspect running state before restarting anything.

No audio/cut/transcript changes in this composition revision. The four deep caption
repairs from the prior checkpoint remain. Fresh reports must bind the new hashes;
never relabel v6's sync pass as v8's. Article fact gate remains failed. Review both
finished cuts with sound before conditional replacement filing and the two links.

## Composition approval — 19 Oct

Krish replied "Looks good" to the displayed Sally card and cross-cut composition
audit. Recorded in repair-approval-19oct.json as approval of that illustration and
composition direction. Neither complete new cut was presented at this point; this
does not certify full playback, finished-video acceptance or publication clearance.

Short v8 picture/audio export completed, SHA256
93a10b5bcb6af642878c3bd1d100bfec659f93ccd790b8850cd5c49ffbdd6eec.
Decoded PCM matches v6 exactly; evidence in short-v8-audio-identity.json.
Native final frame at 31 s inspected: Sally illustration is present, caption
clears artwork. A hash-verified preview was copied early to the chat outputs
why-so-many-ais-short-review-v8.mp4 for human review while automated checks run.
This is not delivery certification. Short render session 99204 is transcribing
the final; deep session 7726 is now encoding; checker 61229 remains active.

## Complete short accepted — 19 Oct, 17:35 London

Krish answered "Looks good" to the complete short v8 and the explicit question
asking whether its speech, captions, cuts, visuals and music work after watching
with sound. Exact-file approval: short-v8-human-review.json. Raw ASR differences
are preserved in short-v8-caption-comparison.json, resolved using independent
source/final recognition, verified decoded-audio identity and this human review.
The local receipt now has heard/full_review/loudness pass; sync and visuals still
await current checks. This records human review, not assistant playback.
Six short sync windows have been extracted, model measurements pending.
Deep v4 encoding remains active. Nothing filed and no deep acceptance inferred.
