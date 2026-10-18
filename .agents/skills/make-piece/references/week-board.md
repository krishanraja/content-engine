# The week's publish board

Reference for the `make-piece` skill, read at the step that names it (`.agents/skills/make-piece/SKILL.md`). Moved out of the core unchanged on 18 October 2026 so a session starts lean (docs/COST_GUARDS.md).

**Every link, every time.** Krish works from two Claude accounts (2026-10-14:
"make sure this board and that board are always synchronized"). The week's
board links are in `config/boards.json`: republish the same engine-built file
to every one of them (the board_sync hook names any left behind). Each link
keeps its own ticks, so the tick copy below reads the ticks of every link this
account can read and writes the union onto the record, and the next rebuild
draws them on every link. Only the engine builds a board: the publish hook
refuses any other.

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
