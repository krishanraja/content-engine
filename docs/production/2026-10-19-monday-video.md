# Monday 19 October: video production

Status: preparation in progress; no finished render or publication.

Piece: `5b5bfadc-a60c-4d0a-be8e-b2e9bf43d092`.
Source branch: `claude/editorial-narrative-brief-qjhsyn`, inspected at `eea1220`.
The web publish board is authoritative: https://content.krishraja.com/board/2026-10-19.
Older artifact instructions on this editorial branch are superseded by the completed web cutover on main.

## Verified intake

Both takes were placed by the Recordings lane. Each carries the current signed-off script hash.
Downloaded copies passed the recording downloader's size and SHA-256 checks.

| Cut | Source duration | Recording SHA-256 | Script SHA-256 |
|---|---:|---|---|
| Long, 16:9 output | 354.889 seconds | `8b7ef954b137f505586e2220e534635eac0ab267450622b52c7fc5ec50f13e6a` | `b64a64d089afda57b1962b351f3f5d616a616da7b99c1641b95babb30b8bad55` |
| Short, 9:16 output | 79.650 seconds | `3028aedb2beb03491b07c96f26e7060f920a68138d6fbae02df5aaf632d8bbc3` | `f328905d9989d2f5aff2ccccd5bcb9734d835d8876ff03d73a409388ffa2e28e` |

Both sources report H.264, 24 fps, 1920 x 1080 encoded dimensions and AAC at 48 kHz. Respect rotation metadata when framing.
Pinned Python 3.12 runtime passes the quick-edit doctor, including actual audio decoding. The system Python lacks the transcriber; use the pinned runtime. Python Playwright remains a warning to resolve before artwork generation.
The licensed music file matches its ledger hash. Story intro/outro design is approved; the separate generic sting remains a candidate.

## Production brief

Audience: a nontechnical leader at a medium-sized company, viewing on a phone or desktop. Explain the commercial decision without patronising them.
Outcome: two separately edited cuts with clear explanatory graphics, accurate captions, balanced dialogue and music, story intro/outro and a thumbnail per size.
Route: repository quick-edit pipeline. These cuts do not use the Studio job queue or require a runner failover.

Krish's direction: "some of the cards are just left a bit weirdly sparse" and "The visuals must be outstanding and clear for a layperson but also enterprise grade."

Use the existing publication design system: Anton headlines, Archivo text, IBM Plex Mono data labels, follow.the.money colours and real company logos. Every visual states its point and the viewer question it answers before drawing. Design wide and tall compositions independently.

- No empty image placeholder on a text-only beat. Recompose it as a complete typographic explanation.
- Comparisons share aligned units, scale and labels. Separate AI reading prices from writing prices and show dates/conditions.
- Reuse needs a concrete repeated-policy-document illustration, with its discount distinct from the later price rise. Follow the recorded explanation, not an assumed technical detail.
- The budget, contract and switching recommendations use one consistent visual sequence.
- The prediction must say it is Krish's prediction. His recording handover changes it to 95% by the end of 2026; verify against the take. Never show the old 55% / March 2027 card.
- Motion reveals the explanation in spoken order. Keep type readable throughout transitions and give the viewer time to absorb each comparison.
- Audit empty space, small graphics, detached text, safe areas, logo legibility and caption collisions in both shapes.

## Authority and remaining gates

Do not edit either recorded script. Krish approved set A and its listed treatment, including titles, thumbnail words, card headings and story intro/outro. That approval is recorded in `docs/plans/2026-10-19-monday/video-signoff.md`.
The fourth paid article check completed for $0.35, but its fact gate has not passed. Eleven entries await the requested manual resolution. No fifth paid run is authorised. Visual gate and pack are also unfinished on the making record. Do not mark these as complete or file videos as publish-ready through a failed gate.
Friday repairs have their own checkout and outputs; do not alter them.

## Acceptance evidence required

Narration difference report and manually checked caption corrections; clean render plan; actual final file readback; final audio loudness -14 LUFS +/-1 and peak at most -1 dBTP; full-duration visual review sampled every second, every quarter-second through intro/outro, and playback/listening of edits and transitions. Preview stills alone do not prove the video works. Check both thumbnails and library/archive hashes. Record only genuine finished outputs as Codex.

Local working assets: `.cache/produce/2026-10-19-5b5bfadc/`; source copies: `.cache/recordings/`. Source files and derived media stay out of Git.

## Preparation evidence

- All six web collections were read for both unfinished weeks. Monday 19 October has no saved edits or ticks; its two editorial comments ask for the big-firm comparison and a medium-enterprise audience without excessive simplification. Earlier-week publishing ticks remain authoritative; an untick never reverses an existing making record.
- Short narration: automatic transcript contains 235 words in 79.60 seconds, compared with 198 script words. Raw comparison reports 44.3% additional/rephrased wording. These are provisional ASR measurements, not a final caption verification. In particular, the automatic transcript's "can sort of price rise" needs checking against the audio before correcting it to the intended cancelled-rise wording.
- Both source contact sheets were inspected. Footage is portrait after rotation, outdoors and walking, with backlight and changing exposure. Compose the wide output around portrait footage; do not stretch it.
- Eight-second before/after stabilisation samples were made for both cuts. The first short treatment produced visible facial artefacts and is rejected. A second, simpler interpolation pass with lower correction limits passed the sampled-frame artefact check, but offers little apparent benefit for its crop. Production judgment: no blanket stabilisation; assess any distracting individual jolt on the edited timeline. No source file was changed. These sample checks are not a full-motion or finished-video certification.
- Source audio measures -27.40 LUFS / -10.35 dBTP (short) and -27.24 LUFS / -6.65 dBTP (long). These are input measurements. The one-pass measurement outputs do not reach the final target and are not deliverables. Use dialogue repair and measured final mixing through quick-edit, then remeasure the encoded files.
- The approved music track is 189.768 seconds and not marked loopable. It does not qualify for a continuous 365-second bed. The combined wording sheet proposes existing episode-style music for the long cut and continuous music for the short; Krish's decision is pending.
- A fresh cold reader reviewed the packaging drafts. Ambiguous and overbroad lines were revised; the title checker correctly refuses use while Krish's pick is absent. No verdict has been invented.

