# His pick, on the board

Ruling (Krish, 2026-11-15, approved with the specialists plan): thumbnail options carry a pick press on the Content
board. The board draws the set from the piece's making record (view contract 1.16.0, `docs/PUBLISH_BOARDS.md`,
"Thumbnail options and his pick"); this is what a session does so it can, after the critic's verdict (SKILL.md step 4)
and only when the critic does not hold back every option (never put options below the bar to him).

1. **The review copies.** File each option's two files and the grid mock in his Drive's Inbox from My AI
   (`docs/DRIVE.md`), named `Thumbnail option - <piece date> - A wide`, `... - A tall`, and so on, and
   `Thumbnail options grid - <piece date>`. On a cloud session use the n8n "Drive file uploader (cloud sessions)" (the
   connector cannot file a picture); on a home computer, the Drive mount. Read each back. These copies are for his pick
   only: the thumbnail itself reaches the post's `3 Posts` folder through `send.py` after his pick (produce-video steps
   7 and 8).
2. **Their ids, beside the set:**
   `python3 scripts/pages/thumb_options.py drive WORK/thumbs a:wide=ID a:tall=ID b:wide=ID b:tall=ID [c:wide=ID c:tall=ID] mock=ID`
   writes `WORK/thumbs/drive.json`. It refuses unless the set on this machine is the one recorded and every file and the
   mock is named once with a Drive file id. Drawing the mock again (`thumb_options.py mock`) removes it.
3. **Record the set, its verdict and those ids, by sha256:** `python3 scripts/post-pack/making.py <piece> thumbnails WORK/thumbs`.
   Each file carries its `drive_id`; the same set recorded again keeps its verdict and any answer he gave. The board's
   day now shows every option at its own shape, tall beside wide, with the critic's line, Pick on each option it does
   not hold, Not this on the set and the grid mock beside them; the piece's one action is Pick the thumbnail. Without
   the ids it says the options are not in Drive yet and offers no press.
4. **On the piece too**, so his day's materials hold them:
   `python3 scripts/post-pack/board_session.py <piece> add WORK/thumbs/grid-mock.png --kind output --role thumbnail-options --title "Thumbnail options in your grid"`,
   and the same for `WORK/thumbs/options/<id>/...` ("Thumbnail option A, tall").
5. **Ask once:** `python3 scripts/post-pack/making.py <piece> thumbnails WORK/thumbs --ask "$(python3 scripts/post-pack/live_board.py <Monday> <day>)"`.
   One item on his list (`thumbs-<set>`), his judgment. It closes by itself once his answer to this set is on the record
   (Control Centre's done check, never a cron), and at the latest at the Video assets step.
6. **His answer.**
   - **Pick on the board:** on the record as `pick` with `decision: "picked on the board"` and his press time; nothing
     to record. Read it with `making.py <piece> show`. It is his decision, never words: do not write words for it.
   - **Not this on the board:** on the record as `redraw`, with his words if he gave any, which also reach his taste
     ledger and the rejection floor by themselves. Go back to SKILL.md step 5 (repair) with them, at most two rounds.
   - **In a session instead**, in his exact words:
     `python3 scripts/post-pack/making.py <piece> thumbnails WORK/thumbs --picked b --krish-words "Krish, YYYY-MM-DD: his words"`.
     A correction to the design goes to his taste ledger too (`report_to_taste_engine`), word for word.
   A press on a set that is no longer the one on the record is refused (409 `thumbnail_options_unbound`): a new set
   needs its own verdict, review copies and ask.
