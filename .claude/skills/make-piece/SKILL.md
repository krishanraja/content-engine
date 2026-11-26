---
name: make-piece
description: "Make one piece end to end from the piece id Control Center or the Sunday room sent, starting from the narrative lock Krish signed: the scripts first (each opening straight on the hook and closing on the one thing Krish would do, never a list of orders, held to a reading age of 12 and to what a slow listener can hold, through the kill list and the copy lint, read back by fresh readers, drawn as a storyboard together with the scripts before he records, then put to his Approve scripts press, which sends them to his teleprompter.com account), then the workroom, the article, the fact gate, the visual gate, the publish page and the pack, recording every step on the piece's board row so Control Center shows it live, keeping that day's tab of the week's publish board current, asking him only where config/ve/asks.json allows, and copying Krish's ticks onto the record. Use when a session starts with \"piece_id:\" or when Krish asks to make a piece he picked."
---

# Make a piece

> Video is made with the ve engine (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`); the quick-edit path stays the fallback until ve passes Phase 3.

## Allowed asks

Only the lock, Sign storyboard (with the scripts), the final review and publish (`config/ve/asks.json`; Ruling, Krish, 2026-11-19). Between Sign storyboard and the final review: decide, record `making.py <uuid> final-review KEY "LINE"`, carry on. In full, and over any older line below: `.agents/skills/ve/references/allowed-asks.md`.

## Publish-board routing

Ruling (Krish, 2026-11-11): one live board, in Control Centre. Ruling (Krish, 2026-11-13): the old publish boards are retired for good. The week's
publish board is Control Centre's Content tab (`python3 scripts/post-pack/live_board.py <Monday> [day]` prints its
link), and it draws the week from the engine's `GET /api/board/<Monday>/view` (`docs/PUBLISH_BOARDS.md`, "One live
board"). Update it by writing what the view reads, never a page: the piece's making record (`making.py`), his presses
and his yes (`board_web.py read`, `yes.py`), and the week's plan files (`docs/plans/<Monday>-week/ideas.json`, the
narrative locks, the research) on main or on the week's branch `offday-revise/<Monday>`; when only a file changed,
`python3 scripts/post-pack/board_web.py touch <Monday>` makes the live board read the week again at once. Never build
or publish a board page: the old content.krishraja.com pages, their builder and publisher are gone, and every old
address redirects to the live board. A question for Krish is a press the view carries or an item on his one
list; his approval of scripts is his own words in the session, recorded with `making.py <uuid> read-back CUT
--krish-words` before `teleprompter_send.py`. Claude artifacts stay retired (Krish, 2026-10-19;
`scripts/hooks/artifact_gate.py` refuses them). Do all board work through the records above.

Control Center plans and tracks; Claude Code makes. Krish, 2026-10-10: the
control centre "becomes more of a progress tracker, suggestions compiler, and
ideas generator, which then saves my choices to the durable system and then a
session here picks up that durable system. ... It shouldn't need to matter"
which session. This skill is that pick-up.

The input is one line, `piece_id: <uuid>`, sent by the Sunday room once
Krish signed the piece's narrative lock (`plan-week`, step 11) through one
run of `.github/workflows/make-piece.yml` (Claude Code in GitHub Actions on
his subscription), by a press that dispatches that workflow, or typed by
Krish. Never a routine (Ruling, Krish, 2026-10-29: "FYI, I want zero Claude
routines. No Claude schedules of any kind in this architecture"). In a
GitHub Actions run nobody reads the chat: every question is a press on the
day's tab, and the workflow pushes what you commit. Everything the session learns about the piece comes from the engine
and the repository, never from the chat that started it.

## Report to the board as you work

Report as a board prompt says (`apps/control-plane/api/board/_writeBack.ts`): `get_piece_board` (Control
Center's connector) or `scripts/post-pack/board_session.py <piece_id> show`; then `report_board_session` start,
progress, done or blocked (`board_session.py <piece_id> start|progress|done|blocked "one line" --session <id> --step
<step>`); and file all you make or draw on with `add_piece_material` (`board_session.py <piece_id> add <file or
text>`). A day with no piece is `day:<Monday>/<day>`. Add, never replace. Research is never left in scratch or a chat:
file each research document on the piece as you write it, and when Krish sends a Markdown file, file it on the piece
first. Each is copied into his Research library in Drive. (Ruling, Krish, 2026-11-11)

## From the signed narrative lock (pieces from 9 November)

Krish, 2026-10-28: "Claude interviews me on all three ideas to nail down the
narrative arc, make it really powerful, useful, and fun to consume, and
really find the deeper story beneath the surface story." The Sunday room
does that with him and writes one narrative lock per piece,
`docs/plans/<Monday>-week/narrative-lock-<day>.md`, which he signs once.

- **Read it first:** `python3 scripts/post-pack/making.py <uuid> narrative`.
  Signed, it is this piece's Narrative step, its outline's approval (its
  `## Outline`) and the style recipe's yes (its `## Style recipe`): never
  ask him for those again. The room checked its Answer, The use, His close
  and any test against the research, against the series' recent pieces and
  as an experiment before he signed (`plan-week`, step 10; the Narrative
  row below). The lock's His close is his view in his own words, The use is
  the Monday action, its Facts to check are the facts the scripts and the
  article may state, and its Music bed is the bed. A piece that publishes from 9 November with no
  signed lock: make nothing, report `blocked` on the piece ("Sign the
  narrative lock in the Sunday room") and stop. `making.py scripts` refuses it anyway. The
  backlog before 9 November keeps the Narrative step in the table below.
- **The drafts are dated by the day it publishes**, the lock's `Publishes`
  date: `docs/plans/<that date>-draft-script.md` and `-draft-script-90s.md`.
  The lock's outline is the outline; a separate `<date>-outline.md` is
  needed only for a backlog piece, and one that says something else than
  the lock is refused.
- **Scripts first, the article in the background.** From the lock go
  straight to "The Scripts step": the story, the reading age, the kill list
  and the copy lint, the readers, every fact the scripts state checked
  against its filed source, then the creative direction for each cut, up to
  his Approve scripts press (about 12:30). The workroom, the article, the
  fact gate and the visual gate follow while he reviews and records; they
  never hold the scripts back.
- **A question for Krish before Sign storyboard goes on the live board, never
  into chat.** No one is in this session's chat: report `blocked` on the
  piece with the question itself and your best guess (`board_session.py`),
  or an item on his one list. His answer comes back as a board document
  (`board_web.py read <Monday> comments`, and `edits`, `updated_by` Krish
  only) and is relayed as his words. After it: "Allowed asks".
- **The article's fact sign-off lines go on the final review.** A line the
  fact gate cannot match (`docs/COST_GUARDS.md`, G9) never holds the piece:
  each, as the draft says it with its source, is a final-review line.
- **Never edit a signed lock.** His signature carries the sha256 of the
  words he signed, and `making.py` refuses a lock whose words changed under
  it. When the draft's sections and the lock's outline differ, the draft
  changes, never the lock. Before Sign storyboard, a change to the end
  message, the close, the use, the spine or a section is signed again on the
  day's tab (the drift rule); after it the lock is frozen: drift is fixed
  back to it or is a final-review line.

## Before anything

1. Read `AGENTS.md`, `WORKBENCH.md` and `docs/CONTENT_ENGINE.md` ("Driving it
   from an agent session"), and the rejection floor for every maker this step
   is (`python3 scripts/floor.py --format script`, `--format title`, `--format
   article`, `--format card` ...): what Krish rejected, in his words, and the
   standards nothing may fall beneath (AGENTS.md rule 20). Check the finished
   words and pictures against it before they go to him. Add `--piece <piece>` to
   each floor read and `check_failures.py`, then run `scripts/preflight.py`
   (docs/learning/README.md).
2. Read the piece: `python3 scripts/engine.py GET "/api/content-ideas?id=<uuid>"`
   and where it is: `python3 scripts/post-pack/making.py <uuid> show`. It also
   prints every Yes or Not this he pressed on a rendered cut (the board's Cuts
   tab, `meta.cut_verdicts`): a Not this, in his words, is the brief for the
   next cut of that kind, so it goes into the creative direction and the
   storyboard before anything is rendered again; a Yes means that file is
   right, and it is never remade unless he asks.
3. Record this session on the piece so the board shows it is being made:
   `python3 scripts/post-pack/making.py <uuid> session <this session's https link>`
   (in GitHub Actions, the run's link:
   `$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID`).
4. Copy Krish's ticks from the week's publish board onto the records ("The
   week's ticks", below).
5. See what Teleprompter is missing: `python3
   scripts/post-pack/teleprompter_send.py pending` (with `--week <Monday>`
   for this piece's week when it is further out). It lists each cut of the
   pieces in flight whose current words are not in Teleprompter yet, are
   older there, or whose last send failed, with the `plan` line for each. A
   cut goes there only once Krish's Approve scripts press holds its exact
   words, and the server sends it ("The Teleprompter send", below); a
   session sends a listed cut itself only when his press for those words
   answered `no_key`. A cut with no press waits for it, named on its day's
   tab. **Never make a second folder or a second
   script for a cut.** A cut sent by hand that the record does not hold yet
   (its `making.py <uuid> teleprompter CUT ... --script ...` line is in
   `WORKBENCH.md`) gets that line from `pending`, never a plan line: run it
   exactly as written, then `pending` again. A cut whose last send failed
   less than six hours ago is held back and said; send it again only on
   Krish's go (`pending --retry`) or once its words change.

6. **The board is where the piece is worked, from the first draft.** File the
   outline, the article and each script on the piece as each changes
   (`board_session.py <uuid> add`; the article `--role article`, each script
   `--role script`), so the live board's day shows them and he
   reads and comments there (`docs/PUBLISH_BOARDS.md`). A workroom holds the
   decisions beside it; it never replaces the day's tab (Krish, 2026-10-19:
   "Why have you stopped working in [the board] even though this is the
   third time I've asked you ? We have a protocol.").
7. **His saved edits are carried, written to the ledger, and shown back.**
   Krish, 2026-10-21: "If I make a statistical change or a narrative style
   change in one place, just make sure that those changes propagate and the
   next draft is consistent." When `board_web.py read WEEK edits` holds a
   save for the day newer than the board: `python3
   scripts/post-pack/edit_sweep.py <day> --week <Monday> --edits <saved
   edits> --review ...` (the same `--review` boxes as the build, for this
   day and every later day in draft), `--piece <day>=<uuid>`, and
   `--making <day>=<saved making record>` so a recorded cut is never
   touched. Read what it says, then run it again with `--apply`, and with
   `--post-ledger` to write one row per save to the edit ledger as his
   (surface `publish_board`, his own saved words, `decided_by: 'Krish'`).
   File the sweep file on the piece (`board_session.py <uuid> add`) so the
   live board's day shows what changed. His taps come back as comments with `act` and `ref`: `undo`
   (`edit_sweep.py --undo SWEEP ID --apply`), `apply` (`--accept SWEEP ID
   --apply`), `lesson_yes` and `lesson_no` (relay to POST
   /api/video-studio/learning-proposals with his decision; a yes becomes a
   standing rule only once it lands in code or config with its learning
   entry). A comment he leaves on a lesson is a reword: relay it as
   `decision: 'corrected'` with his exact words as `krish`. Lessons whose
   scope key starts `taste:` come from the taste ledger
   (krishanraja/inspirationhouse): a yes or a reword there needs nothing in
   code, because drafting reads them live from `taste_profile_form`. Only documents Krish wrote are relayed: an edit or a tap whose
   `updated_by` is not `Krish` (the board's access-cookie writer) is never
   carried, written to the ledger or relayed as his; `edit_sweep.py` leaves
   it out and names it, and the board refuses such a write from the
   operator key. A number is carried only where the same noun sits next to
   it or two content words match; anything weaker is a suggestion. On a day
   with recordings a script whose cut cannot be told is left alone. A failed
   gate after the sweep is fixed before the words are filed again.
   `references/week-board.md`, "Krish's edits on the board".

Then do the first step that is not done.

## Who owns what

Krish, 2026-10-11: Claude Code is "the overall place for initial ideation,
article creation and publish board building". So a Claude Code session owns
the steps marked Claude below and never writes the video assets: when the
piece shows Recorded, the cuts are made by `produce-video`
(`.agents/skills/produce-video/SKILL.md`), on Sunday night from 1 November,
and this session's job is done until the video assets are on the record,
after which it finishes the publish board (the publish page with the
finished cuts). Codex makes pictures only (Krish, 2026-10-28: "Visual asset
maker"): never a cut, a caption or a mix. Every step carries
its owner in `GET /api/content-ideas/:id/making`; a step that is not yours is
not yours to write, whatever the chat says. The one stale label is Video
assets, which still says Codex until `MAKING_OWNERS` changes in the engine
and in control-center together: it is `produce-video`'s, run by Claude
Code, never this session's.

## The steps, in order, each recorded as it lands

| Step | Do | Record |
|---|---|---|
| Narrative (before anything is made) | From 9 November this step is the narrative lock Krish signed in the Sunday room ("From the signed narrative lock", above), and nothing more is written here: the three checks this row makes (the end message against the research, against the series' recent pieces, and any test designed as an experiment) ran in the room on its Answer, The use, His close and any test, before he signed (`plan-week`, step 10). A lock that shows they did not goes back to the room, never on. For the backlog: before any workroom, draft, script or visual, the piece has a one-page editorial narrative at `docs/plans/<week>/narrative-<day>.md`, signed by Krish in words (Krish, 2026-10-19: "I want to be crystal clear on the overarching end message and checkpoints of the piece so that we can't randomly go off track and take ages to iterate"; made standing the same day). It holds six parts in plain English a 12-year-old follows: the end message in one sentence; who it is for and the one thing they do differently on Monday; four or five checkpoints, each with a pass test and what Krish signs there; the one picture and the point it carries (VISUAL_EXPLAINS); what is out of scope; and the drift rule. The research starts with the corpus he linked to this piece on the Inspiration page, research he already pulled (Krish, 2026-10-24: a corpus is "for a specific article or a specific content piece"): `select name, drive_file_id, read_as, note_for_claude, facets from inspiration_items where kind = 'corpus' and piece_id = '<piece_id>'`; read each file in Drive (`https://drive.google.com/file/d/<drive_file_id>/view`), and its sources still pass the fact gate like any other. Then read every other card linked to the piece: `python3 scripts/post-pack/making.py <piece_id> clips` (the engine's `GET /api/content-ideas/<id>/routed-clips`). A clip is `show_with_sound` only once his own words saying so are on the record (`making.py <piece_id> clips sound <card_id> --krish-words "Krish, YYYY-MM-DD: his exact words"`, quoted from what he typed on the card or to you, never inferred; Krish, 2026-10-31: "so a new session knows they will need to be referenced with audio on during my video post production"). Watch each one whole with sound, and give it a named slot in the creative direction and the storyboard, at the line it sits under, with its own audio on. A `reference` card is read, never placed unless he asks; a card whose words seem to ask for its sound but have no record is one question to him. The end message is checked against the research before he signs it: a line the evidence does not hold changes there, never later. It is checked against the series' recent pieces too: a takeaway a recent piece already landed is never the end message again, so the new piece says what is new (Krish, 2026-10-26: "we've already done that message takeaway with the Muse versus Grok piece"). A test the piece runs is designed as an experiment before it is run: say what it tests, change one thing only (a matched control, such as the same question with only the country changed), give every tool the same access and settings, write the prompts so they need nothing outside their own words, and write down what will be read from each answer before any answer exists (Krish, 2026-10-23: "I don't think you are really thinking much about how to design a test that yields the experiment needed"). Every later step is held to it: the outline's spine is the end message, and each checkpoint is passed in order. **Drift rule:** any change to the end message, the action or a checkpoint before Sign storyboard is signed again; after it, as above. With no signed narrative, write one and put it to him, and make nothing else. Angle: `docs/DIVERGENT.md` (`map`, `challenge`) | his words added under the narrative as `Signed by Krish: <his words>, <date>`; from 9 November `making.py <uuid> narrative` says signed |
| Workroom | The live board's day is the workroom (decisions, picks, mocks; never a separate page or an artifact) and the place Krish and the session walk through key decisions; it is where the piece is iterated before it goes onto the week's publish board, so it is on brand from its first version: the publish page's own tokens and fonts (`publish_manager.py`: cream `#F4EFE4`, ink `#0C1512`, mint `#7EF0C0`; Anton uppercase headings, Archivo body, IBM Plex Mono labels), never a look of its own (Krish, 2026-10-19: "Are you just using this workroom as the iteration tool before we get this in to [the board]? If so it needs to be on brand.") | `making.py <uuid> workroom <live_board.py <Monday> <day>>` |
| Fact-checked draft | Write the article at 1,000 to 1,400 words, never more (house rule ARTICLE_LENGTH, Krish, 2026-10-12: "moving forward the articles need to be about 30% shorter"; check with `wc -w` before the gate). It climbs the piece's why-ladder (`meta.whys`, `docs/FIVE-WHYS.md`); never a prediction or call (Ruling, Krish, 2026-11-24). It ends with a last section headed "3 things you can do tomorrow" holding exactly three concrete actions that follow from the piece's own checked evidence (house rule THREE_THINGS_TOMORROW, Krish, 2026-10-21: "The articles all need to have a really clear "3 things you can do tomorrow" at the end of every piece too."); that section is not an outline section, and the publish check THREE_THINGS_TOMORROW reads it. Its subscribe asks and written edition: 1c. Then `python3 scripts/post-pack/voice_check.py <article>` until it passes (house rule SOUNDS_LIKE_KRISH, Krish, 2026-10-13: "build the sounds like Krish pass now", then "we need more aggressive anti AI scanning techniques by 10X"; bar 6; the article's "we" counts as the person behind it, as "I" does in a script), then `python3 scripts/post-pack/ai_scan.py <article>` (a language model on this machine; it names the most predictable sentences) until it passes too: rewrite each paragraph or sentence they name in his voice (krish-voice, with the branch for this channel in its `references/voice-profile.md`: a Make Your Mind Up article speaks as the publication, "more like a professional media channel"), never by swapping words to fool a detector. Then read `node scripts/post-pack/voice_score.mjs <article>`, a signal and never a gate: it measures the draft against his own long-form, read live from ai-harness, and names the habits furthest from his; for the publication's "we" treat it as a direction, not a target. Before the fact gate, run the kill list and the copy lint on the article body too (`node vendor/makeyourmindup/kill-list/kill-list.mjs <article>` and `python3 scripts/post-pack/copy_lint.py --applies-to article_body <article>`; the Scripts step, 3b). File verbatim sources, run the fact gate through `scripts/engine.py` (it reads the free pre-check first and refuses a paid run while a stated number is on no filed source: file that source or fix the number, and fix everything a run lists before running it again), fix what it lists (`docs/CONTENT_ENGINE.md` step 10) | the gate writes `meta.fact_check` itself |
| Reader test (every Substack post) | After the fact gate and the figures, a fresh reader with no other context reads the article with its figures in place and scores it out of 10 on Krish's six criteria (house rule READER_TEST; Krish, 2026-11-01: "make those criteria the permanent judging criteria for all future Substack posts"): enjoyable; big picture (at least one plain paragraph on what it means for the reader's business and their job as a manager); investigative; incredibly easy to follow (a busy, non-technical leader reading once; every term explained where it first appears; numbers that look alike told apart); easy to learn from; and visual cues (at least one figure for every two sections, each where its question comes up, readable at a glance, matching the words exactly). In Claude Code start one subagent (the Agent tool, description "Separate reader: reader test"), give it the article and the figure files and the criteria above, and ask for a score per criterion and the exact sentence or figure behind any score under 9. Fix every one, keeping every checked fact, and read it again with a new reader until all six score 9 or more. At most one quip in an article. Draw article figures with `scripts/pages/render_figure.mjs` (house look `figure.css`; it refuses a figure that spills past its frame or its card); a source screenshot and a drawn figure may sit in the same piece; before this test, read `.agents/skills/make-piece/references/article-figures.md` | the scores and the reader's notes in the piece's plan folder, `docs/plans/<date>-<day>/reader-test.md` |
| Visual gate | The cover and thumbnails are drawn here with a working headline so the gate can check them; their words are signed off only after he records (house rule TITLES_AFTER_RECORDING), and they are redrawn then by thumbnail-designer. Real logos, real pages piled up when the piece is about volume, the house cover as the Receipt, never his face (`scripts/post-pack/visual_gate.py`). Keep the plan's facts in the repository: `docs/plans/<plan>/cover-facts.json`, with every logo it draws committed as SVG in `docs/plans/<plan>/logos/` (git keeps no PNG or JPEG) and its paths relative to the facts (`"logos/<file>.svg"`), so any checkout, a home computer included, can draw the artwork. Render the covers and the two video thumbnails (house rule THUMBNAIL_EVERY_SIZE) with the approved cover systems, never freehand (Krish, 26 Nov 2026: "I approve the new cover thumbnail systems, go"): `python3 scripts/covers/make_covers.py docs/plans/<plan> --out <work folder>/out`, with every company the piece names in a row or in `"thumbs": {"strip": [...]}`. Read `docs/ve/cards/library/COVERS-PLAYBOOK.md` and `ART-DIRECTION.md` first. It writes `cover-1200x630.png`, `thumb-wide-1280x720.jpg`, `cover-1080x1920.png`, `thumb-tall-1080x1920.jpg` and `carousel/slide-01.png` with a `covers.json` receipt; set `"cover_set"` in post.json to that receipt. A held receipt names what failed. The old drawer (`scripts/pages/build.py --cover`/`--thumbs`) is retired and runs only with `--legacy`, for an archived piece | `making.py <uuid> visual-gate post.json` |
| Feature (only when Krish calls one) | Only his call adds one (house rule FEATURE): read `.agents/skills/make-piece/references/feature.md` | `story_check.py --cut feature` |
| Style recipe | Before writing the scripts, read the style bank in `config/style-references.json` (`docs/STYLE_REFERENCES.md`). If the piece has a recipe (a signed narrative lock's Style recipe is one, with his yes), apply its opening, structure, breakdown, proof, tone and close modules on top of the base: Krish's house rules, golden lines and verdicts are never overwritten. If not, propose one from the bank (modules he has `liked` first) at the lock. Show him the recipe's camerawork and production modules as one line on the day's publish board before he records | the recipe is in the ledger with his words; the scripts follow it |
| Outline (one spine) | From 9 November the signed lock's Outline is the outline and his signature its approval; `making.py scripts` reads it there, and the rest of this row holds for it. Before any script: `docs/plans/<date>-outline.md` states `Spine: <the one question the piece answers>?`, `Answer: <its one-line answer>`, and at most six sections, each `N. <HEADING> \| proves: <the part of the answer it proves>`; shown to Krish, and his words added as `Approved by Krish: <his words>, <date>`. The draft's `## ` headings are exactly those sections, plus the closing "3 things you can do tomorrow" section. A new angle is a new spine and a whole new outline, approved again, never sections added on top (house rule ONE_SPINE; Krish, 2026-10-14: "we ended up with an absolute ton of drift here ... the engine cannot do this again"). `making.py scripts` refuses until the outline and the draft's sections pass (free checks, outlines from 19 October on); the scripts and their Teleprompter send never wait on a paid model call (Krish, 2026-10-26: "This seems like one of the ways in which we just burn API credits when we don't really need to be doing that", then "yes to the fix"). The engine's judge, a paid call, reads every section against the spine once, on the finished article after its voice rewrite: `spine_check.py judge <uuid> --outline <outline>`; `publish-manager` refuses until it passes on the current words | `spine_check.py outline|draft|judge`; `making.py` checks it |
| Scripts | Two scripts, each with its own hook and its own outro (house rule TWO_CUTS, Krish, 2026-10-11; the long cut became 5 minutes on 2026-10-19: "let's make the 3-minute scripts into 5-minute scripts and videos. Scrap the 3-minute format in favor of the 5-minute format."): the 5-minute long cut, 675 to 825 spoken words, 16:9, for Substack and YouTube (up to 1,200 if lifted: "A longer long cut", below); and the short cut, 60 to 90 seconds (160 to 210 words, one story, ONE_STORY_SHORT: Ruling, Krish, 2026-11-17), 9:16, for YouTube Shorts, TikTok and Instagram Reels. Each opens straight on the hook (no series line, no "I'm Krish"), closes on the one thing Krish would do, in his first person and a short beat (never a list of orders; house rule SCRIPT_CLOSE, Ruling, Krish, 2026-10-31: the old close "sounds a bit bossy and preachy") and ends on "The full story is free at makeyourmindup.ai." (Ruling, Krish, 2026-11-14: the voice check wins), is held to a reading age of 12 and to what a slow listener can hold heard once (house rule LISTENING, Ruling, Krish, 2026-10-31: at most 3 figures in the long cut and 1 in the short, about 8 and 4 names, one story, a map up front and a recap before the close), written in the on-camera branch of krish-voice's `references/voice-profile.md` (his natural spoken energy, "I", contractions; Ruling, Krish, 2026-10-31: "Exuberant on camera too"; a voiceover cut follows the article register read aloud until he rules on it) and checked with `node scripts/post-pack/voice_score.mjs <script>` (a signal); before writing it, run `python3 scripts/voice/spoken_rules.py` and apply every read-aloud rule he kept, his wording first, including every word he kept off his scripts (spoken:swap: a swap the script audit, `scripts/voice/script_audit.py`, saw him make in two pieces, between the draft, his approved words and what he said; Krish, 2026-11-18) (they go live the week he keeps them on his list; exit 2 means draft without them and say so); file each script on the piece as a script (the board's Approve shows it, and the audit reads it back as the engine's draft), then three fresh readers hear it, then it goes to Teleprompter: all of it in "The Scripts step", below. On a series day each script says the episode title inside a natural sentence near the start, within its first three beats, marked in the script as the title line, and the ve spec carries it as `title_moment` ({title, line}; `ve lint` refuses a series piece without it from 16 Nov 2026), so production shows that line as the title lockup and the captions step aside for it (Krish, 2026-11-15: the episode title should be "integrated into a sentence seamlessly near the start of the video and the production suite knows that this is the moment to make it feel like the title, instead of regular captions"); never a title line that names nobody (`title_check.py` refuses "they", "it" or "this" standing in for a name). Keep both as the dated drafts beside the plan (`docs/plans/<date>-draft-script.md` and `-draft-script-90s.md`): the matcher and `kit.py` read them there. The Teleprompter state never holds this step back: Copy on the publish page always works | `making.py <uuid> scripts docs/plans/<date>-draft-script.md docs/plans/<date>-draft-script-90s.md`, the long cut first, both required (it checks each with the piece's series); then `making.py <uuid> read-back CUT --readers ...` for each cut; then his Approve scripts press on the day's tab, after which the server sends and records; only after a `no_key` answer, per cut sent, the `teleprompter_send.py record` line `plan` printed, with the ids Teleprompter gave |
| Publish page | `publish_manager.py`: one page with Copy on every text and every picture, filed on the piece, which the live board's day shows | `making.py <uuid> publish-manager <live_board.py <Monday> <day>>` |
| Record (Krish) | Krish records both cuts, each from its own script, reading it from its script in his teleprompter.com account (one folder per piece, one script per cut). Teleprompter holds scripts only. A take comes back one way: he drops the file at the top of the Video Engine Inbox, and the home computers' recordings upload sends it to the engine and places it on its piece and cut by itself (`recording_match.py --record --board --by "Recordings lane"`, every five minutes on either machine). Every take is stamped with the hash of the script it was read from. A take it is unsure of is one board item held in progress for a session, never on his list: nothing he can press answers it, so a session matches it and records a final-review line. The step is done only when both cuts have a take of their current words; a Record tick on the week's board is information only | the recordings lane, or the production session (`.agents/skills/produce-video`): `recording_match.py --record` |
| Titles, headlines and headings (after he records) | Read `.agents/skills/make-piece/references/titles-round.md` before the round; it holds this step in full. Three options per surface, best first, each through the cold read and `copy_lint.py --applies-to titles`. Nothing waits on a Titles press: each surface takes its top-ranked option, never as his pick, as a final-review line; a pick he made stands. Its gates: only once a take is on the record (house rule TITLES_AFTER_RECORDING), lined up with what he said (`narration_diff.py`); from the story first (STORY_FIRST); every packaging line in one round, his one sign-off sheet, before anything that waits on it (SIGN_OFF_FIRST); headings and dividers like a real media channel's, never his transcript pasted (CHANNEL_HEADINGS); `title_check.py` a floor, never the writer; Then the cold read, before anything reaches him: a fresh reader with no context drops any line it cannot explain in one go or calls cheap; and every pick and rejection recorded with his own words | `title_check.py verdict "Title" --picked|--rejected --why "..." --krish "his words" --surface <surface> --piece <uuid>` |
| Video cards | After the titles round (his headings, from his own words in the take): every picture that cuts in while Krish talks is drawn by `scripts/pages/video_card.py cards.json` (beside post.json): brand faces and colours only, a company logo people recognise on every card, a kicker that never uses another series' ground, and nothing clipped or off the card (it refuses to draw otherwise). Look at its `--sheet` before the pack. Krish, 2026-10-13: "there are font consistency issues throughout ... we've not made any use of business logos as we're supposed to" | the cards' file names in post.json |
| Pack | `build.py post.json` then `send.py <pack>` (both record themselves when post.json has `piece_id`). It lands in the post's `3 Posts` folder, the one home for everything ready to post; a Tuesday, Thursday or Saturday piece's folder is `YYYY-MM-DD Ddd off.day - Subject` whatever its series dress. Send it the same day: until it is sent, a home computer has none of the post's pictures for the video kit | automatic |
| Video assets (the Sunday-night run) | Both cuts produced with the logos and the pile-up on screen, every cut opening on its hook with nothing in front of it (house rule HOOK_IS_THE_INTRO; Ruling, Krish, 2026-11-12: "Nothing before the hook, ever. Remove the sting exception for good."; the house sting is retired in `config/intro-sting.json`), the licensed music bed and a thumbnail for each size, filed in the archive and, through the visual gate for videos and thumbnails, in the post's library folder (`3 Video`). It never rebuilds the pack and never writes the Visual gate or Pack steps. Not this session's step: `produce-video` makes them, in its Sunday-night run or when Krish engages it in Claude Code. Codex only makes pictures for them ("Visual asset maker"). Storyboard is his press with the scripts; style is the lock's recipe, the proof a preview, the cuts his at the final review (`docs/PUBLISH_BOARDS.md`, production gates) | `produce-video`: `making.py --by "Claude Code" <uuid> video long "<name>" <path> --thumb <path> --thumb-file <the drawn file> --music <track id>`, with `--thumb` only for a thumbnail actually drawn and filed |
| Publish board (the live board), then posting (Krish) | Once the video assets are on the record, the cuts and their thumbnails are in the post's library folder already. Put them in the publish page; the live board shows them from the record. When this session holds the post's working folder and the finished cut files, also add them to `post.json` (`video` and `thumbnail` entries, each declaring the logos on screen) and rebuild: `build.py --replace` runs the visual gate again and records Visual gate and Pack, then `send.py`. Krish posts in the amplification order (`docs/AMPLIFICATION.md`) and ticks each step on that day's tab of the week's publish board as he goes (or in Control Center). Every session copies his channel ticks onto the record ("The week's ticks", below), or records what he said he posted. The step is done when the standing five are on the record: Substack, YouTube, Shorts, TikTok and Instagram | `making.py <uuid> posted <channel> [https link]`, from his ticks or his words |

`post.json` carries `"piece_id": "<uuid>"` so the pack tools report by
themselves. Nothing in this skill sends, posts or deletes: a market or a post goes only
on Krish's words. A paid fact check spends inside the lock's credit ceiling.

**The Teleprompter send**: his Approve scripts press sends; before any Teleprompter call read `.agents/skills/make-piece/references/teleprompter-send.md` (never `move_script` or `update_folder`; nothing deleted).

## The Scripts step

Do these in order for both cuts; a script that fails any of them is
rewritten and checked again from the top. Below, `long.md` and `short.md`
stand for the dated drafts, `docs/plans/<date>-draft-script.md` and
`docs/plans/<date>-draft-script-90s.md`, dated by the day the piece
publishes: give `making.py` and `teleprompter_send.py` those paths, never
undated names, which `making.py scripts` refuses when no lock names the
piece.

Say the result, never the method. A script says what was tested, what
happened, who won and what it means. Limits, weighting, dates and where each
source came from belong in the article's footnote and the scorecard, never
as spoken caveats (Krish, 2026-10-21: "The scripts just need to be catchy,
direct: what was tested, what the result was, which one won, and what that
means."; learning `say-the-result-not-the-method`).
What people think, in one breath: community and press reviews are cited by name in the article only; in the
scripts and carousels they are the general mood, never named posts or a run of reviewers (Krish, 2026-10-26: "happy
to cite Reddit etc in the article, but there is no need to verbal diahorrea in the carousels and videos, just use this
as seed for what people in general think of it without being too specific"; learning `mood-not-citations`).
Score in plain words: win, lose or draw, never a sports or betting label
such as "a split" (Krish, 2026-10-21: "what does \"a split\" mean? I have no
idea"; learning `plain-score-words`). Then give it dry wit: short, deadpan asides that tease what really
happened, in the manner of Hannah Fry, never at a real person's expense and
never inventing a fact for the joke (Krish, 2026-10-21: "Bit of dry wit and
hannah fry sarcasm too"; learning `dry-wit`). A joke he has to decode is cut, a little cheeky is fine, and the line that carries the
point must hit hard (Krish, 2026-10-23, marking five asides: "Three and four are pretty funny. Number one could be
even a tiny bit crude, if you want. I don't understand number two at all, and number five needs to hit harder";
learning `wit-he-marked`). Before writing the beat where he gives his view, ask him for it in his own words,
one question, and build the beat from them (learning `his-call-in-his-words`). From 9 November his words are the
signed lock's His close; with no lock, the question goes on the day's tab.

**A longer long cut** (TWO_CUTS; Ruling, Krish, 2026-11-14: "lift if worth it"): only through `config/long-cuts.json`;
read `.agents/skills/make-piece/references/long-cut.md`.

1. **Write each script opening straight on the hook and closing on its last line.**
   Krish, 2026-10-21: "we need to cut that opening line from every content
   piece moving forward and just launch straight in to "I put GrokBot and
   Muse head to head" etc. ... That needs to be the format moving forward for
   all scripts." Then, 2026-10-31: "the last paragraph of all my scripts still
   sounds a bit bossy and preachy", and "Yes, replace it". Then, of the old
   last line failing the voice check (2026-11-14): "stick to voice check". So
   there is no series line before the hook and no "I'm Krish"
   anywhere (house rule SERIES_OPENER, retired as a requirement; the old
   lines stay in `SERIES_OPENERS` in `apps/control-plane/api/_houseRules.ts`
   only for records made under them). The close, after the answer, is one short
   beat of at most three sentences saying the one thing Krish himself would
   do, in his first person ("If I ran a team, I'd do one thing this week.
   I'd write down who my experts will be in five years."), never a list of
   orders and never the retired "Here's what I'd do with this info if I were
   you"; advice for particular people goes in the article. Then the script's final
   sentence, exactly "The full story is free at makeyourmindup.ai." and
   nothing after it: no sign-off, no question for the comments (house rule
   SCRIPT_CLOSE_LINE in `apps/control-plane/api/_houseRules.ts`); a caption
   closing on where to read it says the same. `npm run check:voice-close`
   fails on the old line in any rule, prompt or skill. The tone is observational, witty and positive (house rule
   TONE_OBSERVANT_WITTY, Krish, 2026-10-21: "Generally yes - observational
   and witty and positive are my general go tos").
   The hook is the first sentence, with the topic's keyword in it; his personal line (house rule PERSONAL_INTRO:
   what he's been doing with the thing, why it matters, that he wants to break it down; golden example #1 in
   `config/golden-examples.json`) comes second or third. Spoken words only, the last line at the very end
   (HOOK_AND_CTA). The 2026-11-05 checklist (the first second, the keyword, the four openings, the person it is
   for, captions and the pinned comment under YOUTUBE_PACKAGE) is `.agents/skills/make-piece/references/hook-and-share.md`: read it
   before you write. `story_check.py` refuses a greeting in front of the hook and warns when his line comes first. A script never says
   it was made with AI or with Claude (house rule NO_AI_DISCLOSURE_LINE;
   Krish, 2026-10-12: "Eliminate the "I made this with AI" entirely").
1b. **Write it the way he says it** (house rule SCRIPT_AS_HE_TALKS; Krish, 2026-10-17: "Thats how script should be written in the future"). Measured from his takes (`docs/narration/week-of-12-oct`, the rules in `habits-and-rules.json`): about one sentence in three opens with So, And, But, Now or See; each Why runs straight into its answer ("So why did ...? Because ..."); "no one" and "I reckon"; every fact in one short fixed line; and 160 to 210 words for the short cut. The `spoken-line` entries in `config/golden-examples.json` are his own lines from the takes. Never choppy: he talks in sentences of 10 to 15 words joined with so, and or but, and a script cut into strings of five-word sentences reads robotic on the teleprompter (Krish, 2026-10-23: "the choppy rhythm, sounds robotic"), so join short ones and keep a lone short line for a punchline. `story_check.py` warns on each of these, and on a script that will run long as he says it, from his ledger.
1c. **Audience rules, 16 Nov** (ONE_CONCRETE_THING, FOR_THE_LEADER, FIRST_TWO_SECONDS, ARTICLE_SUBSCRIBE_ASK, WRITTEN_EDITION): `.agents/skills/make-piece/references/audience-rules.md`.
2. **Write it plainly, for a non-technical manager at a medium-sized company** (Krish, 2026-10-19: "My customers are medium sized enterprises. This script is 20% too \"Dumbed down\""; the readers below changed that day, with his "agree on all 4"; the reading gate in `story_check.py` is unchanged). Before that: Krish, 2026-10-12: "I also feel like
   these scripts are too complicated for a layman to understand. Every
   single script should be understandable by a 12-year-old. I can't even
   understand what I'm reading off the teleprompter. I thought we had hard
   gates for this?" (house rule R7, a hard gate on every script). Short
   sentences, everyday words, one idea at a time, no quotation of more than
   four words, and no grown-up word (licensing, settlement, revenue,
   royalties, model, copyright, fair use, valuation and the rest of
   `SCRIPT_READING.jargon` in `apps/control-plane/api/_houseRules.ts`) unless
   the same sentence says what it means in plain words.
2b. **Two takes of one cut** (Krish, 2026-10-23: "Just put the first-person and the voiceover version in the one
   script box in the publish board for each video length"): when he records an on-camera and a voiceover take, keep
   one file per cut holding both, each starting on its own line `=== TAKE <n>: <what it is> ===`. `story_check.py`
   checks each take as a whole script of the cut, and `teleprompter_send.py` times it by its longest take; he reads
   only the take he is recording.
3. **The mechanical check.** `python3 scripts/post-pack/story_check.py --cut
   long --series <the piece's lane_slot> long.md` and the same with `--cut
   short` for the short script. It refuses a script of a minute or more whose
   close is a list of orders, runs over three sentences, is not in his first
   person or keeps the retired "Here's what I'd do with this info if I were
   you", or that does not end on exactly "The full story is free at
   makeyourmindup.ai." (`--series` is still taken and no longer checked), the wrong length (`--piece` if
   lifted), a
   spoken sentence over 20 words, more than 12 words a sentence on average, a
   reading grade over 6, a quotation over four words, a word on the list
   left unexplained, or more figures or names than a listener can hold
   (house rule LISTENING: 3 figures and about 8 names in the long cut, 1 and
   about 4 in the short; a year is not a figure). The readers then check what
   a rule can't: one story, a map up front ("there are three parts"), the one
   thing to remember said again before the close, and an everyday comparison
   the first time a hard idea comes up. Fix and run it again until both say `ready`.
3a. **Does the wit land** (Krish, 2026-11-17: humour-engine on call, "go ahead on both"). Two floor standards ask
   what a rule cannot grade: never a script left "flat and purely factual", and never "a joke or dry-wit option in a
   script that needs outside explanation to be understood on its own". Run
   `python3 scripts/post-pack/humour_check.py script long.md` and the same for `short.md` (one call each), and
   `humour_check.py joke --file jokes.txt` on the joke options offered beside the script, each read alone. Exit 1:
   rewrite the paragraph or cut the joke it names, then run it again. Exit 2 (unavailable) is never a pass: say so
   where the scripts go to Krish. It judges whether a joke is understood, never whether it is good; that is his.
   `humour_check.py doctor` first in a session that has not used it.
3c. **The teaching check, automatic and silent** (Krish, 2026-11-17: "I really like her teaching style, her fluency
   of speech, how she doesn't talk down to anyone, but how she makes boring things so interesting"; Krish, 2026-11-18:
   "The Hannah Fry skill should invoke automatically but silently behind the scenes"). On every script any session
   writes, for every cut and format: before writing, plan its breakdown on the shape of her Short he chose; after 3 and
   3a pass, a separate reader checks each cut against her eight moves and names the line where curiosity drops. A fail
   is rewritten and read again by a new reader before he sees the words. It never asks him anything, never appears on
   the board or in a message to him, and its file stays in the plan folder. Both steps, the prompt and the file:
   `.agents/skills/hannah-fry/SKILL.md`. His house rules win any clash with her habits; it never holds his own Approve
   scripts press (F49).
3b. **The kill list and the copy lint, before any paid call.** Run both on every script before any paid call; the commands,
   what each refuses and what to do: `.agents/skills/make-piece/references/kill-list-and-copy-lint.md`.
4. **The read-back, required.** Three fresh readers hear each script, every
   time its words change. In Claude Code, start three subagents (the Agent
   tool, description "Separate reader: read-back A", "B" or "C", which the cost
   guard G6 asks for), one for each reader, each given nothing but its prompt below and
   the script's words; this session never reads for them. Elsewhere, three new
   conversations with no other context. Reader A's prompt, word for word:

   ```
   You are a smart, busy manager at a 200-person company in the UK. You run a team and sign off budgets, but you are not technical and have never worked in tech or AI. You hear this video script read aloud once (no rewinding). List every word, phrase or sentence that would genuinely lose you: one you would not understand, that would make you stop following, or that talks down to you. Also list every company, product, title or term you heard named but not explained, even if you could guess. Say "nothing" if nothing lost you. Then retell the whole video in three sentences.
   ```

   Reader B's prompt, word for word:

   ```
   Pretend you run the finance or operations team at a 200-person company. You use AI tools at work but know nothing about how they are built or priced. Someone reads you this video script out loud, once. Which words or sentences would you not understand, would make you lose the thread, or would feel like they talk down to you? List each one exactly as it is said, or say "nothing" if you followed all of it. Then say whether the first two sentences told you why this is about you, or only teased. Then tell the whole video back in three sentences.
   ```

   Reader C, the narrator, word for word (Krish, 2026-10-19, of a line he could not say on camera: "I felt like I couldn't explain what that meant. ... How do we gate that for the next time?"):

   ```
   You are the presenter. You will read this video script aloud to camera, to leaders of medium-sized companies, and a viewer may stop you after any sentence and ask "what does that mean, and why does it matter to me?" Go through it sentence by sentence. List every sentence you could not answer that for in one plain sentence of your own, exactly as it is written, with what is missing: the thing it refers to, the step it skips, or why it matters to the viewer. Also list every comparison that maps the wrong things onto each other, every promise the opening makes that the script does not keep, and any advice at the end that goes further than the evidence given without saying why. Then list every sentence you could not say aloud naturally to camera: one that sounds written rather than spoken, reads like clipped notes, or trips the tongue. Say "nothing" if you could explain and say every sentence. Then retell the whole video in three sentences.
   ```

   A script over length loses a whole beat, never words from every sentence: squeezing each line to fit turns it into notes he cannot say (Krish, 2026-11-09, of a 90-second cut squeezed that way: "It's getting worse and worse and worse"; he cut the medical firm instead).

   Give each the script's spoken words after its prompt; then ask Reader A the two
   questions in `references/hook-and-share.md`. The script passes
   only when all three say "nothing", Reader A says yes and names a person, (A and B lost nothing; C could explain and say every sentence), and every retelling matches the
   script's point: its one question and the answer it gives. Anything
   a reader lists is rewritten in plainer words, then steps 3 and 4 again with
   three new readers. Run the readers before every send, whatever words he uses to say send it: his sign-off records
   his approval and never stands in for them, and `making.py read-back --krish-words` refuses fewer than two readers
   unless his own words say to skip them (`--skip-readers`; Krish, 2026-11-09: "I shouldn't have to keep asking you
   to make sense"; failure F45). A script the engine wrote carries its own readers'
   answers (`read_back` on the script), but the words you will send are read
   back here, whatever the engine said. When rounds of readers keep finding
   smaller things while every retelling matches, put the words to Krish on
   the live board (filed on the piece, `blocked` with the question). His
   sign-off in words is recorded as his, never as the readers'
   "nothing lost": `making.py <uuid> read-back CUT --krish-words "Krish,
   DATE: his words"`, with any readers who did pass it in `--readers`
   (Krish, 2026-10-14: "Fix it in the engine").
5. **Record the check, then the read-back.** `python3
   scripts/post-pack/making.py <uuid> scripts long.md short.md`, the long cut
   first. It runs `story_check.py` on each with the piece's series (the
   engine's `lane_slot`) and records each script's hash and when its words
   last changed. Checking the same words again keeps that time and the
   read-back; a change after Krish has recorded makes his take of that cut
   stop counting (a take of an older script), so say so to him before
   changing words he may have read, and `making.py scripts` then asks him on
   the board whether to use that take. Then record each cut's read-back of
   those same words: `python3 scripts/post-pack/making.py <uuid> read-back
   long --readers "reader A, a fresh Claude Code subagent" "reader B, ..."
   "reader C, ..."`, and the same for `short`. It writes who
   read it, when, "nothing lost" and the hash of the words they heard onto
   the script check; new words need a new read-back.
   **The tone floor (Ruling, Krish, 2026-11-17).** Before writing any
   script, read `config/script-floor/ai-music-long.said.txt`, what he said
   on film: it is the floor for every script, tonally. After the read-back,
   a separate reader (a fresh subagent that did not write it, given only the
   script and that reference) judges it against the qualities in
   `config/script-floor.json`, and `python3 scripts/post-pack/making.py
   <uuid> tone-floor CUT --reader "a fresh subagent" --verdict pass|fail
   --why "one line per quality"` records it on the script check, bound to
   the script's exact words. A fail is rewritten, never argued. The LISTENING
   caps are met by cutting side-stories, never by anonymising names ("a
   firm", "a brand"). Before writing, read `config/script-floor/intros.json`
   and write the intro to its four beats (a named player's surprising fact,
   why it is strange, the viewer's own world, then "Let's..." and the title
   spoken as a question); `story_check.py` refuses a long cut or a lifted
   short cut whose first paragraph misses them (house rule INTRO_PATTERN). `teleprompter_send.py plan` and the board's Approve
   scripts press send nothing without it.
6. **His Approve scripts press, then Teleprompter**, where he reads them
   while he records ("The Teleprompter send", above). The storyboard is drawn
   first (step 7) and filed on the day; with none, the board reminds (Krish,
   2026-11-09: "Remind"). File both scripts on
   the piece and ask for his yes on the live board; where the view carries no
   Approve scripts press, his words approve them ("Publish-board routing").
   His typed approval counts as his press for scripts and for the narrative
   lock, and for nothing else (Ruling (Krish, 2026-11-12): "Scripts and locks only. Typed approval counts for locking a story and approving a script; putting an idea on the publish board still needs your press, so that gate is unchanged."). Carry
   words he typed to this session verbatim with `board_session.py approve
   scripts` (or `approve lock`), as `../plan-week/references/typed-approval.md`
   says: the board shows "Approved in your words" and the server sends the
   scripts to Teleprompter once their checks pass; his own board press sends
   at once and `send.checks` names the checks to run after it and report (F49).
   Never a summary of his words, and never an idea.
   His press and its answer are in the board's `approvals` collection
   (`python3 scripts/post-pack/board_web.py read <Monday> approvals`, the
   collection `config/teleprompter.json` names; `updated_by` Krish only). A
   board that refuses that collection has no press yet: send nothing, and
   say so on the day's tab; he reads the scripts from it. Only when his
   press answered `no_key`, send them yourself, the words he approved and
   no others: `python3
   scripts/post-pack/teleprompter_send.py plan <uuid> long.md short.md`. It
   sends nothing: it refuses unless the check passed, each file holds the
   words it passed and each cut to send was read back, and prints the calls
   in order. Make exactly those calls with the Teleprompter connector:
   `list_folders` and `create_folder` only when the record holds no folder
   for the piece (named "<Ddd D Mon> <series> - <subject>", as "Mon 12 Oct
   follow.the.money - Who gets paid for AI songs"); for a cut never sent,
   `list_scripts_in_folder` and then `create_script` with exactly the
   `title`, `text`, `folderId` and `duration` it printed (titled
   "<Ddd D Mon> - <cut> - <subject>", as "Mon 12 Oct - 5-minute - Who gets
   paid for AI songs"; a script already sent keeps its stored title); for a cut whose words changed, `update_script` of its own script
   with only `id`, `text` and `duration`. A cut whose words Teleprompter
   already holds needs no call. After each script call, run the `record`
   line it printed with the ids Teleprompter gave (uppercase UUIDs). A call
   that fails: once more. Still failing: run the `--error` line it printed
   (with `--folder` once `create_folder` gave one, so no second folder is
   ever made), and put one board item on Krish saying so in plain words
   (`idea_id`). Then `making.py <uuid> show` says, per cut, "Teleprompter,
   5-minute cut: holds the current words".
7. **The creative direction, before he records** (Krish, 2026-10-24: "Once
   the videos are recorded, Claude gets the scripts and the visual creative
   direction locked so that codex can take over on the video production
   ... the copy of the article and what goes in the visuals etc is all
   Claude responsibility"). For every cut sent, write the piece's
   `creative-direction.json` beside its `post.json` (`docs/CREATIVE_DIRECTION.md`):
   `creative_direction.py template` gives one beat per sentence, then
   decide every beat's point, picture, source and on-screen words, in the
   look in `meta.look`, else the style he picked on the Ideas tab (`config/style-references.json`
   `formats`), with the brand reference and the article's visuals. Name
   the piece's one motion system before any beat (`style.motion`, required
   from 9 November; his board pick: `meta.style`): propose one from `creative_direction.py motion
   --points <types> --format <long_video|short_video>` with its `reason`;
   his pick is the lock's recipe (`ve styles` mocks it); the hardest beat
   moving (`ve proof`) is a preview, and the whole cut never waits on it. Name the caption build with it: `brand.captions` (house or
   word) or a caption style, `brand.caption_theme`
   (`config/caption-themes.json`; `art-directed` is his pick, 11 Nov 2026), proved on his take before it ships. On the
   tall cut nothing he must read sits under a platform's buttons and no
   wordmark sits over the content; the engine's layouts hold that, so a
   direction never places words by hand (`docs/ve/MOTION_STANDARD.md`,
   Channels). Its `brand.references` come from the inspiration board by
   card id, never a typed name (`ve init`, `ve refs`: the `ve` skill, step
   6); a Production card Krish ticked comes first there, and the next fitting
   cut uses it (Ruling, Krish, 2026-11-12; `ve/references/board-references.md`). Put `ve expect`'s lines beside the storyboard. Every
   picture adds meaning beyond the words (Krish, 2026-10-29: "They have to
   be additive in meaning. I'm all up for visually clear ideas."): a
   visually clear idea with the real facts on it is welcome, a comparison
   included; a picture that adds nothing beyond the words, or stands in for
   the facts, is not (`docs/production/THE_BAR.md`, quality 2). `check
   --script long=... --script short=...` must pass before he records, and
   the day's Record step says what to capture (each `capture:` source).
   **The storyboard comes before he records, made with the script** (Krish,
   2026-11-09: "I would like to do the storyboard mocks before I record the
   script"): a mock frame per line, beside each cut's script. After he records: line the takes up and re-time that
   storyboard to the real captures onto the day's Brief step, showing both
   lead pictures as stills, the series picture from the brand book and a
   story object, with your pick marked (`creative_direction.py choices`;
   under test, Krish picked: "Choose per piece"). His Sign storyboard press
   goes in `signed` with `creative_direction.py hash` of each script; the
   re-timed storyboard needs no new one, his signature accepts your pick,
   and nothing waits on a tick. Then record the choices under test on the piece:
   `making.py <uuid> choices creative-direction.json`; if he has a cut
   open another way, add `--opening` with what it used, so the making
   record stays the one home for these choices.
   Production renders only from that signed file (kit.py
   and make.py refuse anything else); a change to a script after he signs
   means a new storyboard.

## The week's publish board

Read `.agents/skills/make-piece/references/week-board.md` for the week's ticks store; no session builds or publishes a board page (`docs/PUBLISH_BOARDS.md`).

## The week's ticks

Do this at the start of every session and again before it stops: in this
skill, in `plan-week` and in `produce-video`. The eight steps, and where completion is recorded, are in
`references/week-board.md`, "The week's ticks"; read them there whole before copying a tick.

## Board items about this piece

Read `.agents/skills/make-piece/references/board-items.md` before you write, close or relay any board item about this piece; it holds this section in full (`idea_id`, `closes_on`, what an item on Krish must carry, and which closes are yours).

## Before you stop

**Before a piece goes to Codex, the record must say so.** Run `making.py
PIECE show`: every step up to Recorded (Workroom, Fact-checked draft,
Visual gate, Scripts with both read-backs, Pack in Drive, Recorded) reads
done, recorded by the commands in the table above. Locked files and signed
documents are not the record; `produce-video` stops on an incomplete one,
and Codex must never be asked to fill it in (Krish, 2026-10-24: "This worries
me, does not seem like you did your bit of the job").

**Anything waiting on Krish ("Allowed asks") is put to him as the question itself, never a pointer to it.** Name the decision, give
the words or facts he is deciding on and what each answer does, so he can answer from the message alone; never "X is
still with you" or "the 11 lines" (Krish, 2026-10-27: "Give me any genuine questions you have here as opposed to just
saying "Monday is still with you." I have no idea what that means.").

Copy the week's ticks once more (above). Update `WORKBENCH.md` and the board
(`WORKBENCH.md`, "The board"), and end every reply with
https://controlcenter.krishraja.com/#/home?waiting=1. A link to the week's publish board or one of its days is the live
board in Control Centre, `python3 scripts/post-pack/live_board.py <Monday> <day>` (Ruling, Krish, 2026-11-11);
the old pages at content.krishraja.com/board/<Monday> are retired and redirect to it.
