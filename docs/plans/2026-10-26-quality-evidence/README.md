# Media-standard calibration: failed reviewer, activation held

26 October 2026. Krish approved exactly the prepared $3 calibration ceiling. Eight inference requests completed once each, with immutable reservations and independently read-back receipts. No qualifying signature, Video assets completion, final board activation or public publication resulted.

## Decision

**Do not use this reviewer route to qualify production.** It invented speech both in a video with no audio stream (E) and in a separate eight-second all-zero PCM recording (H). Accurate-looking reports on A/B cannot override these controls. Visual reports can guide repairs, but they do not establish continuous playback, reliable word counts, a human three-second comprehension result, or an approved carousel baseline.

The durable standard and delivery enforcement are implemented locally and remain an unactivated draft. Friday's four videos and final Publish Board are still unfinished. A versioned rule is necessary but is not proof of a functioning reviewer.

## Results

| Case | Frozen input | Observed result | Scope |
| --- | --- | --- | --- |
| A | Previously accepted 84.9-second VO audio | Plausible transcription; no reported edit defects | Does not validate the reviewer after H |
| B | Rejected 49-second join reel | Reported fragments and several suspected cuts; also confused deliberate excerpt separators with edit defects | Diagnostic only; false-positive confound |
| C | Accepted photographic direction still | Recognised editorial photographic treatment and visible brand application | Direction only; no motion or full-video approval |
| D | Rejected icon/diagram still | Identified generic iconography, weak accents and ambiguous relationships | Useful negative-example discrimination; no qualification |
| E | Silent 12-second insulation motion proof | Invented narration, sync observations and a clean-audio verdict | Decisive combined-review failure |
| F | Three-slide supply-chain carousel plus PDF | Understood the sequence; found inconsistent component shapes and dispatch/arrival ambiguity | Useful repair observations; no accepted carousel baseline |
| G | Same E bytes, explicitly measured no-audio inventory supplied | Reported no audio, limited itself to sampled visuals | Prompt adherence; not independent detection or full playback |
| H | Eight-second PCM WAV, every sample zero; expected answer withheld | Invented two utterances, a clipped consonant, a pop, room-tone changes and a 7.18-second duration | Decisive audio-review failure |

Actual PCM readback for H: 384,000 mono samples, 48 kHz, signed 16-bit, 8.000 seconds, zero nonzero sample bytes. SHA-256 `636a56f23ec00f9e6923e29d2ada9f2e39e7696da33e6a03bfaa47b8ccb00f33`. E/G MP4 SHA-256 `98f081ce66de5f5f2b86c3b3944d98dbcc164468a780fd1282a70e3699520ccf`; FFprobe identified one H.264 video stream and no audio stream.

The endpoint checks library metadata, independently hashes downloaded bytes, then puts those exact bytes into `inlineData` as base64. Inputs have neutral model-facing names and no reference transcript. No submission fault has been found in this path; this is not a claim about the provider's internal cause. Preserve the raw reports as failed evidence rather than correcting them into passes.

## Accounting and provenance

- Eight requests, zero automatic retries. Maximum reserved: **$2.25536**, within the approved **$3** ceiling. All eight slots are consumed; the unused ceiling is not permission for a ninth request.
- Reported-token estimate: **$0.171354**. This is not a provider invoice. `thoughtsTokenCount` was omitted; in all responses the reported total equals prompt plus candidate tokens. Receipts retain the conservative full reservation.
- A-F preview: `https://content-engine-fizumbiwj-krish-rajas-projects.vercel.app`.
- G/H preview: `https://content-engine-6wbes6t80-krish-rajas-projects.vercel.app`.
- Owner authentication was verified, anonymous access returned 401, and an unknown case returned 400 before inference. Provider credentials stayed in the hosted runtime. The route refuses production deployment and spending after its fixed expiry.
- `initial-six-case-manifest.json` reconstructs the original frozen manifest and matches A-F's recorded canonical hash. `final-eight-case-manifest.json` preserves the G/H manifest. Existing receipts are immutable and retain their original manifest/request hashes.
- `receipts/` contains the actual returned and storage-read-back results. `calibration-results.json` binds local receipt files, request hashes, usage and control measurements. `evaluation-library-receipt.json` and `diagnostic-library-receipt.json` identify the shared media and independently verified bytes. Prior-piece assets remain evidence, never reusable production inputs.

## Implementation verification and release hold

TypeScript checks passed for root and control-plane. Focused qualification and board tests passed (21); making/workbench/board/library tests passed (140); packaging (5), render-v2 (54), carousel (23), and the board builder self-test (221 checks) passed. The pilot's focused suite is recorded in `independent-evaluation.md`. The full local verify did **not** pass: the default test pool stalled, and subsequent full/focused large runs hit a Windows process access violation. Some archive assertions passed before a nonzero process exit; they are not a clean suite result. CI must run on the committed branch.

A test fallback briefly created three synthetic archive folders in the real archive. Only the proven synthetic folders were moved into recovery storage, with SHA readback; no existing production folders were removed. Archive tests now use an explicit isolated root. This failure is preserved here rather than hidden by the later passing tests.

Release prerequisites remain: a separately provisioned and successfully calibrated reviewer with its private key outside producer access; actual complete-media inspection; exact-artifact and direct-API deployed tests; Control Center consuming verified readiness; and successful ordinary draft-board activation with the reviewer. Deploying these gates before that would block board updates without a functioning route to qualify them. Keep the PR draft and hold production activation.

## Next action

Replace the failed review capability before activating the gates. Keep deterministic stream/PCM checks, unprompted transcription and acoustic boundary evidence separate from perceptual listening. A new provider run requires a new concrete bounded approval; this pilot has exhausted its eight authorised requests. Continue reversible Friday visual repairs and preserve its accepted short audio. The first camera join remains blocked by insufficient acoustic clearance; never apply it from an ASR boundary alone. See Friday's `audio-diagnosis-correction.md` and `audio-repair-proposal-2026-10-26.json`.
