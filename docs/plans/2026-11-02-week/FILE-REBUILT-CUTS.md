# Filing the four rebuilt cuts (2 and 4 November)

Filing is the agent's job, never his (Krish, 2026-11-01: "what are you talking about? I never do this step").

## What Krish approved

These are the cuts with the rebuilt openings and the remixed audio. His words, all typed on 1 November 2026:

- The set: "Approved, file them and put them on the boards".
- The openings: "yes, rebuild the openings and fix the audio".
- Monday's cuts: "I like it - looks good".
- Monday long's four words: "yes all good".
- Wednesday long's four words: "Heard them, all there".
- The words on screen: "Yes, happy with the words on screen".
- The flagged pictures, and Monday long's two side-on sync windows (2026-11-02): "1. accept. 2 clear".

| Cut | sha256 | Length |
|---|---|---|
| Mon long 16:9 | `a7eb0a498d6f5ec0dc9d2c6342c72f01151bb10710760731d2325b6a0c4ec48b` (2 Nov counters fix) | 290.47 s |
| Mon short 9:16 | `2cdff09a0c851e5ccb5373cd6a9d63e4f476d9e4f480160d38355a1e566f581a` (2 Nov counters fix) | 68.47 s |
| Wed long 16:9 | `9ac6f10b757757615d8a373740ee38eef74c193335adf90bf2bbcfdbc9591a44` | 286.8 s |
| Wed short 9:16 | `491cb78cf350dc80f4841ddd0d7c327abcbcb1c33cffde751719486400ca6201` | 77.8 s |

## Where they are

All four are on the 2 Nov publish board, build `739e66ab`, read back with each video's sha matching. Monday and Wednesday are marked **review**, with the reason on the board. Monday's two cuts on it are the bytes from before the counter fix. Friday stays ready: its videos carry Krish's approve-for-publish words (picks/fri-publish), and they now resolve to stored assets.

## The delivery checks, measured on these bytes

`docs/plans/2026-11-02-week/receipts.py` writes each receipt beside its file, and `sync_cuts.py` runs SyncNet, one span per timeline segment. Every one of these passes on all four cuts, except sync on Monday long (below):
- **opening:** `opening_gate.py`.
- **words:** `words_gate.py`, machine-written. The two long cuts use Krish's heard_as clearances in their EDLs, `docs/plans/2026-11-0*/rebuild-long.edl.json`. Wednesday long is checked on two local aligners, faster-whisper small.en and medium.en: medium.en hears ".ai." at the very end, which small.en heard as nothing.
- **loudness:** about -14.5 LUFS, true peak -1.0 to -1.8 dBTP.
- **sync:** SyncNet, now with the S3FD face detector, which finds the face in every frame.
- **motion:** the takes' stabilisation evidence, plus a framing review of the finished frames.
- **heard:** Krish's adjudication, with the raw recognizer result kept.
- **visuals** and **full_review.**

## What still blocks

On 2 Nov the Monday counters were fixed so they land on their true values (+43%, 28%, 9%, 20 to 13). Only those frame spans were re-rendered, and the audio is byte-identical. Every check was measured again on the new Monday bytes:
- **Sync:** the eight segments whose frames changed were re-scored. The rest decode identically by framemd5 and were reused. Monday long's two side-on windows are now `krish_cleared` under his words, and the cut passes.

Every check now passes on all four cuts except **`visual_clarity`**. Its inventory, the ruling block and the blinded answers are ready, and `receipts.py clarity` builds the check. It still needs one input: an independent scorer's `scores.json` for each cut, as `.cache/proof/vc/SCORING-REQUEST.md` describes. Every state the review predicts unclear, or scores wrong, is then named in accepted_states under "1. accept. 2 clear".

After that, the remaining steps are:
1. Archive with `scripts/quick-edit/archive.py`, with `MINDMAKE_ARCHIVE_ROOT` set and the share copies in `share/`.
2. Send each folder with `send.py`, dry run first.
3. Record each cut with `making.py <piece> video long|short --video-file <file>`.
4. Republish the board with Monday and Wednesday ready.

## Engine fixes made on the way

- The sync gate: Krish's eye may clear a named window the scorer cannot read. Such a window is recorded as `krish_cleared`, never pass, and a window measured out of sync can never be cleared (Ruling, Krish, 2026-11-02).

- `sync_check.extract`: overlapping windows now decode. Before this, every real run ended with "Sequential decode ended before all diagnostic windows".
- Face finding: S3FD, with its weights pinned, and Haar only as a fallback. Haar found the face in 20 to 29% of Wednesday's frames because of the cap and glasses.
- The environment: torch reinstalled after a half-finished install, and opencv put back to its pinned 4.11 (5.0 has no CascadeClassifier).
