# Handover: off-day assets on the board, Saturday carousel, 3 Nov 2026

Session: https://claude.ai/code/session_01JRhKysZwHtkCdtU6aGbKrp. Krish asked to merge everything to main as needed.

## Done and verified
- content-engine PR #363 (branch `claude/board-offday-assets-2026-11-03`): board images were blocked by the board
  page's CSP (img-src 'self' while assets 303 to the file store; proven in Chromium). `boardPolicy()` adds the store
  origin to img-src and media-src. Off-day options take `slides`, `video`, `drive`; shown inline with Open in Drive;
  Tue/Thu/Sat tabs when a finished asset exists. Self-test 355, layout lock + 390px browser check pass. First CI run
  failed only on NOW.md size (fixed: closeout moved to now-notes/, main merged in, 3272402). Re-run pending.
- growth-makeyourmindup PR #55 (branch `claude/brand-mark-corner-2026-11-03`): CSS-drawn wordmark replaced by the
  official logo file everywhere (render/brand/, sha256 matches config/studio.json); carousels carry it small in a
  bottom corner; artdirect refuses a typed wordmark. Merges the Saturday maker (codex/sat-goodnews-v3). 942 tests pass.
- Saturday's seven cards re-rendered (words and photos as approved, logo bottom right), each checked at full size, and
  sent with send.py to `3 Posts/2026-11-07 Sat off.day - Five good things AI did for people/4 Social` (8 files).
- Ruling recorded in docs/CAROUSEL-STANDARD.md: off-day assets go to 3 Posts like the series days.

## Next, in order
1. When CI is green: merge #363 and #55 (Krish: "merge everything to main as needed"; no auto-merge on this repo).
2. Once the library sync has written the Saturday folder, take its Drive folder link (3 Posts).
3. Rebuild the live 2 Nov board through the plan-week rebuild route: Saturday option gets `slides` (the eight files as
   board assets via `--assets`), `drive` = the 3 Posts folder, `mock` = the new cover; Tuesday's `drive` should move
   from the 4 Growth folder to its 3 Posts folder (`2026-11-03 Tue off.day - AI agents translator`). Keep every press
   and comment; read the build back; never approve for him.
4. Make Growth's off-day filing use send.py to 3 Posts (per the new ruling), not 4 Growth.

## Waiting on Krish
- His Approve on the Saturday mock on the board's Saturday tab.
- An empty Drive folder this session created under 4 Growth ("2026-11-07 - Five good things AI did for people -
  Instagram and TikTok"); delete it only if he says so.
- The floor entry for the logo ruling needs his own typed words (filed only as an observation).
