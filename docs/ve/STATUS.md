# ve status (28 Oct 2026, Phase 1 complete, awaiting Gate 2)

Read `docs/ve/RUNBOOK.md` to produce. This page says what ve can and cannot do right now. Everything here was measured on the 19.5 s `my-test` proofs (tall and wide), on ffmpeg n8.1.2 with tesseract OCR (`. scripts/ve-env.sh`).

## Can do
- **Spec to picture in one clock:** `ve lint`, `ve compile`, `ve render` (tall 9:16 and wide 16:9) through one `FormatMaster`. Compile refuses a verb the device does not draw and anything Phase 1 cannot draw truthfully.
- **Devices:** `test_grid` (enter, mark, stamp, highlight, carry, exit), `record_card`, `query_chip`, `evidence_card`, `kinetic_stat`, plus BrandFrame, captions (always on), call card and ending band (unit-tested).
- **QC with no tokens:** `ve qc --props` runs 11 checks: loudness, density, longest still, periodicity, joins, mark tile, A/V sync, caption OCR, cue sync and more. Both proofs pass all 11, OCR included.
- **Render fixes:** props travel as ASCII escapes (no "Â·"); AAC priming (2048 samples, 42.7 ms) is measured and removed, residual 0.
- **Budgets that refuse:** `ve time` (60 engine minutes) and `ve ledger` (3.3M Claude tokens, 2.1M Codex tokens, 12.6M total, 1.2 allowance points); `ve dispatch --piece` refuses past a cap or above 80% of the weekly Codex allowance.
- **Codex cards:** `ve card`, `ve dispatch`, `ve verify-card`. Cards 1-7 and the doc cards were built this way.
- **Measured:** each proof renders in about 2.5 minutes (tall 160 s, wide 134 s).

## Cannot do yet (do not pretend otherwise)
- `ve ingest`, `ve stills` and `ve file` are placeholders (exit 2). Word timings with `end_s` and the archive step come from another route until they are built.
- **No sound effects:** no sfx kit exists, so compile lists `sfx_missing` ids and `ve status` blocks on it. Known Phase 2 gap.
- **No generated assets:** asset plates and generated media are refused; Runway, Higgsfield and ChatGPT Images are not wired.
- **No publish, send or schedule verb**, by design.
- **Tall recordings (ruling, 28 Oct, Krish delegated the call):** real footage stays as the proof; no typed replica, because evidence is never regenerated. A tighter crop cannot enlarge text that wraps the full source width (the my-test recording is about 1080 px wide and already shows at about 1:1), so the footage plays as a short proof glimpse and the words are carried as a labelled quote on the card (the `mark` verb already draws them as real text). If a future recording's text is narrower, crop to it; aim for body text of about 28 px in frame.
- **Tall layout has a dead band** under the grid and stat in beats 4-5, and the grid jumps from F3 to F1 without an animated move.
- **Call card and ending band** are not visible in the 19.5 s excerpt proof.
- **One real format** (`face-with-proof`) has been proven end to end; others are config only.

## Efficiency baseline (Codex token ledger, `scripts/session_token_audit.py --codex`)
- Friday 22-26 Oct: 20 threads, 1709 calls, 249.3M input (97.7% cached) and 1.0M output: the 253M baseline reproduced within 1%.
- ve build, 27-28 Oct (cards 1-7, fixes and doc cards): 25 threads, 465 calls, 33.5M input (94.6% cached), 0.24M output. That is capital, not per-piece cost.
- AGENTS.md went from 38 KB to 11.8 KB (nothing lost: the rest is in `docs/AGENTS-REFERENCE.md`); the session pack is about 19 KB of 36 KB, with ENGINE.md first and per-piece findings last, so the prefix is stable.
- Per-piece targets are now enforced by `ve time` and `ve ledger`; the first production run will give the first real per-piece number.

## Local caveats
- The user-level `MINDMAKE_DRIVE_ROOT`, `MINDMAKE_ARCHIVE_ROOT` and `MINDMAKE_MEDIA_INBOX` variables send some tests at the real Drive; `scripts/ve-env.sh` clears them.
- In a git worktree, `tests/archive-naming.test.ts` can write to the real Drive because `@mindmake/core` resolves through the junctioned `node_modules` to the main checkout. CI is unaffected. Run it from the main checkout.
