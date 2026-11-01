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

| Cut | sha256 | Length |
|---|---|---|
| Mon long 16:9 | `bda934f51674f3960ac7a1c6d43ff2d31c436f30b08f438a23b6c96c1cd792a1` | 290.47 s |
| Mon short 9:16 | `cd64c0458814cb6c2710b18a31016f2fde66705e2cc10e722d73b5ec5158ed22` | 68.47 s |
| Wed long 16:9 | `9ac6f10b757757615d8a373740ee38eef74c193335adf90bf2bbcfdbc9591a44` | 286.8 s |
| Wed short 9:16 | `491cb78cf350dc80f4841ddd0d7c327abcbcb1c33cffde751719486400ca6201` | 77.8 s |

## Where they are

All four are on the 2 Nov publish board, build `739e66ab`, read back with each video's sha matching. Monday and Wednesday are marked **review**, with the reason on the board. Friday stays ready: its videos carry Krish's approve-for-publish words (picks/fri-publish), and they now resolve to stored assets.

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

**Monday long's `sync`.** It is inconclusive, never a pass. 32 segments are in sync and none out. Two windows read under SyncNet's confidence floor of 3, with the face found in every frame:
- 2:06.2: confidence 2.95, offset 800 ms.
- 3:29.0: confidence 2.75, offset -40 ms, where he turns to profile.

The thresholds are unchanged. A re-measure, or Krish's ear on those two moments, is the next step for that cut.

**`visual_clarity`.** Krish's ruling on the words on screen is in hand. The gate also needs two more things:
- a frame-exact inventory of every rendered text state, made from the frames;
- an independent, blinded three-second comprehension review of each state, by a reviewer that is not the author and has seen no sound and no captions.

The plan segments are not fine-grained enough to stand in for the inventory: the opener and the changing counters sit inside larger segments. Mid-state frames of every segment are in `.cache/proof/vc/<cut>/`, as a starting point.

Once a reviewer writes the inventory and the review and `receipts.py status` reads clean, the remaining steps are:
1. Archive with `scripts/quick-edit/archive.py`, with `MINDMAKE_ARCHIVE_ROOT` set and the share copies in a `share/` folder beside each video.
2. Send each folder with `send.py`, dry run first, to:
   - `3 Posts/2026-11-02 Mon follow.the.money - Who trains your 2030 seniors/3 Video`
   - `3 Posts/2026-11-04 Wed under.the.hood - Claude Duet/3 Video`
3. Record each cut with `making.py <piece> video long|short --video-file <file>`, as in each day's `video/FILE.md` step 4, with the lengths above.
4. Republish the board with both days set to ready.

## Engine fixes made on the way

- `sync_check.extract`: overlapping windows now decode. Before this, every real run ended with "Sequential decode ended before all diagnostic windows".
- Face finding: S3FD, with its weights pinned, and Haar only as a fallback. Haar found the face in 20 to 29% of Wednesday's frames because of the cap and glasses.
- The environment: torch reinstalled after a half-finished install, and opencv put back to its pinned 4.11 (5.0 has no CascadeClassifier).