## Approved production, later on 19 October

Krish: "Approve set A and the listed treatment". Video wording is recorded in the title ledger. Both thumbnails, 26 panels and four story clips are drawn. Layout bounds pass and the picture/intro/outro contact sheets have been inspected. The full renders are still awaiting final verification.

The long take contains 1,014 automatically transcribed words in 5.89 minutes, 24.9% above its 812-word script; 41.7% is additional/rephrased wording. It confirms 95% by the end of December 2026. The source transcripts and narration comparisons are preserved under the Monday plan. A second local ASR pass over the short's unclear phrase returned "cancelled a price rise"; the caption correction is now explicit in its config. This was not manual listening.

Krish separately approved the fourth paid v2 fact check. The article was updated only to his corrected prediction, and read back exactly. The run completed at 17:49:56 UTC despite a client connection reset. Recorded cost is $0.35, not the $0.10 last-run estimate. Eleven remaining gate entries require resolution; see the primary-source and arithmetic review in `docs/plans/2026-10-19-monday/fact-review.md`. No further paid call has been made. The later approval is recorded below; this evidence alone does not override the gate.

Full `npm run verify` completed with 1,743 passing and 36 failing tests, primarily local timeouts, plus Fontconfig and Windows credential-fallback fixtures. A subsequent focused run passed all 91 prediction/narrator/authentication/one-close checks. Skill synchronization and the workbench check pass. Do not label the full local verification green.

## Render and archive readback

Both cuts and thumbnails are rendered and archived together: https://drive.google.com/drive/folders/1wXlFsY7iFyng_TNzO9fvJZUEoC2FwaHD. Cloud metadata confirms all four assets and matching sizes; archive-copy SHA-256 values match the local outputs. The archive also contains captions, chapters, three listening excerpts, the approved wording, fact review, render reports and production/frame-review ZIP. Long: 350.9583 seconds, -14.7 LUFS, -1.4 dBTP. Short: 85.5 seconds, -14.2 LUFS, -1.4 dBTP. All 436 one-second frames plus 76 intro/outro quarter-second frames were inspected. The short face-band crop and Argon capitalization were repaired; long intro/outro audio was balanced and its video stream hash stayed identical. No blanket stabilisation. No real-time audiovisual listening/playback was possible in this interface; three long-caption passages remain flagged in `caption-review.json`. These are review copies, not cleared publication assets. Fact, pack Visual gate and Pack remain open, so no post-library delivery or Video-complete record was written.

The first bookend audio correction was rejected at -0.7 dBTP; it did not replace the accepted video. A lower limiter ceiling produced the accepted -1.4 dBTP result. Both pre-correction and final evidence were retained locally. The archive contains the accepted outputs. `balance_long_bookends.py` refuses a second pass on an already balanced report.

The minimal video/thumbnail visual fixture reports only the expected missing pack pictures; it reports no video or thumbnail failures. This is not an overall Visual gate pass. Both typechecks pass. PR #107 now has green Ubuntu/Windows verify, board, browser, SQL and dependency checks. The earlier full local verification remains recorded as red; it was not relabelled green from CI.

Local validation distinction: the Claude skill copies match their .agents sources and workbench validation passes. The installed Codex quick validator rejects the existing `model: sonnet` frontmatter in produce-video; this is also visible in the earlier skills log, so a blanket local skills-validation pass would be incorrect. No skill content was changed in this follow-up. CI uses the repository fallback validator.

## Manual fact sign-off readback

Krish approved the exact listed entries: "Sign off the listed entries on that basis". The authenticated API saved nine new distinct sign-offs covering ten claim entries, preserving the three prior sign-offs. A fresh GET confirms one remaining blocking claim: the OpenAI 21 August $4/$20 sentence is labelled contradicted, which signOff refuses by design. The live OpenAI changelog explicitly supplies that date and those promotional prices; the independent checker cited older launch prices. No fifth paid run, article edit, or gate override was made. Evidence and the exact receipt: `fact-signoff-receipt.json` and `fact-review.md` in the Monday plan.

## Current delivery status

Krish declined a fifth paid run: "Keep the videos in review; do not spend more". Both cuts remain review copies. No additional paid fact check, posting, gate override, or Video-complete record is authorised. Ten of the eleven listed claim entries have recorded sign-off; one contradicted-category entry remains blocked despite the dated primary-source evidence. Next work is unpaid diagnosis or review, with any new paid action requiring fresh explicit approval.

## Review PR verification correction

At commit 8956d09, Windows CI passed all 1,786 tests (one skipped) and skill checks, then rejected the merged workbench at 64,404 bytes. The branch alone was under the limit; concurrent main content raised the merged size. The Monday workbench section was shortened, retaining detail in this production report and the plan receipts. Recheck the actual merge result before merging PR #109.
