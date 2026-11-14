> **Historical.** The dated notes of 12 to 18 October 2026 from `WORKBENCH.md`'s "This week's publish board" section, moved here verbatim on 13 November 2026 when the old publish boards were retired for good (Ruling, Krish, 2026-11-13). The boards they build, republish and download (`week_board.py`, `board_web.py publish-web`, the two Claude artifacts) are gone; every old board address redirects to the live board in Control Centre. Nothing here describes current behaviour.

## This week's publish board: the dated notes of 12 to 18 October

**18 Oct, evening (same session): Friday's deep cut is being rendered in the cloud.** Krish raised the library cap to
2 GiB, so the 14-minute take (`recordings/ee91ab41...0fd9f.mp4`, 1.1 GB) reached the engine. The 17 and 18 Oct
cards and panels now reach any session (`working.py fetch`, fixed three ways on 18 Oct). Work folder:
`.cache/produce/2026-10-16-904658db` (rebuilds from the engine with the commands in the Friday handover); config
`kit/long.json` is `docs/plans/2026-10-09-friday/long-cut/long.json` plus the story intro and outro. Plan: 13 min
41 s, 51 cues found, licensed bed. When it is done it goes to the library, onto the record and onto both boards.

**session_01RY92XqvcV9kwoDWLBnN8fp (18 Oct, afternoon): Friday is publish-ready.** Article v7
(`docs/plans/2026-10-09-draft-body-v7.md`) carries Krish's edits to the nine lines and says every test result as a
plain comparison (his words on 7 and 8: "vague scores mean nothing to a reader"). One capped paid rerun (13
sentences, about $0.80); 11 lines signed off in his words through the new sign-off step (guard G9, on main); the
fact gate and every blocking publish check pass, including the new PLAIN_SCORES article check. The v7 pack
(publish manager, Substack copy, web page, covers, six charts, the 90-second cut and its thumbnails) is in the
library: `3 Posts/2026-10-16 Fri mind.the.gap - Why so many AIs/`, inputs in `docs/plans/2026-10-09-friday/`
(`post-v7.json`, `manager.json`, `words.json`, `page-facts-v7.json`; the work folder rebuilds from the library
with the commands in `nine-lines.md` and `HANDOVER.md`). Still waiting: the 14-minute long cut, which Krish
renders on his PC (Codex, `produce-video`, `docs/plans/2026-10-09-friday/long-cut/long.json`; his pick, 18 Oct:
"Merge; I render on PC"). The source links inside the article (54 listed, none linked from a phrase) are still
open from 18 Oct. Both board links hold the same build (H6qK version 17, RjLH version 41, 18 Oct): Monday and
Wednesday carried over unchanged, Friday made with its publish page; its publish-page link on the record is the
post's Drive folder (`making.py ... publish-manager`), because Krish's machine had not yet written the new page to
Drive. No Friday ticks on H6qK; RjLH's tick store cannot be read from this account.
Then Krish (18 Oct): "there are significant issues with the publish board, not downloading or linking the right
assets. it's not ready for me to use." Fixed and republished (H6qK version 18, RjLH version 42): the six chart cards
had no picture (a size trick that needed a script the board does not run; reverted, charts now 256-colour where no
pixel visibly changes); every file a step names links to its Drive copy (each checked in Friday's folder, same size);
YouTube, Spotify and Substack name the deep cut and say first that it waits on Krish's PC. Tested in a browser on
the board itself: 44 of 44 pictures load, 10 of 10 picture downloads are real PNGs, Copy picture works. The board's
check now refuses a picture with nothing to show (`config/failures.json`, publish-board-empty-pictures).

**Closing session_01YHC9kjnvJEzYDeFDdADLBq (18 Oct).** Three files Krish asked for, all on main and on both board
links (Friday tab, "Review the words"): `docs/COST_GUARDS.md` (the six standing cost rules and guards G1 to G9 to
build), `docs/plans/2026-10-09-friday/nine-lines.md` (the nine fact-check lines for his sign-off) and
`docs/prompts/sunday-ideas-tab.md` (the prompt for the board's Sunday Ideas tab, to run in a fresh session).
Friday's state: `docs/plans/2026-10-09-friday/HANDOVER.md`. Redrawn panels and cards: the library's
`3 Posts/2026-10-16 Fri mind.the.gap - Why so many AIs/3 Video/working 18 Oct/`.


### What the 12 October evening session made permanent (read this first)

All on main; each has its tests.

- **Monday is finished and on the board**: both cuts (3-minute 2:48, 90-second
  1:27) in Drive `3 Posts/2026-10-12 Mon .../3 Video`, with NO CURVES, the
  stand-off story intro and outro, thumbnails, and five covers. Only posting
  is left, and that is his.
- **The production run** (`.github/workflows/produce-day.yml`,
  `scripts/produce_day.py`): by hand only since the 28 Oct ruling (the noon
  schedule is gone), GitHub renders both cuts end to end (his choice: "GitHub
  always renders") from the Run workflow button, and stops red when a gate
  holds a cut. The secret ENGINE_OPERATOR_TOKEN
  is set. A stop writes one board item `videos-<date>` saying what stopped.
  No schedule puts the videos on the board: Krish deleted the publish board
  schedules from both accounts on 19 Oct ("We are not ready for this yet").
  A session links them when he asks (`making.py <piece> drive-link`).
- **Video tool** (`scripts/quick-edit/make.py`): pictures ease in and
  crossfade, the speaker slides aside, no gap flashes the frame behind
  ("the title card flashes up for about 0.1s ... unacceptable"); true peaks
  are limited under -1 dBTP by itself; a story intro of up to 5 s on the
  approved config.
- **Story intro and outro** (`apps/renderer/src/story`, `scripts/quick-edit/
  story_io.py props --plan <plan>` then `render`): the approved stand-off,
  the real wordmark and masthead from `brand.fetch` (never typed), a 6 s
  outro that holds its last card 2 s. Approved in `config/story-intro-outro.json`.
- **Music**: NO CURVES approved in his words; the home computers publish it
  to the library every pass (`music.py publish`); any machine fetches it
  (`music.py fetch`, `GET /api/library/file`). Epidemic's safelist screenshots
  are the licence record; LinkedIn needs no safelisting.
- **Covers**: every pack carries five, each drawn for its place
  (`scripts/pages/build.py --cover`): Substack upload 1200x630, feed
  1200x800, share card 1200x675, square 1080x1080, vertical 1080x1920 for
  Shorts, TikTok and Reels. A pack missing one is refused.
- **Board**: Download waits for the save capability and says why a save
  failed (`week_board/week.js`, `publish_manager.py`).
- **House rules**: ARTICLE_LENGTH (1,000 to 1,400 words: "about 30%
  shorter") and SHARP_PREDICTION (one checkable event on a date, not
  already happening). Open with him: the AI-detection score (93%); his
  answer is awaited on a voice note per piece and which detector flagged it.
- **Pictures in every scheduled video**: a picture too small to read in a
  shape is shown a readable part at a time, cut at its own gaps, crossfading
  (`kit.py legible_pages`, `make.py expand_pages`); a picture as wide as the
  frame within a pixel of the floor goes as it is (he passed exactly that on
  Monday); a cue line he said his own way is still found (`make.py
  find_loose`). Proven on Monday's takes on GitHub on 12 October: every
  picture in both cuts. Wednesday has no made piece or takes yet, so its run
  will stop and say so.

### Resumed 12 October, about 18:00 UTC (session_01YHC9kjnvJEzYDeFDdADLBq)

- Krish's words this session: "Yes I approve that licence track. Feel free
  to tighten it if I stumbled. For now you just take control of this entire
  thing, get the videos produced, and have the publish board ready for me to
  publish absolutely everything, including the videos." Asked whether
  Monday's two videos may go out without the story intro and end card this
  once, he picked "Yes, ship Monday without it". Recorded under
  `exceptions` in `config/story-intro-outro.json`; every other piece still
  waits for the approved design. Monday ships first; Wednesday and Friday
  are his for tomorrow ("publish today ASAP and then work on Wednesday and
  Friday tomorrow").
- The music track approval cannot be written yet: `music.py approve` refuses
  NO CURVES with no licence id, licence file, sha256 or loudness. A home
  computer can measure the file; the Epidemic Sound licence details are his.
  Until then the cuts go without music.
- The board (same link) was republished with Wednesday shown in production
  (working headline from the sources, his two calls) and Monday's blocker.
  This session's account cannot read the board's tick store or open the
  Monday and Friday day pages (both made under another account), so the
  board was edited by hand, not rebuilt with `week_board.py`.
- Krish said "Merge it": the exception is on main. Drive works on both
  home computers (his words); the runner's light was wrong. Board item
  `mon-produce-today`: start Codex on a home computer with "produce
  Monday's video"; that run measures NO CURVES (`music.py add`) and records
  his approval ("Yes I approve that licence track.") before rendering. Both
  cuts get music: LinkedIn is covered without safelisting (Epidemic's
  screen, recorded in the ledger). After the cuts are recorded, a Claude Code
  session adds them to Monday's tab and republishes the board.
- Story intro design: three blind concepts made (stand-off, receipt printer,
  song track); judges split (stand-off v receipt); a tie-break judge was run.
  Files were in that session's scratchpad only.

### "Resume this week's publish board"

Krish closed the 12 October session with: "lets just close this session
out here, I will get another session to pick up exactly from here with the
prompt "resume this weeks publish board"". The goal he set it, his words:
"leave me with the final Publish Board with Monday 100% ready to publish
(post produced video links included), Weds and Fri in production". Where it
stood at about 17:30 UTC: Monday recorded, its produced videos blocked on a
design only he can approve; Wednesday has its workroom and waits on two
calls from him; Friday's scripts are in his Teleprompter and wait on one
call from him, then his recording. A session given that prompt picks up
here, in this order, and ends every reply with
https://controlcenter.krishraja.com/#/board:

1. **Read where it stands.** The three pieces: `python3
   scripts/post-pack/making.py <piece> show` for Monday
   f328382d-71b3-41a7-a221-d8615826f12e, Wednesday
   7554ed4a-560b-4365-b266-ea72abeed7ef and Friday
   904658db-4df2-4537-a0ed-ebe93e081db7. The board: `board_web.py download 2026-10-12 --output FILE`, then `week_board.py
   --show <the saved file>`, then copy his ticks ("The week's ticks" in
   `make-piece`; Monday's two Record ticks are in its store already, written
   on 12 October from his words "the two Monday videos are now in Inbox").
   The waiting list: `python3 scripts/engine.py GET /api/workbench --full`
   (items `wed-muse-calls`, `friday-record`,
   `week-publish-board-2026-10-12`; his replies are in `replies`).
2. **Ask Krish, once, in the chat, the calls that are his**, with the
   board link (Control Center's reply box is retiring, so his answer comes
   in the chat): (a) Wednesday's headline and its go to spend (item
   `wed-muse-calls`, workroom https://claude.ai/artifact/XW7uwdEJbMybpXVh2gjJRu:
   the planned headline "The Opt-In Was Buried in the Onboarding" has no
   source; the supported story is that Muse keeps a page on people who
   never signed up, TIME, 6 October; he says "use it" or gives his own,
   and "go" for the paid draft and fact check); (b) Friday's prediction
   line (item `friday-record`: keep the dated call, by 30 September 2027
   at least two of OpenAI, Anthropic and Google pick the brain for app
   builders by default, 85%, which young readers keep getting lost at, or
   say the broader bet "the list disappears, the app picks for you" in the
   video and leave the exact call to the article; the 12 October session
   recommended the broader bet); (c) the design, once step 3 has one to
   show.
3. **Monday's story intro, audio treatment and outro card** (what stands
   between Monday and its produced videos). Run the process in
   `docs/plans/2026-10-12-story-intro-outro-brief.md`: three blind
   concepts, blind judges, one synthesis, shown to him cold. A first attempt
   was stopped unfinished when the 12 October session closed and nothing
   was kept. Put the design to him in the chat and as an `on_you` item
   (`only_you` `judgment`, `idea_id` Monday's piece, `closes_on` `video`,
   `link` the design). Settle with it, because they decide how the cuts can
   be made: the music track and its levels (the only track in
   `config/music-library.json`, NO CURVES, and the levels are both still
   proposed; `scripts/quick-edit/music.py` records his approval), and the
   90-second cap (Monday's short take is 95 seconds of speech before any
   intro or outro; `produce-video` says tighten only where he stumbled,
   never speed up, and tell him both numbers). Record nothing as approved
   without his own words.
4. **After his approval: build it, then the home computer makes the
   videos.** Record his words in `config/story-intro-outro.json`. Then build
   it in this repository: the story intro and outro as Remotion
   compositions in `apps/renderer`, an approve step that stores his words
   with a hash of the source he saw (as `scripts/quick-edit/intro.py` does
   for the sting; note the sting's own compositions are not registered in
   the renderer yet either, `intro.py status`), `make.py` reading the
   config so a cut gets them, `produce-video` updated, and tests. Commit, merge to main and deploy
   only with his go in that session (a home computer pulls main). Then
   Krish starts Codex on a home computer with "produce Monday's video"
   (`produce-video`); a cloud session cannot render (`docs/ENGINE_SESSION.md`).
   Codex records the cuts (`making.py --by Codex <piece> video ...`). Then a
   Claude Code session puts the cuts and their thumbnails on Monday's
   publish page (https://claude.ai/artifact/QpGeGjaqZwvyXwRnSadqyS),
   republishes it to its link, rebuilds the board and republishes it to its
   link (command below). Monday is 100% when he has posted the standing
   five; that part is his.
5. **Friday, on his answer.** Rewrite `docs/plans/2026-10-09-draft-script.md`
   and `-90s.md`; `story_check.py --cut long|short --series mind_the_gap`
   until ready; two fresh readers (the prompts in `make-piece`, "The
   Scripts step") until both find nothing that loses them; `making.py
   <piece> scripts long.md short.md`; then `making.py <piece> read-back long`
   and `short` with the readers' answers; then `teleprompter_send.py plan`
   and `update_script` in place (folder
   DD28154B-B6D1-47DB-803A-79410D83196D; 3-minute script
   185F739E-733F-43B9-B5B2-66846CB5EC44, 90-second
   1165370C-68A6-444E-88D5-A326A131E58C) and the record lines it prints.
   Then Friday's page (https://claude.ai/artifact/SHPLKcPPVDkg3j4Yy7vUVV)
   and the board. With the post's working folder at hand, rebuild the page
   with `publish_manager.py`; without it (a cloud session), edit it as the
   12 October session did: the scripts are the `<pre class="txt"
   id="c13">` (3-minute) and `id="c14"` (90-second) blocks, the words
   HTML-escaped in both `data-raw` and the text, checked to round-trip, and
   the chip "Waiting: your call on the prediction line, then recording"
   replaced.
6. **Wednesday, on his answer.** Its routine session
   (session_01FzzvZdb6pALs4La91JrMJb, https://claude.ai/code/session_01FzzvZdb6pALs4La91JrMJb)
   finished the Workroom and stopped at 16:56 UTC, waiting on him; its
   notes are its entry under "Latest handoff". On his words, either carry
   Wednesday on in this session (`make-piece`: draft, fact gate, visual
   gate, scripts with the under.the.hood line, read-back, Teleprompter,
   publish page, board) or start one `make-piece.yml` run with `piece_id:
   7554ed4a-560b-4365-b266-ea72abeed7ef`; never a routine (29 Oct). Never
   both.
7. **Read-backs already behind us.** No cut, Monday's or Friday's, has a
   two-reader pass on record, whatever the 16:45 entry below says ("each
   cut passed `story_check.py` and two fresh 12-year-old readers": they
   passed `story_check.py`; the strict readers still lost the thread in
   places). Monday's takes are recorded, so leave Monday's words alone and
   record no pass for them; Friday's get theirs in step 5.
8. **Retired 29 Oct:** the "Plan the week" and "Make a piece" routines
   (zero Claude routines, top of this file). Still open with him: the second sting design
   (https://claude.ai/artifact/FnDVNoCk1CqxGKTHRYENKH, which the story
   intro may absorb; step 3), and Library Sync on the backup computer.

What a session may do without asking, and what needs his go in that
session (`AGENTS.md`, "Authority"): his standing words cover the
Teleprompter send (on the terms above), and the making work `make-piece`
gives Claude covers republishing his private day pages and the week's
board to their own links, making-record lines and board items. A paid
draft or fact check, a merge or deploy, and anything that sends, posts,
spends, deletes or changes a permission needs his words immediately
before it.

The board keeps itself current (the live overlay, `docs/PUBLISH_BOARDS.md`); rebuild it
only for new words, assets or a new day, with `board_web.py read` for the board as last
published as `--previous`, then `board_web.py publish-web` (every tick stays with the week). In a cloud session `CLAUDE_CODE_REMOTE=1` lets the engine
reads through with the environment's key (`scripts/engine.py`); on a home
computer leave it off:

    CLAUDE_CODE_REMOTE=1 python3 scripts/post-pack/week_board.py --week 2026-10-12 --live \
      --previous <the board as Artifact read saved it> \
      --day mon=<Monday's page> --day fri=<Friday's page> [--day wed=<Wednesday's page>] \
      --out .cache/week-board/2026-10-12/week-board.html

With `--live` each day's piece and each cut's Teleprompter script come from
the engine, so `--piece` and `--teleprompter` are not needed (the second
takes a file when used). Check the built page for each day's current
opening line before publishing.
