> **Historical.** What else was retired on 13 November 2026 as old, the evidence for each, and what was looked at and kept. Nothing here describes current behaviour; `docs/STATE.md` does. Every file named below is in git history.

# Old scripts retired, and what stays (13 November 2026)

Krish, 2026-11-13: "retire everything in the content engine repo that is old". Ruling (Krish, 2026-11-13): the old
publish boards are retired for good, and everything old in content-engine is retired. The boards went first
(`docs/history/2026-11-13-old-boards-retired.md`). This is the rest, by evidence: a file is retired only when nothing
calls it in code, no workflow or cron runs it, no route serves it, no skill names it and it writes no live data.

## Retired

| File | What it was | Evidence |
|---|---|---|
| `apps/control-plane/scripts/backfill-shifts.ts` | One-shot reconstruction of the Jul 2025 to Jun 2026 shifts baseline | Its header says one-shot; nothing imports or runs it; no doc, skill or workflow names it. The shifts it wrote stay in the database. |
| `apps/control-plane/scripts/consolidate-shifts.ts` | One-off merge of near-duplicate shifts after that backfill | Same: a follow-up to the backfill, run by hand once; no caller. |
| `apps/control-plane/scripts/dry-run-content-v2.ts` | One-shot dry run of Content Engine v2 against live data (its PR-A gate) | One-shot by its header; no caller. |
| `apps/control-plane/scripts/verify-content-v2.cjs` | The PR-B preview check of Content Engine v2's old Control Centre rooms, on `puppeteer-core` | No caller, no dependency it needs is installed; the rooms it drove were replaced by Control Centre's rebuilt UI. |
| `scripts/backfill_closes.ts` and `tests/control-plane/backfill-closes.test.ts` | "Run once" backfill of how each open board item closes, after migration 20261022091000 | Run once by its header; only its own test named it. |
| `scripts/quick-edit/friday_repair.py` | The 19 October Friday repair | Its own header said RETIRED and that nothing calls it; make.py refuses what it set. |
| `scripts/quick-edit/frame_review.py`, `scripts/quick-edit/independent_transcript.py` | Review helpers for the 21 October Wednesday cut | Only that week's plan named them; no caller in code, workflow or skill. quick-edit itself stays the fallback. |

## Looked at and kept

- **The carousel engine** (`studio carousel`: `packages/core/src/carousel.ts`, `packages/contracts/src/carousel.ts`,
  `apps/renderer/src/carousel/`, `docs/CAROUSEL_ENGINE_STATE.md`). Kept: the sources disagree. AGENTS.md says Growth
  makes the derived carousels since 28 October, but Growth's own calendar (`growth-makeyourmindup` `calendar/v1.json`,
  `carousel-instagram` and `carousel-facebook`) still names content-engine as the producer of the publishing day's
  carousels, the house carousel card took a ruling of Krish's on 5 November ("Follow for more"), and the harness canon
  lists `docs/CAROUSEL_ENGINE_STATE.md` among this repository's own rules. Who makes the publishing day's carousel is
  his to settle before the engine goes.
- **quick-edit**: the fallback until ve passes Phase 3 (AGENTS.md); `continuous_edit.py` and `privacy_crop.py` are its
  tested tools, and `privacy_crop.py` is a W2.5 floor item (`docs/plans/2026-11-07-wave-2.md`).
- **`scripts/post-pack/overnight_visuals.py`**: W2.5's thumbnails and covers for the overnight run, still being wired.
- **`scripts/board_store_backfill.py`**: files a week's plan files into the piece materials store the live board reads.
- **The Studio** (`packages/`, `apps/runner`, `/api/video-studio/*`, the `mindmake-video` skill): its routes and the
  `video-studio/runner/watch` cron are live and the runner still reports a heartbeat (`docs/STATE.md`).
- **makeyourmindup's machine**: nothing of it is copied here but the kill list (`vendor/makeyourmindup/kill-list/`),
  which every draft runs.
- **`apps/control-plane/scripts/archive-review/`**: `check-card-lint.ts` reads its rows as fixtures.
