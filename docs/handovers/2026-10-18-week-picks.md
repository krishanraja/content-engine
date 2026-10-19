# Handover: Krish's picks for the week of 19 October

Start a fresh Claude Code session on `krishanraja/content-engine` and paste: "Read
docs/handovers/2026-10-18-week-picks.md and do what it says."

## Where things stand (18 Oct, evening)

- **The board**: This Week's Publish Board (wC 19 Oct), https://claude.ai/artifact/CDgS3JDULpzvRnxkHwLkVk,
  pinned, published with Krish's yes. Its first tab, Ideas, holds 13 checked ideas from
  `docs/plans/2026-10-19-week/ideas.json` (Mon 4, Wed 4, Fri 5). Built by
  `python3 scripts/post-pack/week_board.py --week 2026-10-19 --live --ideas docs/plans/2026-10-19-week/ideas.json --out .cache/week-board/2026-10-19/week-board.html`.
- **The other link**: `config/boards.json` also lists https://claude.ai/artifact/4SZR5ZrQnG657ezuzvvAML, made from
  Krish's other account and not openable from this one. A session on that account republishes the same build
  there (Artifact publish with `url`), or Krish says to drop it.
- **Code** (branch `claude/modest-brown-q37di3`, commit 8deb0be): `--ideas`, `read_ideas`, `ideas_panel`, the
  pick script in `week_board/week.js`, `--verify` refuses fewer than four checked ideas a day (MIN_IDEAS),
  97 self-checks, plan-week skill step 3b. Not yet merged to main.
- **Krish's own ideas from last week** (board item `krish-ideas-week-2026-10-19`, closes on `session`): the
  bake-off and the connectors piece are on Wednesday's Ideas tab, the models-by-country cold idea on Friday.
  Close the item once his picks are written to the week page.

## What to do

1. Read his picks: `ArtifactComments read` on the board (comments starting `PICK mon|wed|fri`), and
   `ArtifactData list picks` on the same link. Each pick names `pick` (e.g. `wed-2`), `idea_id` (null for an
   idea with no row yet) and its story.
2. For a pick with no row: `POST /api/content-ideas {"raw_text": <story + fact + source>, "source_type":
   "week_research"}` (never `manual`; for his own ideas name the source `said:` only if Control Center filed it).
3. Write each day's options through `POST /api/week/options` (at most four a day), his pick rank 1 and
   `recommended: true`, why_now with its date. The press that schedules it is his, on the week page.
4. Rebuild the board with `--live --ideas ... --previous .cache/week-board/2026-10-19/week-board.json`, verify,
   browser-test every tab (picks save, every source link opens), republish to every link in
   `config/boards.json` for the week.
5. Write `docs/handovers/2026-10-19-monday-piece.md` for Monday's `make-piece` session (Sonnet for renders and
   packs), commit, and tell Krish to start it fresh.

## Lessons that bind every step (16 to 18 Oct)

No bare scores; check a filed date before using a fact; paid fact checks estimated from `meter_daily` and
capped, sign-off through `fact-check {action: 'sign_off'}`; test the board in a browser before every publish;
every file links to its current Drive copy; the article links sources from the phrases they back; titles are
his after recording; analogies only in scripts; nothing lives only in a container; one fresh session per job.

## Facts that did not hold (do not reuse)

The 14 Oct research said GLM-5.2 completed end-to-end self-replication (Al Jazeera, 13 Oct: no model reliably
copied itself to the test TV; other reports say the targets were emulators) and that Musk's LEGO order was
$241 (not in Futurism's report). Character.AI's monthly burn is unconfirmed.
