> **Historical.** Moved here from `WORKBENCH.md` on 2026-10-21 by the working session. Not current guidance.
> Replaced by: `WORKBENCH.md` and `NOW.md`.
> Reason: completed Friday and Monday release detail, archived to keep `WORKBENCH.md` within its size limit (G11).

## 19 October: Friday ready; Monday final release

Friday is publish-ready on https://content.krishraja.com/board/2026-10-12#friday.
Monday's source-bound manual fact review is live after PR #113; the original
contradicted verdict is preserved and its effective editorial gate now passes.
Krish accepted both exact final cuts after full playback with sound. Both videos
are recorded as completed by Codex. The full 27-file pack was sent through the
private library pipeline and its Drive-mounted copies were SHA-256 verified.
No new paid check or public posting. The no-spend instruction remains.

Monday release files, human acceptance, measurements and receipts live in
`docs/plans/2026-10-19-monday/`. `narrative-and-visuals.md` is the new proposed
narrative/visual flow; it does not silently change either accepted recording.
The final web build and live readback are recorded in `release-receipt.json`.
Prior hold detail: `docs/history/2026-10-19-monday-prerelease-workbench.md`.
Monday is live: all 23 downloads verified by hash and size; all 42 stored
interaction records preserved. Wednesday's brief is now prepared in
`docs/plans/2026-10-19-week/wednesday-scorecard.md` is the current research shortlist
and simple, shareable narrative. Krish approved scoring and draft-only tests, then
clarified: "Here's a scorecard, so you don't have to go and use them all."
It is live in Wednesday's review workroom with the identical four-task packet.
The 50-record follow-up and 41-record peer workbooks plus deep corpus were read;
their extracted text is in `_corpus/2026-10-21-assistants/`. Counts overlap.
20 October: Grok Bot Windows completed all four draft checks, 3/0 each.
The four cases were batched in a fresh bot to minimise desktop time; Muse used
separate chats. Desktop released immediately after submission. Exact Grok prompt
and output are in test-results/grok-batched.txt. Muse scores remain 3/0 for email,
meeting and purchase, 2/1 for the false policy referral claim. Gemini Pro email
is a separate 3/0 baseline, not a Spark agent result. dots and Poke are research
only: Krish reports no UK dots access and has no Poke account. Muse/muso surface
identity still needs reconciling before claiming it is the corpus's Meta Muse.
Narrative and proposed visuals: wednesday-narrative-ready.md, linked in the board.
No spending or public posting. PR 117 merged; its full local verify passed.
The live readback preserved all 23 Monday assets and all 12 week/store snapshots.
Batch decisions and keep
routine production separate from reusable engine work; Krish flagged throughput.

## Friday repairs delivered — Codex, 19 October

Both accepted replacement cuts are filed and hash-verified in the Friday post library;
the week of 12 October serves them. Its effective article fact gate passes, including
Krish's approved prediction exception. Public posting remains separate.
Full evidence and preserved workbench detail: `docs/history/2026-10-19-friday-delivery-workbench.md`.
Handover: `docs/handovers/2026-10-19-friday-repair-complete.md`.

## Friday 16 Oct: handed over, 17 Oct

Krish ran out of usage on this account and asked for a handover. Everything the next session
needs is in `docs/plans/2026-10-09-friday/HANDOVER.md` (its first section is the prompt to
start with). Signed off: all titles, headings, cuts. Done: the sniff finder (18 dB, on by
default), the 90-second take's caption fixes and cues (`short-cut/short.json`), the tall
panels' spec, 51 long-cut cards (open faults listed), five Substack exhibits (checks not run).
Not done: both renders and their frame checks, the Substack page, pack, library, board video tabs.

## 21 October: the publish board has one fixed layout (Claude, part 1 of 4)

Krish asked to standardise and lock the board so the engine only feeds it. He
decided: new layout from the week of 26 Oct (12 and 19 Oct stay as they are);
an edit is carried to every draft and shown back with undo; his taste steers
idea sourcing and ranking, judges stay blind; order is frame and phone, then
Ideas and Queue, then Drafts editing and learning, then the publish list. Also:
every piece is a 90-second and a 5-minute video, and a 15-minute feature only
when he calls one ("Yes, replace it" the weekly deep cut).

- **Built (branch `claude/content-publish-board-ux-4dl7ai`):**
  `config/board-layout.json` (tabs Ideas, Queue, Mon, Wed, Fri; steps Brief,
  Drafts, Record, Publish; brief due the night before, drafts that morning);
  `week_board.py` draws weeks from 26 Oct only in it (`--brief DAY=json` new),
  phone layout (viewport, bottom tab bar, 44px targets), comments as a sheet;
  `verify()` and `npm run check:board-layout` (CI) refuse any other shape;
  the layout changes only with his recorded words (no approval prompts). House rule
  FEATURE replaced DEEP_CUT (`config/features.json`, `story_check --cut feature`).
- **Part 2 handover:** `docs/handovers/2026-10-21-publish-board-part2.md` (start a fresh session from it).
- **Next:** part 2, Sunday Ideas gathered from every source plus Queue
  "could combine" (learning `queue-consolidation-and-fresh-sunday-ideas`),
  ready for Sunday 25 Oct; part 3, Drafts editing that carries changes across
  and teaches (`edits-propagate-and-teach`); part 4, the publish list. Plan:
  `docs/plans/2026-10-21-publish-board/plan.md`; the rules in `docs/PUBLISH_BOARDS.md`, "The fixed layout".
- **Not yet:** the feature as a third cut in `making.py` scripts,
  `teleprompter_send.py`, `recording_match.py` and produce-video (board,
  story check, house rule and skills know it already).

## 20 October: Wednesday rewritten with Krish (Claude, editorial session)

Live: https://content.krishraja.com/board/2026-10-19#wednesday, build
`63bbc0e6…9db7` (readback hash matches the built file; Monday, Friday and Ideas
panels byte-identical; 24 assets kept; 28 comments, 0 edits, 0 ticks unchanged).
Sources: `docs/plans/2026-10-19-week/` (`wednesday-narrative-ready.md` holds
his decisions, `wednesday-article-draft.md` the piece, `wednesday-scorecard.md`
the takeaway card).

- **Krish decided:** the "order six products" emails were scams. Angle: "the
  one that says no" mixed with three personalities (Grok the sceptic, Muse the
  brilliant new hire, Gemini with a finger on send), scorecard as the
  takeaway. Reader: leaders at mid-sized firms. Everything private anonymised,
  no personal subscription specifics, Codex blurs screenshots.
- **Also decided:** closing line "If your team is about to get one of these,
  pick the one that says no at the right moment."; plain card cells, no marks.
  Titles after recording.
- **Lesson (Krish, 20 Oct):** bring strategic editorial choices (angle, reader,
  structure) to him as decisions; never spend questions on his private test
  data.
- **Next:** his review of the article, then recording scripts (series line,
  reading gate, read-back) and the Teleprompter send. No sends, posts or
  spending; Monday's no-spend hold remains.
