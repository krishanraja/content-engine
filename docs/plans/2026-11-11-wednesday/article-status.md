# Wed 11 Nov article: where it stands (make-piece run, 4 Nov 2026)

Piece 36886e0b-4b32-473b-be72-b0aef31fccef. Run: https://github.com/krishanraja/content-engine/actions/runs/41790318813
Draft: `docs/plans/2026-11-11-wednesday/article.md`, from the signed lock `docs/plans/2026-11-09-week/narrative-lock-wed.md`
(its five outline headings, in order, as the `## ` sections) and the research brief `wed-research.md`.

## Done in this run
- Article drafted, 1,121 words, speaking as "we", no name of his. It has no "3 things you can do tomorrow" section, by his
  ruling in the lock (Krish, 2026-11-03: "This piece doesn't need the three things you can do.").
- `voice_check.py`: passes, score 4.0 (bar 6). The only remaining warnings are lists of three (12) and a call for more
  asides (2 now).
- `copy_lint.py --applies-to article_body`: clean.
- One prediction, in the last section and ahead of his close: another UK top-ten single shown to have started as a Suno
  or Udio demo by 30 June 2027, 75%. Whether to keep it is the open question below.
- Ticks and comments on the 9 Nov board read: no ticks, no new comment on Wednesday.

## What was missing, exactly
1. **Verbatim sources.** No material is filed on the piece (`GET .../materials` is empty). Filing one needs
   `npx tsx apps/control-plane/scripts/file-verbatim-source.ts` plus a web read of each page. This run can use only
   python3 and cannot read the web or Drive, so the fact gate (pre-check or paid run) was not run. Pages to file, one
   per claim, are in the lock's Facts to check: hu.wikipedia.org/wiki/Imael_Angel, frequence3.com, the Amazon author
   page, edm.com/?p=271236 and weraveyou.com (HUGEL's rebuild, the layer of AI vocal, Ultra Naté 58), Official Charts
   (No. 2, 19 weeks; Bad Times No. 67, EMI), Qobuz credits (Cali Bee, Robin Brandes, Universal Music GmbH), The
   Australian of 17 Oct 2026 (the Grammys ruling), Companies House 17344041 (16 July 2026), Blikk (Beatport, 113 million,
   both written as "reported"), DJ Mag France (the 95% figure unverified), MistaJam's line, the Shazam Greece No. 1, and
   the comment counts (5.6%, 0.8%) and Reddit lines from the community corpus in Drive.
2. **The AI scan.** `ai_scan.py` cannot load its models here (no torch). Run it on the next machine that has them.
3. **The node kill list.** Not run (node is not allowed here); the article was read against its vetoes by eye: no em
   dash, no "!", no name of his.
4. **The board.** Wednesday's tab was rebuilt with the article as a third review box and the question below as its one
   waiting line (`week_board.py ... --target web`, verify passed), but `board_web.py publish-web` refused it:
   "Existing asset mon-video-long changed or is missing; refresh the mapping". The active build
   (8d78f0f0..., revision 25) holds an empty `assets` map while its page links Monday's six downloads to
   `/api/board/2026-11-09/assets/...`. Suspected, not proven: Monday's downloads on the live board are broken since that
   build. `docs/plans/2026-11-09-week/board-assets.json` needs refreshing by a session that holds Monday's files (or
   their Drive download) before any rebuild of this week can publish. The board was left as it was.

## The one question for Krish (to go on Wednesday's tab as its waiting line)
Wednesday's article ends its last section with one prediction, just before your close: "We think another UK top-ten
single will be shown to have started as a Suno or Udio demo by 30 June 2027, and we'd put that at 75%." Keep it, or cut
it so the piece ends on the surprise alone, as the lock's use says? Best guess: keep it as that one line, because every
article carries one checkable call (house rule SHARP_PREDICTION).

## Code gap to name
The publish check THREE_THINGS_TOMORROW (`api/_publishChecks.ts`) will refuse this article, which has no such section by
his ruling. It needs a per-piece exemption that carries his words before the publish page can pass.

## Next, in order
Refresh the board's asset map and publish Wednesday's tab with the article and the question; file the verbatim sources
and run the fact gate (`scripts/engine.py --budget=...`); `ai_scan.py` and the node kill list; figures and the reader
test; the creative direction (Scripts step 7, `style.motion` required).
