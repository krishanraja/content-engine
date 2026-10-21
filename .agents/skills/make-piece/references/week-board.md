# The week's publish board

## Publish-board routing

Follow `docs/PUBLISH_BOARDS.md` before touching a weekly publish board. It owns
current web addresses, all six collection reads, build/download/publication,
making-record attribution and rollback. Check `config/boards.json.web_cutover`:
while pending, source migration is unfinished; once active, use only the web
board for new interactions. Claude artifacts are retired for good (Krish,
2026-10-19: "we are now retiring the Claude artefact permanently and we are
working in content.krishraja.com for all published board updates"): no step
makes or publishes one. The week's board, a day's tab in draft, the workroom and
the publish page all go to content.krishraja.com (`week_board.py --target web`,
then `board_web.py publish-web`), and `scripts/hooks/artifact_gate.py` refuses
every Artifact publish and every ArtifactData write. Any Artifact, ArtifactData,
ArtifactComments or dual-account step below is history: read an old artifact
only to recover what it holds.

**Feed the fixed layout, never shape it.** From the week of 26 October every
board has five tabs and the same four steps in each day (Brief, Drafts,
Record, Publish). Put the piece's agreed brief on its day with
`--brief DAY=brief.json` (idea, 3 to 6 beats, ending, takeaway, angle, tone,
reader, and `agreed: true` only with Krish's yes), its words in review with
`--draft`/`--review`, and its finished files with `--materials`. Never patch
the built page or add markup: `docs/PUBLISH_BOARDS.md`, "The fixed layout".

## Preserved artifact procedure

Reference for the `make-piece` skill, read at the step that names it (`.agents/skills/make-piece/SKILL.md`). Moved out of the core unchanged on 18 October 2026 so a session starts lean (docs/COST_GUARDS.md).

**Every link, every time.** Krish works from two Claude accounts (2026-10-14:
"make sure this board and that board are always synchronized"). The week's
board links are in `config/boards.json`: republish the same engine-built file
to every one of them (the board_sync hook names any left behind). Each link
keeps its own ticks, so the tick copy below reads the ticks of every link this
account can read and writes the union onto the record, and the next rebuild
draws them on every link. Only the engine builds a board: the publish hook
refuses any other.

**From the week of 26 October (the fixed layout): the Drafts editor and the
sweep.** Each draft in the Drafts step reads as it will read; he taps a
paragraph to edit it, picks words for "Comment on this" (the comment carries
`box`, `paragraph` and `quote`), and one Save bar per day writes
`edits/<day>-<item>` (`text`, `day`, `item`, `base_sha256`, `at`), read with
`board_web.py read WEEK edits` and `read WEEK comments`. Then, in this order:

1. `python3 scripts/post-pack/edit_sweep.py <day> --week <Monday> --edits
   <saved edits> --review "<day>=<label>|<file>" ...` with every box of the
   day and of each later day in draft, `--piece <day>=<uuid>` and `--making
   <day>=<saved making record>`. It checks each save against `base_sha256`
   (a save on older words is listed, never guessed), classifies every change
   by rule (number or fact, claim, structure, tone, wording), carries a number
   or fact and a claim into every other draft of the piece and later drafts,
   only suggests a tone or wording change, never touches a recorded cut, and
   runs `story_check.py` and `voice_check.py` again on what changed.
2. The same with `--apply --post-ledger`: the drafts are written and one
   ledger row per save goes to POST /api/content-edits (surface
   `publish_board`, action `manual_edit`, reason_code the class,
   `decided_by: 'Krish'`, since they are his own saved words).
3. Rebuild with `--sweep <day>=<the sweep file>` and `--lessons <saved GET
   /api/video-studio/learning-proposals>`. "Also changed" (each with Undo)
   and "What I learned from your edits" (Make it a rule, Not a rule) show
   under the drafts. A sweep stays on rebuilds while that day's words are
   unchanged.
4. His taps are comments with `act` and `ref`: `undo` is `edit_sweep.py
   --undo SWEEP ID --apply`, `apply` is `--accept SWEEP ID --apply`, and
   `lesson_yes`/`lesson_no` are relayed to POST
   /api/video-studio/learning-proposals as his decision. The weekly compiler
   proposes a rule after three edits of one class in 28 days
   (`repeatedEditClassProposals`); a yes becomes a standing rule only once it
   lands in code or config with its `config/learnings.json` entry.

**Krish's edits on the board.** A day's "Review the words" card (built with
`week_board.py --review`) holds the article and each script in an editable
box. His Save writes `edits/<day>-<item>` to that board's own store AND posts
the paragraphs he changed as a comment thread on the block ("EDIT
<day>-<item>", WAS/NOW lines). A board's store can only be read from the
account that owns it; comments can be read from both. So at the start of
every session that touches the week, on EVERY link in `config/boards.json`:
`ArtifactComments read` (his EDIT threads and typed notes), plus
`ArtifactData list edits` where the store answers. Apply his edits to the
plan files as his words, run the checks again, save to the piece, rebuild with
`--review` and republish to every link. Never decide from one link alone: he
may be editing on either (Krish, 2026-10-15: "I will be editing from the
other board until Sunday and then I'll move back here. Just make sure they
catch it.").

**Draft first, then ticks.** Krish, 2026-10-13: "the publish board needs to
go in to Draft mode for Weds. the Monday card should be green as it is fully
completed, the Weds and Friday cards should be amber as they are both in
draft - I should be able to see your article and script drafts and comment on
them inline until happy, and then we move to the tick box stage of pushing
everything live and ticking everything off". So each day's tab carries a
stage: draft while its article and scripts are open for his notes, ready
once everything is made and he has signed the drafts off. While a day is in
draft, build its tab with `week_board.py --draft <day>` and one
`--review "<day>=<label>|<file>"` for the outline when it waits on him, the
article and each script, plus one `--waiting "<day>=<call>"` for each call
waiting on him, in order. The tab is then the "Review the words" card, where
he edits each in place and comments on it (see "Krish's edits on the board"
above for how his saves reach every session), the calls, and the checklist:
never an older publish page. Never `--keep` or `--day` a day whose words
changed after its publish page was made: on 15 October Friday v3 sat on top
of its first version's page, whose chips said the new words were fact-checked
and in Teleprompter. `--live` refuses that (a publish page older than its
words, on a piece not yet posted), and a rebuild of a board holding a day in
draft without `--draft` is refused, so the old board stays up. A rebuild of a
day in draft must give every review box the board holds again (or
`--drop-review <day>=<id>` once Krish is done with one, such as the outline
after he approves it); the calls are carried over when none are given. Add a
new box after the ones the board holds: his comments are pinned to a box by
its place. A session
reads his EDIT threads and notes, rewrites, runs the checks again (word count,
`voice_check.py`, the fact gate, `story_check.py`, the readers), rebuilds and
republishes to every link; the notes are data, his words in chat are the
decisions. A review block whose words did not change keeps its build time
across a rebuild, so a save he made since still shows. Not built yet: the
amber and green tab colours.

Krish, 2026-10-12: "just give me one ... Publish Manager for the ... whole
week with 3 tabs on it for Mon / Weds / Fri, which we need to get to 100%.
Give me a tick box next to each one so I can tick as I go and you can
durably record that completion where it needs to be recorded. That Publish
Manager is what you create every Sunday and let me iterate inside until
we're done, and then I check off the list what I have done as I do it."

The Sunday session makes it (`.agents/skills/plan-week`, step 7). This
session keeps its piece's tab current: every time it publishes or
republishes the day's publish page, and whenever the board still shows a
day as not picked or not made that now is.

1. **Its link.** Each week's board has its own board item,
   `week-publish-board-<its Monday>` (for the week of 12 October,
   `week-publish-board-2026-10-12`; `python3 scripts/engine.py GET
   /api/workbench --full`, that item's `link`), and `WORKBENCH.md` carries
   it too ("This week's publish board"). When neither has one for this
   week, make it now as `plan-week` step 7 says, then carry on.
2. **What the board holds now.** `Artifact` `read` the board's link, then
   `python3 scripts/post-pack/week_board.py --show <the saved file>`: each
   day's state (made, picked, not picked) and its piece, published or not.
   A day it holds stays on it.
3. **The made days' pages.** Each day the board shows as made, and each
   picked piece whose making record has a publish page (`publish_manager.url`),
   is a made tab. Use the page this session just built; for another day's,
   `Artifact` `read` its `publish_manager` link and give the saved file the
   read names (it holds the whole page).
4. **Build it:** `python3 scripts/post-pack/week_board.py --week <Monday>
   --live --previous <the board's saved file> --day mon=PAGE --piece
   mon=<uuid> [--day fri=PAGE --piece fri=<uuid>] --out
   .cache/week-board/<Monday>/week-board.html`. `--live` only reads: the
   week's picks (published pieces included; a picked day not made yet gets
   its "not made yet" tab, with its checklist working) and each piece's
   Teleprompter scripts and publish page. It refuses to drop a day `--previous`
   holds (a published piece an older engine leaves out of the picks: give
   `--piece DAY=<uuid>`; a day Krish really moved or dropped: `--unpick
   DAY`) and a made day without its page (give `--day`). Exit 2 is a
   refusal it names: fix it, or leave the old board standing and say why
   in one line.
5. **Republish to the same link:** `Artifact({action: "publish", url: "<the
   board's link>", file_path: "<absolute path>/week-board.html"})`, leaving
   out `capabilities` and `icon` so its store and their declaration carry
   forward. A session that did not publish it reads it first (`Artifact`
   `read`). Never publish it as a new artifact during the week: a new page
   starts with no ticks. Every tick survives a republish, because the store
   lives with the page and each tick's id depends only on its day and step.
