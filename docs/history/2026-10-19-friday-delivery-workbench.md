> **Historical.** Archived 2026-10-19 by the session that wrote PR #113; banner added by the docs steward. Not current guidance.
> Replaced by: `WORKBENCH.md` and `docs/handovers/2026-10-19-friday-repair-complete.md`
> Reason: completed Friday detail moved out of `WORKBENCH.md` to keep it under its size limit.

## Friday repairs delivered — Codex, 19 October

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
evidence live on `codex/friday-video-repairs`, [merged PR #108](https://github.com/krishanraja/content-engine/pull/108).
Full local `npm run verify` passed. The minimal-CI fixture correction passed 40
mix checks without ASR installed; the nine-scenario Windows authentication test
passes with the same 15-second budget as its adjacent disk-heavy test. Current
full CI results are on PR #108, merged with Krish's approval at `e2a7b6b`.

Correction, 19 October: the effective article fact gate **passes** with Krish's
11 recorded sign-offs. The earlier failed label read only the raw automated
verdict. The only blocking check was the new 92-day prediction horizon; Krish
approved retaining this piece's existing forecast as an exception, bound to its
identity and exact prediction text. Implementation
and evidence: `docs/plans/2026-10-09-friday/article-fact-reconciliation-19oct/README.md`.
Publication remains separate; the archived video receipts are unchanged.
Detailed handover: `docs/handovers/2026-10-19-friday-repair-complete.md`.

