# Friday video repairs and delivery

The media repair is complete: Krish accepted both finished cuts, the exact-file
checks passed, and both replacement library copies were SHA-256 verified. This
moves the creator-studio North Star by preventing recurrent production failures
from reaching Krish and by leaving reusable, reproducible evidence.

Both complete files were accepted by Krish with sound, then passed their exact-file
checks and were copied into the existing Friday post's `3 Video` folder. The actual
Drive library copies match the accepted SHA-256 hashes. Current downloads:

- [Deep cut, 16:9, 13:36.5](https://drive.google.com/file/d/1cfQ5LO8NsOoRNlmwv_Ac_hsxs0yElB52/view)
- [Short cut, 9:16, 87.75 seconds](https://drive.google.com/file/d/18R8c4y2HfmFHpccaAlG7PAJS02IbtDzo/view)

Rejected originals retain their file IDs and bytes in `3 Video/working repair 19 Oct/rejected originals`.
Both replacements are the latest entries for their cuts in the making record;
older entries remain history. Existing thumbnails are retained. The week of
12 October now points at the replacements, with its other days and interactions
preserved. Board migration was already completed on main; it was not repeated.

Both cuts measure within 40 ms at six calibrated checkpoints. Voice is about
-14 LUFS, final true peaks are -1.8/-1.3 dBTP, and the speech bed has no silence
longer than 0.5 seconds. Short visual coverage is 99.962%, with 24.54 changes per
minute. Native-size text, all one-second frames and quarter-second intro/outro
samples were checked. Full playback acceptance is Krish's; Codex does not claim
full audio/video playback. Raw ASR differences and human acceptance are preserved,
including independent evidence disproving the deep cut's apparent 14-word omission.

The report, captions, exact-file receipts and image credits accompany the videos.
`working repair 19 Oct` contains `repair-inputs-v8.zip` (all production images and
configs), `final-review-samples-19oct.zip` (sampled frames and sync captures), and
`final-qa-evidence-19oct.zip` (transcripts, measurements and reviews). Code and small
evidence live on `codex/friday-video-repairs`, [draft PR #108](https://github.com/krishanraja/content-engine/pull/108).
Full local `npm run verify` passed. The minimal-CI fixture correction passed 40
mix checks without ASR installed; the nine-scenario Windows authentication test
passes with the same 15-second budget as its adjacent disk-heavy test. Current
full CI results are on PR #108. No merge or deployment is authorized.

The article fact gate remains **failed**. Video repair is not publication clearance.
Detailed handover: `docs/handovers/2026-10-19-friday-repair-complete.md`.

## Exact identities and verification

- Deep v4: `4b908e3a93083be29fa538a13e790e9304151b237170f44f90102a4d3fdf63b9`.
- Short v8: `93a10b5bcb6af642878c3bd1d100bfec659f93ccd790b8850cd5c49ffbdd6eec`.
- Drive folder: `1pQ47IA3yDC5pIDHO_Z0N4rRcIjUCYp2o`.
- Preserved originals folder: `1e8fWHU1iwccM-F8slZBki6bb3RuoU-r9`.
- Active board build: `429daefd5682ff749159652127465ce06825ae36f98742799b5766f87f5228dc`.
- Evidence directory: `docs/plans/2026-10-09-friday/repair-evidence-19oct/`.
- Read `FINAL-REVIEW.md`, `drive-verification-19oct.json`, `making-final-readback.json`,
  `originals-preserved.json` and `board-final-verification.json` there.

The engine failure register has 33 guarded failures and none open. The general
analogy-to-cue automation proposal remains an open learning; the Friday cue set
itself was mapped and visually reviewed. No claim is made that every future
semantic visual omission is detected automatically.

## Reproduction and recovery

Repository: `C:/Users/krish/dev/mindmake/content-engine`. Preserve the incomplete
older `C:/Users/krish/dev/content-engine` folder. Python 3.12 and dependency hashes
are pinned. The recordings are fetched through the recording lane using their
stored hashes, not an ad hoc Drive download. Render configurations and graphics
are in the production-input ZIP; transcripts and exact caption repairs are in git.
The approved `no-curves-instrumental` music stays under `MINDMAKE_MUSIC_ROOT`.

The local work folder is `.cache/produce/2026-10-16-904658db`; it is not the only
copy of any required deliverable. The dedicated Linux independent-transcription
runtime is `/home/krish/.cache/friday-video-repair` on the existing configured
SSH host. Its outputs are copied to git/Drive and it has no ongoing job.
The library scheduled task is running after the verified one-pass delivery.

The prior board build `197574d279893a8b9fc2297b1392afb6f9b7b46ef525a87963ee5c77ec6b5439`
remains available through the documented board rollback command. It contains the
rejected video links, so rollback is only for an identified board fault. Do not
roll back newer interaction data or synchronize the archived Claude boards.

The chronological investigation is retained in
`2026-10-19-friday-repair-progress.md`; its intermediate checkpoints are history.
