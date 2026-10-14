# Workbench: where we are and what's next

This is the one file every working session reads first and updates last,
whatever tool it runs in: Claude Code (web, desktop or phone), Codex (cloud or
desktop), or anything else that can open this repository. It is how work moves
from one tool to another without anything getting lost. The rules for agents
are in `AGENTS.md`; this file is the live state of the work.

Last updated: 2026-10-13, about 19:40 UTC, by a Claude Code session (cloud); the `manual` refusal (step 3 PR 6, second half) is on branch `ccr-25d9e81a-manual-refusal`, live once merged (Latest handoff); step 4 (one done-check sweep) is live.

## How Krish wants to be worked with

- **Every title earns the click, from the piece, never from nothing** (house
  rule TITLE_EARNS_THE_CLICK; `scripts/post-pack/title_check.py`). No straw
  man ("Muse isn't ChatGPT", "X vs Y isn't a fair fight"), no bare topic
  ("Three kinds of AI"), no stock phrase; name who did what or give the
  surprising number, from the checked piece. The card tool, publish page,
  cover drawer and story intro all refuse what it refuses. Krish,
  2026-10-14: "We need an anti-dumb filter ... this sort of crap cannot be
  allowed to pass in the future, ever". He liked "Muse's real rival: Siri."
  **Titles go to him as options first, and nothing is made from a title he
  has not picked** (make-piece "Titles (Krish picks)"; config/title-verdicts.json
  holds every verdict and what it teaches; `title_check.py lessons`). Krish,
  2026-10-14: "Stop ... generating assets ... when I haven't actually
  approved your new approach ... iterate, and understand what I actually
  like, and then encode that into the system forever."
- **Every day on the publish board is built the same way, by the engine.**
  Each made day is its own `publish_manager.py` page (Copy on every word and
  picture), and the board is `week_board.py` over those pages, republished
  to its own link. Never lay a hand-written script over the board (a
  scratchpad "draft mode" did on 2026-10-13 and stripped Wednesday's and
  Friday's Copy cards; Krish, 2026-10-14: "why are Wednesday and Friday
  built differently to Monday? ... I thought I didn't need to keep telling
  you this sort of stuff?"). A day whose page link is lost is carried over
  with `week_board.py --keep DAY --previous <the board as read>`.
- Plain words. Nothing he reads may contain codes, labels, hashes, version
  numbers or project shorthand. Say what happened, what it means for him, and
  what you need from him. If a sentence would confuse someone outside the
  project, rewrite it.
- After everything you do, update the board (below), and end every reply to
  him with the link to what waits on him:
  https://controlcenter.krishraja.com/#/home?waiting=1. Update this file when
  how the work is done changes.
- Make the call and say what you assumed. Ask only when the answer changes the
  shape of the work, and offer your best guess with the question.
- Every visual, interactive or animation must make one critical point of the
  piece land faster than the words can, from its checked evidence. No
  gimmicks (`AGENTS.md`, house rule `VISUAL_EXPLAINS`).
- His decisions are his alone. Record one only when he made it in words, with
  `decided_by: 'Krish'` (`AGENTS.md`).
- Pick subjects people find fascinating and aspirational, like AI content
  creation. Leave out the dull enterprise ones. His words, 2026-10-06, turning
  down the Salesforce piece: "We need to permanently shift focus away from
  things as boring as this towards things that are more fasincating and
  aspirational, like AI content creation for example". The engine's judges and
  channel briefs do not know this yet (see Latest handoff).
- **Always the big picture, never the small headline.** His words,
  2026-10-09, on the Friday workroom: "We need to always focus on the bigger
  picture, never the one small picture temporary news headline - make sure you
  ALWAYS remember this". A week's headline is evidence inside the bigger
  story, never the story (house rule `BIG_PICTURE`). The session that broke
  it built a whole piece around one report about AI plan value when he had
  asked for "why there are so many models now, and what that actually means".
- Every piece, its video and its posts answer three questions: what it means
  for the consumer, what it means for someone starting or building a
  business, and how the old way is changing, creatively and in who gets paid
  (house rule `THREE_LENSES`). Every visual uses the real logos of the
  companies it names, and the cover and share picture carry Krish's face
  (`LOGOS_AND_FACE`; `scripts/pages` cover facts, `"portrait": true`).
- Every video script opens with its series line, then the hook, and says
  "I'm Krish" only there (house rule `SERIES_OPENER`, Krish, 2026-10-12). And
  an ordinary 12-year-old must follow every script heard once. His words:
  "Every single script should be understandable by a 12-year-old. I can't
  even understand what I'm reading off the teleprompter. I thought we had
  hard gates for this?" (house rule `R7`, now a hard gate: `story_check.py`,
  then two fresh readers; `make-piece`, "The Scripts step").
- Every video, in every format, gets an animated intro made for its own
  story, its audio treatment and an animated outro card. His words,
  2026-10-12: "when the videos come back bear in mind that I want a proper
  animated branded intro to this specific story visually, the audio
  treatment, and then a proper animated outro card. Across all formats, and
  this should be part of the system moving forward." Design comes first and
  is his to approve; until then no cut is finished (house rule
  `STORY_INTRO_OUTRO`, `config/story-intro-outro.json`).
- He reads his scripts in teleprompter.com and drops each take at the top
  of the Video Engine Inbox. His words, 2026-10-12: "Also note that Descript
  is permanently gone, teleprompter.com is permanently in, connected via MCP
  here". Every checked script goes there by itself, one folder per piece
  and one script per cut, updated in place, and nothing there is ever
  deleted (`AGENTS.md`, `config/teleprompter.json`).

- Never hand him a blocker you have not checked is real, and never one a
  session can clear itself. His words, 2026-10-12, after a session relayed
  the runner's "Drive unavailable" light as his to fix: "I find it a bit
  ridiculous that you're bringing me this blocker. I think you've done this
  before and you just eventually realised you're making a mistake so you
  need to fix this." Both home computers had Drive working. The runner's
  `drive_state` light is not proof: check it on the machine before saying
  anything.
- **Any machine makes the videos; nobody is ever sent to a home computer.**
  His words, 2026-10-12: "the audio is literally in the drive connected here
  via MCP and also on Google drive, what the fuck is happening here? record
  this capability of yours so you do not whine about this ever again". What
  every session can do, in the cloud as anywhere:
  - his takes: `python3 scripts/post-pack/recording.py get recordings/<sha>.<ext>`
    (the path is on the piece's making record; the Inbox lane uploads every
    take to the engine within minutes);
  - the licensed music: `python3 scripts/quick-edit/music.py fetch`, then
    `MINDMAKE_MUSIC_ROOT=<the folder it prints>` (both home computers publish
    it to the engine's library every pass, `music.py publish`);
  - a post's pictures: `GET /api/library/file?path=3 Posts/<post>/2 Covers and
    images/<name>` (or the board's own copies);
  - the tools: `pip install faster-whisper==1.2.0 ctranslate2==4.8.1 av==18.1.0
    playwright`, `npm ci`, `MYMU_BROWSER=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`;
  - the story intro and outro: `scripts/quick-edit/story_io.py props --plan
    <plan>` then `render`.
  Then kit.py, make.py, the thumbnails, send.py and making.py as
  `produce-video` says. The midday run (`.github/workflows/produce-day.yml`,
  `scripts/produce_day.py`) does all of it by itself at 12:00 New York on
  Monday, Wednesday and Friday, on GitHub's machine (his choice: "GitHub
  always renders"); its Run workflow button is the one click.
- Epidemic Sound gives no per-track licence number. His safelisted channels
  are the licence record (`config/music-licences/`, screenshot of 12
  October); never ask him for licence details again. LinkedIn and every
  other platform need no safelisting (Epidemic's own screen, second
  screenshot there).

## This week's publish board

One page a week, with a tab for Monday, Wednesday and Friday and a tick for
every step, made each Sunday by `plan-week` and republished to the same link
all week by every session that makes a piece (`make-piece`, "The week's
publish board"). Krish ticks there as he goes; every making session in
Claude Code copies his channel ticks onto the pieces at its start and before
it stops (`make-piece`, "The week's ticks"). Each week's board has its own
board item, `week-publish-board-<its Monday>`, with the same link. Sunday's
run puts the new week's line here and moves this one under "Last week's
publish board", which every session's tick copy still reads until every
day on it is at 100% (Friday's reposts go out at the weekend).

- Week of 12 to 16 October 2026 (board item
  `week-publish-board-2026-10-12`; Monday recorded, waiting on its
  produced video; Wednesday's workroom made, waiting on two calls from
  Krish; Friday made, waiting on his call and his recording):
  https://claude.ai/artifact/RjLHJQi469BAKcvTCgneHV

Last week's publish board: none (the first board was made on 12 October).

### What the 12 October evening session made permanent (read this first)

All on main; each has its tests.

- **Monday is finished and on the board**: both cuts (3-minute 2:48, 90-second
  1:27) in Drive `3 Posts/2026-10-12 Mon .../3 Video`, with NO CURVES, the
  stand-off story intro and outro, thumbnails, and five covers. Only posting
  is left, and that is his.
- **The midday run** (`.github/workflows/produce-day.yml`,
  `scripts/produce_day.py`): Monday, Wednesday and Friday at 12:00 New York,
  GitHub renders both cuts end to end (his choice: "GitHub always renders");
  the Run workflow button is the one click. The secret ENGINE_OPERATOR_TOKEN
  is set. A stop writes one board item `videos-<date>` saying what stopped.
  The routine "Publish board: add the day's videos" (trig_016L3CTo8wQh7WF5hpAwrT3A,
  13:25 New York, Drive and the repo attached by Krish) puts the links on
  the day's tab.
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
   904658db-4df2-4537-a0ed-ebe93e081db7. The board: `Artifact` read
   https://claude.ai/artifact/RjLHJQi469BAKcvTCgneHV, then `week_board.py
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
   publish page, board) or fire the "Make a piece" routine
   (trig_01BNH3a98CuVV9sGW9b56DNJ) with `piece_id:
   7554ed4a-560b-4365-b266-ea72abeed7ef`, quoting his words in the fire
   text. Never both.
7. **Read-backs already behind us.** No cut, Monday's or Friday's, has a
   two-reader pass on record, whatever the 16:45 entry below says ("each
   cut passed `story_check.py` and two fresh 12-year-old readers": they
   passed `story_check.py`; the strict readers still lost the thread in
   places). Monday's takes are recorded, so leave Monday's words alone and
   record no pass for them; Friday's get theirs in step 5.
8. **Only Krish can**: attach the Teleprompter connector to both routines
   ("Plan the week" trig_016PWevC6fzViu6mHpKSAbHM and "Make a piece"
   trig_01BNH3a98CuVV9sGW9b56DNJ) and remove Descript from them, in
   claude.ai; until he does, a routine session stops at the Teleprompter
   send and says so. Still open with him: the second sting design
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

Rebuild the board with every made day's current page (each saved with an
`Artifact` read), the board as last read as `--previous`, then republish it
to its own link, never as a new artifact (the store, with every tick, stays
with the page). In a cloud session `CLAUDE_CODE_REMOTE=1` lets the engine
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

## The board: what is waiting on Krish, in progress and done

The live list lives in the shared database, not in this file. What is
waiting on Krish is his one list on Control Center's Home
(https://controlcenter.krishraja.com/#/home?waiting=1), where he clears, bumps
or purges it; that is the link to give him. The whole board, in progress and
done too, is a log at https://controlcenter.krishraja.com/#/board. Every
session, in Claude Code or Codex, reads and writes it through the engine:

- Read it: `python3 scripts/engine.py GET /api/workbench --full` (`python` on
  Windows).
- Add or change items (up to 50 at once; an existing item changes only the
  fields you send):
  `python3 scripts/engine.py POST /api/workbench @items.json` with
  `{"action": "upsert_items", "client": "codex", "items": [{"id": "p3-record", "lane": "on_you", "rank": 2, "area": "Article 3", "title": "Record both cuts from the scripts", "detail": "...", "only_you": "face", "link": "https://...", "link_label": "Open the scripts", "idea_id": "<the piece's uuid>", "closes_on": "record"}]}`.
  Lanes: `on_you`, `in_progress`, `done`, `archived` (hidden). Ids are
  lowercase words joined by hyphens. Links must start with `https://`.
- Change the headline or the status lights: `{"action": "set_state",
  "headline": "...", "signals": [{"label": "Home computer", "state": "ok",
  "text": "On and ready"}]}` (state is `ok`, `warn`, `bad` or empty).
- **Replies are retired; his words about an item arrive as its `said`
  notes.** Control Center has no reply box any more. What he says about a
  board item comes in through Control Center's one door, and its filer keeps
  it as a note on that item. `GET /api/workbench` returns them on each open
  item as `said: [{ "part_id", "excerpt", "at" }]`, newest first, at most
  10 (a purged note is gone; `said_read: "failed"` means they could not be
  read, and the board still loads). Read an item's `said` notes before you
  work it, and act on them. Never answer them: they are his words to the
  system, not a question to you. Never leave an item waiting for his words:
  an item on him ends when it closes itself or when he clears, bumps or
  purges it on his list, and a question only his words answer is asked in
  your reply to him. The engine
  refuses the reply action (`410 replies_retired`) and an item with a
  `"prompt"` (`400 prompt_retired`; `"prompt": null` clears an old one).
  The replies he wrote before stay in `replies` (`unseen_replies` counts the ones no
  session has acted on; `{"action": "mark_seen", "ids": ["<reply id>"],
  "client": "codex"}` after you act on one). The engine key can never write
  one: a session must never put words in his mouth.

Set `"client"` to `"codex"` or `"claude_code"` so the board says who changed it.
Write every item in plain words: what happened, what it means for him, and what
you need from him.

**Every item says how it ends. Record the fact; the check closes it. Close
only items you hold (`closes_on` `session`).** Krish, 2026-10-11: "I am
happy to Clear(complete)/Bump/Purge things off my lists as I go but the rest
should be automatically done." Step 4 of his operating system is one
done-check sweep in Control Center (`api/_doneChecks.ts`) that ends every
item by its kind. The kinds (`closes_on`), with what each needs:

- a making step (`workroom`, `draft`, `visual_gate`, `scripts`, `pack`,
  `record`, `video`, `publish`) or `published`: the piece's `idea_id`;
- `week_planned`: the week's planning item alone (`week-<its Monday>`);
- `week_published`: the week's publish board alone
  (`week-publish-board-<its Monday>`); the sweep closes it once every
  picked day is at 100% on the record, so no session moves it to done;
- `share_image_changed`: `"close_ref": {"url": "<the post>", "was": "<the
  file id of the share image it shows now>"}`;
- `job_ok`: `"close_ref": {"job": "<the job>", "after": "<a time a clean
  run must be newer than>", "probe": "dry"}`;
- `post_matched` (the watcher's `post-<id>`, with `"close_ref": {"url"}`)
  and `take_placed` (the recordings lane's `take-<sha12>`): machine
  questions, held for a session, never on him;
- `session`: work you hold; you close it, or the sweep lets it go after 7
  untouched days;
- `his_word`: nothing can see it done, so only his Clear ends it, and only
  he puts one on his list (his cookie, his words relayed, or Control
  Center); an agent gets `409 his_word_is_his`.

The engine refuses, by name: an open item, new or edited, from anyone, with
no kind (`400 open_needs_closes_on`); a session closing an item that is not
its own work, that is anything but `closes_on` `session` (`409
check_closes_it`: record the fact and leave it); a session turning an open
item that closes on a check's kind into `session` work, relayed or not,
which would let it close the item next (`409 kind_is_the_checks`; a close
Krish made is relayed as the close itself); a session reopening an item
a check closed (`409 check_closed_it`; only Krish does, by his Undo or his
words relayed); a kind on an open item without what it needs
(`400 close_ref_invalid`); an item whose piece step it can already see done
(`409 already_done`: nothing waits); a close or reopen relayed with
`decided_by: 'Krish'` without his exact words in `"said"` (12 to 287
characters; `400 relayed_close_needs_his_words`), which are kept on the item
as `closed_proof`; and a `closed_proof` from anyone but the sweep (`400
closed_proof_is_the_checks`). The sweep writes as client `done_check`, one
item a call (`400 done_check_one_item`): it only closes an open item that
says how it ends and is not `his_word`, with its proof, recorded as `check:
<kind>` (`409 done_check_only_closes` otherwise, and when another writer
closed it first). A database refusal names its
constraint (`board_write_failed`, `code`, `constraint`). The database holds
the same rules: every open item says how it ends
(`work_board_items_open_says_how_it_ends`), and a trigger
(`only_a_check_or_krish_closes`) lets only Krish, a check with its proof, or
a session on its own work move an item to done or archived. Nothing else in
the engine closes an item (`scripts/check-one-close.ts`, in `npm run
verify`): the making route, the publish watcher, the recordings lane, the
purge and the midday run record what happened, and the sweep closes.

**An item about a piece names the piece, so it closes itself** (Krish,
2026-10-11: items "should really be chalked off automatically when we are
done with a publish flow"). Give it `"idea_id": "<the piece's uuid>"` and
`"closes_on"`: a making step (`workroom`, `draft`, `visual_gate`, `scripts`,
`pack`, `record`, `video`, `publish`) or `published`. Control Center's
done-check sweep closes it once that step is on the piece's making record,
closes every item tied to a piece once its publish step is done (the
standing five ticked: Substack, YouTube, Shorts, TikTok and Instagram;
Krish, 2026-10-11), and lets them go when the piece is dropped, absorbed or
buried. A making write asks the sweep to look at the piece's items at once
(`apps/control-plane/api/_controlCenter.ts`), so an item leaves within
seconds; otherwise the sweep looks every 15 minutes. The Substack post alone
ends only the items whose `closes_on` is `published`, so use `published`
only for an item about the Substack post itself; an item about the reposts
uses `publish`. A piece made before the making record existed (no step a
session wrote, at most the watcher's Substack tick) still ends everything on
the Substack post. The publish watcher (`/api/publish/watch`, hourly) learns
a piece is published from the publication's own archive, so Krish never has
to say so; a post whose title matches no piece becomes one item in progress
for a session (`post_matched`), which closes itself once the post is
recorded on its piece (`making.py <piece id> posted substack <link>`) and
the watcher matches it. A machine question with no piece to end it (an
unmatched post, `post-<id>`, or a take with no piece, `take-<sha12>`) that
no session touches for a week is let go by the sweep. A session that hears
from Krish that something is done relays his words (`decided_by: 'Krish'`
and `"said"`); a session closes by itself only its own work. Never leave an
`in_progress` item behind you: when you stop, it is closed (your own work),
handed on with a kind that says how it ends, or back on him.

**An item waiting on him is ready for his list, or it is not written**
(Krish, 2026-10-11: one list, holding only what he alone can do, what is
prepared, and what says how it closes itself; and "you are just capping
the garbage. Surely we need to not have garbage."). Give every `on_you` item
all three:

- `"only_you"`, why only he can do it: `send`, `post`, `spend`, `delete`,
  `permission`, `credential`, `face` (his face and voice), `login` or
  `judgment` (his call).
- `"link"`, an `https://` link to the prepared thing he acts on (the script,
  the draft, the page), with a short `"link_label"` for its button. A typed
  answer is not a link.
- `"closes_on"` with what its kind needs (above): a piece's step with the
  piece's `"idea_id"`, so the sweep closes it when that step lands; the
  week's planning item (`week-<its Monday>`) with `"week_planned"`, which
  Control Center closes once every day has a piece; the week's publish board
  with `"week_published"`; `"share_image_changed"` or `"job_ok"` with their
  `close_ref`; or `"his_word"`, which only he puts there. Never `session`,
  `post_matched` or `take_placed`. A `judgment` item needs one of these
  closes too.

The engine refuses an `on_you` write that lacks any of them, checked with
what the item already holds, so a partial edit of an item on him counts too
(`lane_if_new` is held to it for a new item): `400` with `on_you_needs_only_you`,
`on_you_needs_link`, `on_you_needs_closes_on`, `on_you_needs_idea_id` or
`on_you_needs_close_ref`, and a
`detail` naming the values allowed. Keep such an item `in_progress` until it
has them. A job only he can do that nothing can see finished (a login, a key
only he can change, an email only he can send) gets a check kind when one can
see it (`share_image_changed`, `job_ok`), else stays `in_progress` with
`session` until he says, in your reply, that it goes on his list as
`his_word`. The database holds the same rule
(`work_board_items_on_you_is_ready`, migration `20261013093000`, rewritten
per kind by `20261022091000`), the
week's close on the week's item alone included: when it is applied, every
item on him that fails it moves to `in_progress`, its detail starting "Held
from your list on <date>: it" and the gates it fails in Control Center's
own words ("does not need you", "is not ready for one press", "does not say
how it closes itself"). The engine's own tools never put a question on him:
nothing he can press answers which take a recording is, or which piece a
post is, so the recordings lane and the publish watcher hold those in
progress for a session, which asks him in its reply. The sweep closes a
take's once the take is on a piece, and lets one go once the lane notes no
waiting piece can be it (`"close_ref": {"no_piece": true}`); it closes a
post's once a piece holds the post; and it lets either go after a week
untouched (above).
`bumped_until` is written by his Bump; leave it alone.

**An item Krish closed himself stays closed** (his Clear or Purge in Control
Center, or a close you relay from his words with `decided_by: 'Krish'`). The
engine key cannot move it back to `on_you` or `in_progress`: the write is
refused with `409 krish_closed_it`. The board keeps who closed an item in
`closed_by`, so your later edits to it (a line in its detail, done to
archived) do not change that. If something new needs him, write a new item.

## Pick up from any tool

Everything that matters lives in two places every tool can reach: this
repository on GitHub (code, rules, this file) and the shared database (the
articles, Krish's decisions, each channel's rules). Nothing important lives
only in a chat.

| Tool | What it can do | What it needs |
|---|---|---|
| Claude Code on the web, desktop or phone | Everything except running the video studio | This repository, and the engine key as a **network secret** in the cloud environment (done 2026-10-09): Bearer, allowed website `content-engine-flame-nu.vercel.app`, path `/api/`. The session's proxy adds the key to every engine request; the container never holds it, and `scripts/engine.py` works with no key set |
| Codex in the cloud | The same | This repository connected, and the same secret in the Codex environment |
| Claude Code or Codex on either Windows home computer | All of the above, plus the video studio (`docs/ENGINE_SESSION.md`) | Run `scripts/engine-key.ps1` once on that machine (the engine key then lives in Windows Credential Manager and the helper reads it from there). Work in Krish's own copy at `C:\Users\krish\dev\content-engine`, where he keeps his repositories, never in the runner's folder (`Documents\MindmakeVideoStudio\runner-source`), which must stay untouched. In Codex, run the engine helper and `git pull` or `git push` outside the sandbox (ask for escalated permissions; Krish approves): Codex's sandbox runs as a separate Windows user that cannot see the key or reach the internet |
| A plain chat (Claude.ai, ChatGPT) with no repository | Talk and plan only | Paste this file in |

To start a session in any of them: read `AGENTS.md`, then this file, then do
the top item that is not waiting on Krish. Before you stop, update this file.

Krish starts a session by pasting this:

> Continue the Mindmake content engine. Read AGENTS.md and WORKBENCH.md, then
> read the board. Tell me in plain words what is waiting on me and what you
> will do next, then do the top thing that is not waiting on me. Update the
> board and WORKBENCH.md before you stop, and end every reply with the link to
> my list.

He may add a line saying what he wants today; that comes first.

Talk to the engine with `python3 scripts/engine.py METHOD PATH [body]`, for
example `python3 scripts/engine.py GET "/api/content-ideas?id=<id>"`. On
Windows the command is `python`, not `python3`. It reads the key from
`ENGINE_OPERATOR_TOKEN`, or on a home computer from Windows Credential
Manager, and never prints it. In Claude Code's cloud it needs neither: the
network secret supplies the key on the way out. When it has no key it says why and what to do;
inside Codex's sandbox on Windows, that means running it again outside the
sandbox with Krish's approval. Never ask Krish to paste the key into a chat.

**Every post's assets go into Krish's asset library the same day.** Krish,
2026-10-06: "I want every single asset in there, permanent and for individual
posts, categorized properly, clear what to use them for, and every new post
gets its own new folder with all assets including the article HTML I can copy
paste, video scripts, etc etc". In any tool: pack each post's launch set
(the page and Substack copy, the cover and pictures, the video script, the
YouTube and Substack words, the finished videos, the LinkedIn post) with
`python3 scripts/post-pack/build.py post.json` and send it with
`python3 scripts/post-pack/send.py <pack folder>` the same day it is made. A
brand kit change goes with `send.py --brand-kit <kit folder or zip>`. Krish's
always-on Windows machine writes them into the makeyourmindup folder on Drive
within about ten minutes. The architecture doc's rule 0a.5 says agents never
write into his Drive; this is his explicit instruction for that one folder,
carried out by his own machine, and it covers that folder only. Details and
the one-time install on his machine: `scripts/post-pack/README.md`.

**A recording Krish drops in the Video Engine Inbox reaches any session.**
Krish, 2026-10-06, after a session told him it could not reach his file:
"figure out how to never make that error again". Fetch it with
`python3 scripts/post-pack/recording.py get "<file name>"` (`--wait 15` for one
he has just dropped; `list` shows what has arrived). Both runner machines send
every finished recording to the engine within about ten minutes, whichever is
online. The Drive connector caps downloads at 10 MB, so never take a recording
from Drive and never tell Krish one cannot be reached; if it is missing, say
which step failed. The lane has run on both machines since 2026-10-06
(`scripts/post-pack/README.md`, "Recordings: from the Inbox to a cloud
session"). Which take is which piece and cut needs no file name:
`python3 scripts/post-pack/recording_match.py` works it out from his opening
words, and the `produce-video` skill takes it from there. The home computers
also place each take on its piece and cut by themselves at the end of every
pass, and a take already on a piece is fetched by the path its record holds
(`recording.py get "recordings/<sha256>.<ext>"`). This is the one way a take
comes back: Teleprompter holds his scripts only, and Descript, which was to
bring takes back, was retired on 12 October.

## Latest handoff

- 2026-10-14, 15:30 UTC: **Wednesday titles: rounds in chat; Siri section added.**
  The hooks research Krish shared is in `docs/research/2026-10-14-viral-hooks-corpus.md`,
  boiled down per surface in `config/hook-playbook.json`; start every title
  round with `title_check.py lessons --surface <surface>`. Picked so far:
  article T1 "I tried Meta's new AI. Amazon's already blocked it.", card A2,
  cover "Muse's real rival: Siri.", YouTube Y2 "Meta's Muse: I break down the
  rival nobody's talking about." (on condition the article proves Siri is a
  real contender). So the article has a new section, "WHY SIRI, OF ALL
  THINGS?" (Apple's 2025 delay, the lawsuit, the Gemini deal, personal
  context, 2.5bn devices, the beta's limits), approved by Krish; fact gate
  passed (48 claims), voice 3.9. Still to pick, one at a time and with nothing
  generated: Shorts title, the other card headings, the prediction card,
  Friday's titles. Then one regeneration pass. Gate note: filing a source
  restarts every check, and a full re-run can flag framing lines it set
  aside before; reword only the flagged lines and re-run without filing.

- 2026-10-14, 12:20 UTC: **Board rebuilt by the engine; Drive videos linked.**
  Every made day on the publish board now has a Finished videos card drawn
  by week_board.py from the piece's video_assets: Download (direct from
  Drive), Open in Drive and Copy link per cut. `making.py <piece> drive-link
  CUT <Drive file link>` records a video's link; the 13:25 New York routine
  (trig_016L3CTo8wQh7WF5hpAwrT3A) now does exactly that and rebuilds the
  board, never hand-editing it. Wednesday's final videos (plate "Three kinds
  of AI", outro question without a yes/no vote, short's 1:11-1:15 restart
  cut) are in Drive: wide 1zSxJUNIzeM_7YvS_-vdLftSN0zOrhbgQ, tall
  1t2vYb1vMFSV5cj94wCuFmzEt96LAhb1J; every frame of both review sheets
  checked. Open: the long cut is -15.2 LUFS (target -14 +-1), flagged by
  make.py but shipped. Friday's publish page is now
  https://claude.ai/artifact/VS5swZnLXVkF8EHnERMp9H (the old one could not
  be read); Friday still needs recording and its video cards.

- 2026-10-14, 11:15 UTC: **Wednesday re-pivoted to three kinds of AI and
  re-recorded.** Krish: "we are comparing apples and oranges"; names chosen:
  Chatbots / Work agents / Ready-made assistants. Outline approved
  ("approved", docs/plans/2026-10-14-outline.md). Prediction A, sharpened
  after the evidence check (DoorDash already in talks with Meta): by end 2027
  a big airline signs a deal so only Muse and Siri sell its tickets. Scripts
  went through ten reader rounds; reader B never said "nothing", so Krish
  read them and signed off ("all looks good"). **Engine fixes:** making.py
  `read-back CUT --krish-words` records his sign-off as "approved by Krish",
  never as "nothing lost" (API validator, tests, make-piece skill);
  produce_day.py reads `edits.json` beside post.json for fixes he calls out
  (short take: restart at 1:11-1:15, {"restart_near": "1:15"}); video_card.py
  has `group` bands and a `columns` kind. Cards: three-kinds, score-side,
  scorecard, score-private, shops (Walmart spark from Brandfetch, Amazon,
  WhatsApp), prediction (Meta + Apple only). Pack rebuilt and sent (subject
  kept "Muse scored against its rivals" so the library folder stays). Run
  38553123315 rendering; review every frame of both review sheets before
  calling it good. Article rewritten: fact gate passed (30 claims), voice
  5.0, AI scan passes. Board not yet updated.

- 2026-10-14: **Next Wednesday (21 Oct) cued.** Krish: "Next week's under the
  hood should include and expand on today's data, but be a follow-up which
  focuses on: Adding Grokbot and any other emerging personal assistant agents,
  using open claw as, the start of this story. Focusing a lot more on what
  people use it for and what it is actually good at compared to what it is
  marketed to be good at and for." Idea d7a20885-7001-4661-b444-9d7ca1043416
  (source week_research: manual is only for words filed through Control
  Center's Say it door), written as under_the_hood's recommended option for
  week 2026-10-19. Sunday's plan-week should keep it first and research it:
  OpenClaw as the opening, Grok's assistant and other new personal agents
  added to the 14 Oct scorecard (`docs/plans/2026-10-14-wednesday/cards.json`),
  marketed-for vs used-for vs good-at from user evidence.

- 2026-10-13, about 19:40 UTC: **`manual` now means his words, enforced**
  (step 3 PR 6, second half; branch `ccr-25d9e81a-manual-refusal`). Control
  Center #444 (retire the other doors) is merged and live: its main no
  longer calls `/api/content-ideas/voice` and writes `source_type: 'manual'`
  only from `api/_sayRun.ts`, always with `source_ref` `said:<said_parts id>`
  (read on its main). Once this merges, `POST /api/content-ideas` refuses a
  `manual` idea without that ref (400 `manual_needs_his_words`; `SAID_REF`
  exported). Migration `20261021100000_manual_is_his_words.sql` (not
  applied; version unused live) adds a NOT VALID CHECK with the same rule,
  exempting the one older manual row by its `source_ref`
  `krish-worked-example-2026-09-23`, not by date (a writer can backdate
  `created_at`). Read live on 2026-10-13: one manual row, and it passes. CI
  replays it twice and refuses a new manual row with no ref and a backdated
  one with no ref, keeps one with `said:` and the exempt ref. Deleted:
  `api/content-ideas/voice.ts` and `api/_whisper.ts`, and the transcription
  guard's exception (`scripts/check-control-plane.ts`). **Next:** after the
  merge, apply the migration by hand and read it back; Step 3 PR 8
  validates the CHECK after 7 days with no `manual_needs_his_words` in the
  engine log.

- 2026-10-13, about 18:30 UTC: **Brief notes have one home** (step 3 PR 7,
  engine half). Cleo's standing brief preferences are now read from Control
  Center's `brief_standing_notes` view: his notes about content, said through
  the one door. `GET /api/briefs/notes` still lists them; `POST` and `DELETE`
  answer 410 `notes_moved`, because Remember this and remove now live in
  Control Center's brief composer. No notes existed in the old
  `system_config` key, so nothing moved. Ships after Control Center's view
  migration is applied; until then the brief reads no notes, as before.

- 2026-10-13, 16:40 UTC: **Step 3 PR 6 (merged as #85), split after
  review: his words reach the board now; the `manual` refusal followed
  once Control Center's other doors were retired** (branch
  `ccr-25d9e81a-manual-his-words`; Control Center's
  `docs/handoff/design-entropy-session/step3-plan.md`, PR 6, merge-order row
  11 of `goal-focus-plan.md`). In this PR: `GET /api/workbench` returns each
  open item's `said` notes (a failed or thrown read leaves the board up,
  `said_read: "failed"`). The shift card's old fallback to `manual` is gone
  (honest sources is live). New guard rules in
  `scripts/check-control-plane.ts`: no transcription call under `apps/` but
  `_whisper.ts`, and no `'manual'` a writer could store outside the allow
  list. **Taken out, on purpose:** the 400 `manual_needs_his_words` refusal
  and the CHECK migration. Control Center main still has two idea doors that
  POST `manual` with no ref: the Week page's "Drop in an idea"
  (`src/components/week/WeekBoard.tsx`) and the Cmd+I capture
  (`src/components/QuickCaptureIdea.tsx`). The plan says PR 6's refusal
  follows PR 4 (risks 10 and 11), which is Control Center #444. A test held
  that order (`tests/control-plane/honest-sources.test.ts`). **Next:** done.
  Control Center #444 is merged and live, and the refusal, its CHECK and the
  deletion of the old idea recorder are on branch
  `ccr-25d9e81a-manual-refusal` (the entry above).

- 2026-10-13, about 15:15 UTC: **The story intro and outro engine fixed on
  Krish's review of Wednesday's video** (fonts, the title running off the
  page, the vertical stand-off, mismatched badges, no business logos). On a
  local branch `fix/story-io-brand-fit-check`, not pushed or merged yet:
  brand faces by role only, the short `video_title` (new in cover-facts.json)
  fitted or the render stops, one badge for both sides with real logos
  (Wednesday: Meta, Instagram and WhatsApp for "Muse, by Meta"; Apple for
  Siri), a logo line-up under the title, and every frame of every render
  checked against the safe areas with a contact sheet per clip
  (`scripts/quick-edit/story_io.py`; `config/story-intro-outro.json`,
  `check`). Monday, Wednesday and Friday all render clean in both shapes.
  Wednesday's videos need re-making with the new clips once it ships; Krish
  has not seen the new design yet.

- 2026-10-13, 14:20 UTC: **Friday re-angled on Krish's thesis** ("models are
  fragmenting right now, and our prediction is that soon, nobody will get a
  choice unless they really want one - and the long tail consequences"). He
  approved the outline ("yes, go"). Article (`docs/plans/2026-10-09-draft-body.md`)
  rewritten: menu history, GPT-5 router, four consequences (money, getting the
  job done, building a business, power), what to do, prediction with no
  percentage (by end 2027 the big AI apps show no model list unless you ask).
  Fact gate passed (22 claims, 0 blocking), voice 5.0, model scan passes. Both
  scripts rewritten after a fresh-listener check (it caught "people love that",
  contradicted by the research), pass story_check, are in Teleprompter retitled
  "Soon you won't pick your AI" and recorded current. The Anthropic "wrong
  tradeoff" quote was cut: no primary source found. story_check now treats a
  word explained once as explained for the rest of the script. **Friday's
  pictures and cover are still the old angle** (pileup, decoder, belt, menu,
  jobs, money, forks): redo them to the new beats before the run. Wednesday:
  videos made by run 38405529804; Krish keeps the ChatGPT ads ad-lib ("it's
  true").

- 2026-10-13, 13:05 UTC: **Wednesday re-angled to a scorecard (Krish: "If I
  went under the hood on Muse, I would literally do flash comparisons of it
  against other tools on different criteria and rate them").** Muse vs
  ChatGPT dots, Gemini Spark, Claude, Siri AI on six criteria, my scores out
  of 10 (in `/tmp` card script, copied to post.json purposes): job, price,
  reach, asks first, private, whose side. Muse 43 and Siri 43 tie, opposite
  reasons. Thesis: shops stop paying to be seen and pay to be picked.
  Prediction with no percentage (Krish: "I'm overall getting sick of these
  percentage predictions"): by end 2027 businesses pay to be the one your AI
  assistant picks. Nine cards in pics/ (score-*.png, chosen, scorecard,
  prediction), all nine cue in the long cut. A fresh-listener subagent read the
  scripts cold first; its fixes are in. Teleprompter retitled "Muse scored
  against its rivals" and recorded current. Video run moved to 16:00 London
  (trig_0189NYVCHupBTnpYS9cVRhAH, 15:00 UTC). **The article still has the old
  angle**: rewrite it to the scorecard before publish, fact gate again (new
  claims: Google ads business, Meta owns Instagram/WhatsApp).

- 2026-10-13, 12:25 UTC: **Krish: "This is the most feedback and correction
  of basic things I've ever given on video scripts... things are just not
  making sense."** His last specifics: no reason given for Muse over Claude;
  "It can live in three places... the company's servers" ("Who is \"the
  company\"? What is \"It\"?"). Rewritten: Muse vs ChatGPT/Claude beat added
  (does the job, free, inside Instagram and WhatsApp), every actor named,
  three options numbered with names; pictures reviews/same-jobs/three-places
  redrawn; both rejections in `config/rejected-lines.json`; PERSONAL_INTRO
  extended. Teleprompter and the record are current. Root cause owned: scripts
  were patched line by line to pass word-count and reading gates, never
  written from an argument he approved. Next: outline-first loop (five-line
  argument he signs off before any script text) and a fresh-listener check
  that must restate each beat and name every "it" / "the company".

- 2026-10-13, Tuesday, 12:20 UTC: **Krish's intro, logged.** He asked for
  sharper intros: "I've been having a little play around with Muse Meta's new
  personal assistant. It's an important evolution in how AI is going to come
  into our personal lives, and so I wanted to break it down for you. Thats
  something I would actually say". Done: both Wednesday scripts open that way
  after the series line (his words, the 21-word line split in two for R7),
  pass story_check, and are in Teleprompter (long 495 words / 198 s, short
  224 / 90 s) and recorded current with --sha. Pictures still cue (long all
  six; short leaves reviews and same-jobs, tolerated). Logged for the future:
  house rule PERSONAL_INTRO (his words in `said`), `config/golden-examples.json`
  (golden example #1, the first piece of the golden-examples loop), a soft
  PERSONAL_INTRO warning in `story_check.py`, the make-piece skill's script
  step. Still to build: the other three approved loops (swap the 12-year-old
  test, no rewrite may be worse, outline first). Friday's scripts don't have
  an intro like this yet. The 14:00 London produce-day run is unchanged.

- 2026-10-13, Tuesday, 12:05 UTC: **Krish: "I need a system that improves,
  not regresses."** His read of the scripts: "still waffle, they dont sound
  like me and I cant read them coherently" ("the companys computers",
  "locked box", "sell what its helper picks", the overcharge opening). Cause,
  owned: the reading gate (R7 word lists, syllables, the two 12-year-old
  readers who have never once said nothing lost them) pushed rewrites into
  baby talk; rules only accumulate; nothing anchors to what he liked; his
  feedback was fixed per instance, never kept. Built and on main:
  `config/rejected-lines.json`, read by `story_check.py`, refusing every line
  he has rejected in any later script. **He approved four more loops, to
  build next** (his picks, all four): (1) golden examples: a script or
  article he calls good is saved and every new draft is compared to them by
  a fresh reader before he sees it; (2) no rewrite may be worse: each edit
  scored against the version before it on clarity, insight and sounding like
  him, and a lower score is refused; (3) swap the 12-year-old test: the two
  readers become advice, and the blocker becomes "would Krish say this out
  loud to a smart friend, and does any line need decoding?" (this changes his
  R7 ruling of 2026-10-12, with his yes today); (4) outline first: the
  six-line thread goes to him before any script is written, and his OK
  locks the angle. Wednesday's scripts were rewritten in plain adult speech
  (servers, encrypted, said once and explained) and are in Teleprompter and
  on main (794a0d6); the GitHub run is at 14:00 London (trig_0189NYVCHupBTnpYS9cVRhAH).

- 2026-10-13, Tuesday, 10:20 UTC: **Wednesday goes to video today.** Krish:
  "GitHub renders, build the pack and merge to main, I will have videos
  recorded in 30 minutes, and the first runner can run at 12PM London time".
  Both scripts were sent to Teleprompter by hand on his standing yes (folder
  666CEBFC-4487-4320-9589-34D094CE4E91; scripts 28E350A4-... long and
  681018D3-... short), recorded with `teleprompter_send.py record`; no
  read-back pass is recorded (his recording now is the sign-off).
  `docs/plans/2026-10-14-wednesday/post.json` with six pictures in `pics/`
  (found beside the plan, so no library pack is needed for the run); the
  long kit cues all six. `produce_day.py`: the 90-second cut leaves out a
  picture it has no beat for (the long cut keeps it), and a day whose two
  cuts are already on the record is skipped (Wednesday's own scheduled run
  tomorrow). On main at 16dcd61. A self check-in (trig_012JUrC3qeyaPWHsatgYCTY7)
  dispatches `produce-day.yml` with date 2026-10-14 at 11:00 UTC. Still to
  do after the videos: the full pack (five covers, publish page) via build.py
  and send.py, and the board's Wednesday tab to green.

- 2026-10-13, Tuesday, about 09:30 UTC: **AI-scan defence, 10x** (Krish: "we
  need more aggressive anti AI scanning techniques by 10X"). `voice_check.py`
  gained a scanner layer (chat-model vocabulary, connective openers, the same
  first word, "This is" openers, ", making it" tails, paired formulas,
  explainer tics, hedging, comfortable-length sentences, no fragments, no
  asides or questions, too few specifics, small vocabulary) and its bar went
  from 12 to 6. Calibration: a machine-written Muse article 52.5, Monday's
  (flagged 93%) 41.4, Friday's 18.2, Wednesday's 0.0. New
  `scripts/post-pack/ai_scan.py`: Qwen2.5-0.5B perplexity plus Binoculars on
  this machine (needs torch and transformers, pip lines in the file), floors
  3.2 and 1.02; Wednesday 4.05 / 1.073, a machine sample 2.31 / 0.996.
  Both gates are in SOUNDS_LIKE_KRISH and make-piece. Wednesday's fact gate
  passed again (38 claims). Friday's article fails both length and voice and
  needs its rewrite.

- 2026-10-13, Tuesday, about 08:30 UTC: **Wednesday re-angled, the tone
  ruling, contractions, and the video run's real state.**
  - Krish on the prediction: "the top one, but make the wording clearer, and
    also Meta will 100% take ads, they are a known ads business. The question
    is deeper than that - it's what happens when a business known for
    harvesting data for ads will do with something like Muse - thats the
    headline". Headline now "Millions handed Meta's Muse their chores. What
    does an ad company do with an agent that runs your life?"; new section
    "What an ad company does with this" (Meta's Q2 2026: $59.36 billion of
    $60.8 billion from advertising, filed from Pulse 2.0); prediction "By 30
    June 2027, Meta will let businesses pay to be the shop, restaurant or
    service that Muse recommends to you", 70%. 1,384 words, voice 0.0, fact
    gate passed (34 claims). Covers redrawn: "Muse runs your life. Meta sells
    ads." Board version 10.
  - New house rule REFLECTIVE_VOICE (his words: "reduce the "breaking news,
    I'm Krish" tone ... Johnny Harris style") and, his pick, the reflective
    series lines: "I've been following how money is changing because of
    AI." / "I've been looking at what's really inside the AI everyone's
    selling us." / "I've been watching what's coming with AI, before everyone
    notices." each then "I'm Krish." Monday's recorded scripts keep their
    words; Friday's two scripts got the new first line, so Teleprompter holds
    the old one until the next send.
  - SOUNDS_LIKE_KRISH now requires contractions and everyday shortcuts
    (his words: "the article MUST not trigger AI written scans either ...
    "you're" instead of "you are""); `voice_check.py` scores stiff,
    uncontracted English outside quotes (self-test 7 checks).
  - **The video run for Wednesday is not ready.** Home runners: active one
    degraded with Drive unavailable; standby silent for about 350 hours;
    Codex has no schedule (it runs when told "I've recorded"). GitHub's
    midday run passed its dry runs on 12 October but has never rendered a
    scheduled day, and for Wednesday it would stop at "no plan carries
    piece_id": Wednesday has no `post.json`, no pack in the library, and its
    files are on this branch only, not main. Also waiting: his sign-off on
    the drafts, then Teleprompter, then his two takes by noon.

- 2026-10-13, Tuesday, about 07:40 UTC: **Wednesday's Muse piece is drafted,
  fact-checked, scripted and has its covers; the read-back and Teleprompter
  wait on Krish.** His words: "a mix of 1 and 3 - 3 will get more readers,
  but 1 is more unique" (headline) and "Go: make Wednesday now".
  - Headline on the piece: "Millions handed Meta's Muse their chores.
    Here's the one thing it does that ChatGPT can't."
  - Article: `docs/plans/2026-10-14-draft-body.md`, 1,294 words,
    `voice_check.py` 3.0 (passes), fact gate passed (39 claims, none
    blocking), 12 verbatim sources filed on the piece. The corpus's "2.8
    million downloads" could not be traced; the piece uses CNN's "more than
    2.5 million" (Sensor Tower). Wired refused the filer (403), so its line was
    replaced with Meta's own help page ("is on when you first use Muse").
    Prediction: Muse Confidential VM reaches free US users by 31 March 2027,
    35%.
  - Scripts: `docs/plans/2026-10-14-draft-script.md` (long) and `-90s.md`,
    both `story_check.py` ready and recorded (`making.py scripts`). Four
    rounds of two fresh readers: every retelling matches the point, but the
    strict reader still lists small snags (some in the fixed series line), so
    **no read-back pass is recorded** and `teleprompter_send.py plan` will
    refuse. Krish decides: send as is, or another rewrite round.
  - Covers: `docs/plans/2026-10-14-wednesday/cover-facts.json` and `logos/`
    (Brandfetch: Muse, Meta, Instagram, WhatsApp; OpenAI and Google from
    Friday). Drawn in this container with `MYMU_BROWSER=/opt/pw-browsers/chromium`
    (Playwright wanted a newer headless shell): all five covers and both
    thumbnails pass their checks. Not yet: visual gate record, publish page,
    pack, board tab.
  - **The board is in draft mode** (Krish: "the Monday card should be green
    as it is fully completed, the Weds and Friday cards should be amber as
    they are both in draft - I should be able to see your article and script
    drafts and comment on them inline until happy, and then we move to the
    tick box stage"). Version 9 of the board: Monday green (Ready), Wednesday
    and Friday amber (Draft), each with its article and both scripts in full
    (numbered paragraphs, ids like `fri-article-7`) and Wednesday's covers;
    Friday's publishing steps folded under "Publishing steps and ticks". Read
    his notes with `ArtifactComments` `read` on the board link (the board's
    data store is closed to this account, and the comment watch could not be
    registered, so he says in chat when he has left notes). Friday is flagged
    on the page: 1,983 words against the 1,400 limit, voice check 15.2.
- 2026-10-13, Tuesday: **Step 3, PR 1: honest sources.** Krish,
  2026-10-13, on the goal-focus mock: "Love it, build it and merge
  everything". This is row 3 of the goal-focus plan's merge order, the step
  3 plan's PR 1 unchanged (Control Center,
  `docs/handoff/design-entropy-session/`). On branch
  `ccr-25d9e81a-step3-honest-sources`, committed; not pushed, not merged,
  the migration not applied. In plain words:
  - **An idea must say where it came from.** `POST /api/content-ideas` used
    to file a missing or unknown source as `manual`, which reads as an idea
    Krish dropped in. Now it refuses it: 400 `source_type_unknown`, with the
    allowed values in `detail`. Every caller found already names its source
    (Control Center's capture and week board send `manual`; plan-week sends
    `week_research`).
  - **Two writers get their own names.** The shift card's "Write from this
    shift" writes `shift_write`. Control Center's pilot builder gets
    `pilot_build`, which its PR 2 starts writing. `lens_radar` is gone from
    the allowed list: it has no source row, so a write of it already failed.
  - **The migration** (`supabase/migrations/20261021080000_honest_sources.sql`)
    adds the `control-center` owner, then the two sources, and checks in
    the same transaction that each sits under its owner and the owner
    foreign key is there. CI's control-plane-sql job now replays it twice
    on a stand-in and checks it refuses both bad cases.
  - **Merge order does not matter now.** Live has no `shift_write` row yet
    (read on 2026-10-13). Until the migration is applied, the shift card
    writes `manual` as before and says `source_pending: shift_write`; a POST
    naming an unapplied source gets 400 `source_type_not_registered`, not a
    500. Still to do by hand: apply the migration and read it back (2 rows
    under their owners; `schema_migrations` has 20261021080000). Then the
    shift card writes `shift_write` with no code change.
  - **Found, not fixed here:** the seed rail still offers lens radar
    candidates (`api/_seedSources.ts`, `lensRadar`); picking one now gets a
    clear 400 instead of a foreign key error. Retire it or give it a source
    row in its own change.

- 2026-10-13, Tuesday, about 06:30 UTC: **Step 4 is live: one done-check
  sweep closes what can be seen done, and nothing else closes a board item.**
  Krish, 2026-10-13: "Go On the backfill, close everything out now to 100%.
  Merge everything to main." In plain words:
  - **Merged and deployed:** this repo's #78 (an item on Krish must be ready
    for his list), #79 (every item says how it ends: `closes_on` kinds,
    `close_ref`, `closed_proof`, the `done_check` client, the backfill
    script, and a drop never undoes a publish) and #80 (the old closers end).
    Control Center's #430 (Sunday's slate never archives the publish board)
    and #431 (the sweep, every 15 minutes).
  - **Migrations applied and recorded:** `20261013093000`, `20261022090000`,
    `20261022091000`, `20261023090000`. Read back: the on-you rule and the
    open-item rule are validated, the one-closer trigger is live, and the
    stale archive spares pieces in the making.
  - **Backfill step 1 ran:** every open item has a kind. The four items held
    off his list (`you-launch-today`, `you-engine-github-key`,
    `week-publish-board-2026-10-12`, `you-welcome-days`) now close by
    themselves once their check sees it, or on his Clear for the welcome
    email.
  - **The sweep's runs at 05:30, 05:45 and 06:00 UTC were clean:** every
    kind answered, nothing closed wrongly, nothing unread.
  - **Backfill step 2 ran, later the same morning:** the four are on his
    list now, each closing by its own check (the welcome email on his
    Clear). Read back on Control Center's `GET /api/act`: all four in
    `items`.
  Waiting on Krish:
  - **Step 3, the voice input:** his first reaction to the rendered mock.
    The plan and mock are in Control Center,
    `docs/handoff/design-entropy-session/`.
  For any session: close only your own `session` work. Anything else ends
  by its check, or by Krish. The route refuses the rest (`check_closes_it`),
  and so does the database.

- 2026-10-13, Tuesday, early: **Step 4, part C: one closer.** Krish,
  2026-10-11: "I think closing what you can check is already done is one of
  the most obvious things I've ever heard of as a suggestion", and "this
  entire session was created to deduplicate and eliminate entropy." On
  branch `ccr-25d9e81a-step4-one-closer`, built on part A's branch
  (`ccr-25d9e81a-step4-kinds`), committed; not pushed, not merged, not
  deployed, the migration not applied, nothing written to the live board.
  In plain words:
  - **The engine closes nothing now.** `_boardClose.ts` is gone. A making
    write asks Control Center's done-check sweep to look at the piece's
    open items at once (`_controlCenter.ts`, the shared access cookie; the
    write waits up to 3 seconds for the ask before it answers, so a tick can
    answer that much slower; a failed ask leaves it to the 15-minute cron). The publish
    watcher still marks pieces published and asks the sweep to look, but
    closes and lets go of nothing. The purge archives no item; it keeps any
    piece an open item names (`kept_for_board`). The recordings lane notes a
    take no piece can be (`"close_ref": {"no_piece": true}`) instead of
    closing it. The midday run writes no item when it succeeds.
  - **A session closes only its own work.** The board route refuses a
    session closing anything but `closes_on` `session` (`409
    check_closes_it`), reopening a check's close (`409 check_closed_it`)
    unless it relays his words, and any open item, new or edited, with no
    kind (`400 open_needs_closes_on`). `make-piece` no longer moves the
    publish board to done; `plan-week` puts next week's publish board on
    his list as `week_published`.
  - **The database holds it too**
    (`supabase/migrations/20261023090000_one_closer.sql`): every open item
    says how it ends, a trigger lets only Krish, a check with its proof, or
    a session on its own work close an item, and the stale archive no longer
    buries a piece in the making. Replayed twice on a scratch Postgres, and
    against five broken copies (four caught; the fifth was the same rule).
  - **A guard stops a second closer** (`scripts/check-one-close.ts`, in
    `npm run verify`): no code closes a board item but the board route, the
    old closers' names stay gone, and the kinds and the session list match
    the database. `npm run skills:validate` holds the board skills to it.
  - **To ship, in this order, and only after Control Center's part B has
    written two clean sweep runs 15 minutes apart and both backfill steps
    have run:** merge and deploy this branch; then apply the migration,
    after checking `select id from work_board_items where lane in
    ('on_you','in_progress') and (closes_on is null or not
    public.board_close_ref_ok(closes_on, close_ref, idea_id, id))` returns
    nothing (on 13 October, 8 in-progress rows had no kind: backfill step
    1 gives them one). Until part B is live, Control Center's slate still
    closes the week's item with its own client, which this branch refuses.
  - **Review fixes, same branch, later on 13 October.** A session could
    still close a check's item in two writes: first make it `session` work,
    then close it. The board route now refuses that (`409
    kind_is_the_checks`), and so does the database trigger (it also fires
    on a change of `closes_on`; replayed twice on a scratch Postgres, and the
    new regression fails on the old trigger). The guard now proves rules 3
    and 4 can fail, catches any write of `closed_by` outside the board route,
    and `skills:validate` proves its board rule can fail before it runs. The
    publish watcher fills an empty `published_url` on a piece already
    published when a session recorded the post on it, so the sweep can end
    that post's question as done. Still open, in Control Center: a piece
    already published under another address keeps it, so its post question
    is let go after a week instead of closed as done, until the sweep's
    `post_matched` check also reads the piece's recorded Substack post.
  - **Next:** part B's own readbacks, the backfill steps, then this branch.

- 2026-10-13, Tuesday, early: **Step 4, part A: every board item says how
  it ends, so one check can end it.** Krish, 2026-10-11: "I am happy to
  Clear(complete)/Bump/Purge things off my lists as I go but the rest should
  be automatically done." On branch `ccr-25d9e81a-step4-kinds`, committed;
  not pushed, not merged, not deployed, no migration applied, nothing written
  to the live board. In plain words:
  - **The kinds.** An item now ends by its kind (`closes_on`): a piece's
    step, the week's two items, a post's share image, an engine job running
    clean, a post or a take a machine could not place, work a session holds,
    or `his_word` for what nothing can see. What a kind needs sits in
    `close_ref`. The rules and refusals are in "The board" above.
  - **The writers changed first**, so nothing later refuses them: the
    publish watcher's post question says `post_matched` and reports a
    refused write instead of dropping it; the recordings lane's take
    questions say `take_placed`, and one tied to a piece still closes when
    that piece's Record step lands (`_boardClose.ts`); `plan-week` writes
    next week's publish board in progress as `week_published`, and
    `make-piece` still moves it to done by hand. Putting the board on his
    list and dropping that hand close wait for the sweep (part C).
  - **The sweep's own client** (`done_check`) may only close an open item
    that says how it ends and is not `his_word`, one item a call, with its
    proof. A close or reopen relayed from him needs his exact words, kept
    on the item. An item whose step is already done is refused. Nothing
    closes differently yet: the old closers still run until part C.
  - **A drop never undoes a publish.** A Purge landing as the publish
    watcher marks the piece published used to undo the publish. The drop
    now reads the piece and writes only if nothing changed; a published
    piece is refused (`409 published_cannot_be_dropped`).
  - **To apply, in this order:** migration
    `supabase/migrations/20261022090000_board_close_columns.sql` before this
    branch deploys (the recordings lane's `take_placed` writes and every new
    column need it); then deploy; then
    `20261022091000_on_you_closes_itself.sql` once the deploy is ready, and
    before Sunday's `plan-week` run, whose publish board item needs it; then
    `ACCESS_CODE=... npx tsx scripts/backfill_closes.ts --dry-run`, read it,
    and run it without `--dry-run`. It never closes anything. The launch
    item's `was` is the share image the launch post shows when the script
    runs (on 13 October the 6 October newsletter showed the Monday
    follow.the.money series card, `4b61bd44-..._1360x1110.png`), so the
    check closes it only once Krish swaps that image. The home computers pull this branch's
    `recording_match.py` only after the deploy.
  - **A review's twelve findings, fixed on the same branch.** The launch
    item's image is read from the launch post itself, never from the post
    before it. The week's publish board and tied take questions close as
    they did until the sweep is live. The sweep may not close a `his_word`
    item or one that does not say how it ends, sends one item a call, and
    a relayed reopen keeps his words. Each has a test that failed first.
  - **Next:** part B in Control Center (the sweep itself), then backfill
    step 2, then part C here (the old closers go, and the database trigger
    lands). The plan is step 4's build plan, sections 3, 4, 6 and 7.

- 2026-10-12, Monday, afternoon: **Nothing can be put on Krish unless it is
  ready for his list.** Krish, 2026-10-11: "you are just capping the
  garbage. Surely we need to not have garbage."
  On branch `ccr-ace11b4d-yjbdcu-refuse-at-write`, committed, with a
  review's twelve findings fixed on top; not merged, not deployed, the
  migration not applied. In plain words:
  - **The engine refuses it.** A board write that leaves an item on him
    without a reason only he can act on, an https link to what he presses,
    and a way it closes itself (its piece and step, or the week's own
    item, `week-<its Monday>`) is refused, naming what is missing
    (`on_you_needs_only_you`, `_link`, `_closes_on` or `_idea_id`), with
    the values allowed. It is checked with what the item already holds, so
    an edit that strips a field counts too, and `lane_if_new` counts for a
    new item. An agent reopening an item Krish closed still hears
    `krish_closed_it` first. Replies are refused outright now
    (`replies_retired`, `prompt_retired`).
  - **The database holds the same rule**
    (`supabase/migrations/20261013093000_board_on_you_is_ready.sql`, to
    apply), the week's close on the week's own item included. It moves the
    four live items that fail it today (`you-launch-today`,
    `you-engine-github-key`, `you-welcome-days`, and this week's publish
    board, `week-publish-board-2026-10-12`, which a session put on him at
    15:19 with no close) to in progress, each starting "Held from your list
    on <date>: it" and the gates it fails in Control Center's own words,
    then checks every row. Proven on a scratch database with seven failing
    shapes, run twice, across New York's midnight, and against five broken
    copies of the rule, each of which the check catches; CI runs it twice.
  - **The engine's own tools never put a question on him.** Nothing he can
    press answers which take a recording is, or which piece a post is, so
    the recordings lane and the publish watcher hold those in progress for
    a session, which asks him in its reply. Each has an end: a take tied to
    its piece closes on Record; the lane closes one with no piece once the
    take is placed or no waiting piece can be it; the watcher closes a
    post's once it matches a piece; and the watcher's hourly pass lets go
    of any of them no session has touched for a week, counted in its
    `let_go`. The purge archives the board items about a row before it
    deletes the row, and now counts them (`board_items_archived`, and
    `board_items_off_his_list` for the ones that were on him).
  - **The skills, AGENTS.md, the cadence and this file** say the same; the
    link to give Krish is his list on Home,
    https://controlcenter.krishraja.com/#/home?waiting=1.
  Waiting on Krish: nothing new. The four held items go back on his list
  only once something can see them done (the welcome email's days, the
  launch cover, a working GitHub key, the week's publish board: step 4's
  done checks).
  Next, for the session that picks this up:
  - Merge and deploy the engine, then apply the migration straight after,
    through the Supabase MCP, without waiting for the home computers to
    pull `main`. From the moment the engine deploys, its board route
    refuses the old recordings lane's questions on him whether or not the
    migration is applied, and a write that merges with one of the legacy
    items still on him (an old `take-*`, `you-launch-today`) is refused
    too; the old publish watcher is server code, replaced by that same
    deploy. The migration only moves those legacy items off his list, so
    every hour it waits keeps such writes failing. Read back that the four
    rows moved and that `work_board_items_on_you_is_ready` is validated.
  - Control Center follow-up: once the migration is applied, the Board's
    "Held from your list" lane can never hold a board item again (it lists
    only board items, and the engine and the database now refuse what its
    gate held), so it reads empty for good. Retire that lane and its name
    in the empty lanes line; the held items now show under In progress,
    starting "Held from your list".

- 2026-10-12, Monday, about 17:10 UTC: **the week's board carries the words
  Krish actually reads, Wednesday's workroom is made and waits on two
  calls from Krish, and Monday waits on one thing: the story intro and
  outro design.** Krish: "Good stuff, leave me
  with the final Publish Board with Monday 100% ready to publish (post
  produced video links included), Weds and Fri in production". In plain
  words:
  - **The board and both day pages are current.** Monday's publish page
    (https://claude.ai/artifact/QpGeGjaqZwvyXwRnSadqyS) carries the two
    scripts he recorded and "Recorded: both cuts, read from Teleprompter".
    Friday's (https://claude.ai/artifact/SHPLKcPPVDkg3j4Yy7vUVV) now carries
    the scripts in his Teleprompter (`docs/plans/2026-10-09-draft-script.md`
    and `-90s.md`, the 16:08 sends) and says it waits on his call on the
    prediction line. The board (https://claude.ai/artifact/RjLHJQi469BAKcvTCgneHV)
    was rebuilt from both and republished to its link; no old script and no
    Descript wording is left on it. Monday's two Record ticks were written
    into its store from his words "the two Monday videos are now in Inbox"
    (both takes are on the record).
  - **Monday is not 100% and cannot be from a cloud session.** The produced
    cuts come from a home computer (Codex, `produce-video`), and that skill
    stops before the final render while `config/story-intro-outro.json`
    says `awaiting_design`. The only Monday videos in Drive are his two raw
    takes in the Inbox. Order: a design for the story intro, audio treatment
    and outro card goes to him cold (`krish-design`), he approves it in
    words, the approval and the build land in the renderer, Codex produces
    both cuts and records them (`making.py --by Codex <piece> video ...`),
    then a Claude Code session puts the cuts and thumbnails on Monday's
    page and republishes the board. This session started that design (three
    blind concepts, then blind judging, then one synthesis shown to him) and
    stopped it unfinished when Krish closed the session; nothing was kept.
    The brief and the process are in
    `docs/plans/2026-10-12-story-intro-outro-brief.md`, and the next steps
    are under "Resume this week's publish board" above.
  - **Wednesday is started.** This session fired the "Make a piece"
    routine with Wednesday's piece (7554ed4a-560b-4365-b266-ea72abeed7ef)
    on his "Weds and Fri in production". Its session
    (session_01FzzvZdb6pALs4La91JrMJb) made the workroom and stopped,
    waiting on two calls from him (its entry, next below). Its board item
    `wed-muse-calls` had no `closes_on`, so Control Center held it back
    from his list; this session gave it `closes_on: draft`. The routine
    still has no Teleprompter connector (only he can attach it, and remove
    Descript, in claude.ai).
  - **Friday waits on one call from him**, now in the `friday-record` board
    item (rewritten for Teleprompter, linking the board's Friday tab):
    keep the dated prediction (by 30 September 2027, at least two of
    OpenAI, Anthropic and Google pick the brain for app builders by
    default, 85%), which young readers keep getting lost at, or say the
    broader bet in the video and leave the exact call to the article. On
    his answer: rewrite, `story_check.py`, two fresh readers until both say
    nothing lost them, `update_script` in place, the record lines, the
    Friday page and the board. Neither Friday cut has a read-back pass on
    record, and Monday's has none either (the strict readers were lost at
    "So Suno's judge could see it differently", "But that AI didn't make
    anything new", the investors' bet and "name about 60,000 songs"; the
    takes are already recorded, so nothing was changed).

- 2026-10-12, Monday, about 17:10 UTC: **Wednesday's Meta Muse piece
  (7554ed4a): workroom published, waiting on two calls from Krish.** Workroom:
  https://claude.ai/artifact/XW7uwdEJbMybpXVh2gjJRu (recorded on the piece;
  board item `wed-muse-calls`). The planned headline ("The Opt-In Was Buried
  in the Onboarding") has no source: TIME (6 Oct, read in full) reports no
  opt-in step for the people Muse maps, and the "Karan Joshi" and "Daniel
  Roberts" names appear only in a roundup site's summary of WIRED, whose text
  would not load. The supported angle is people who never signed up. Stopped
  before the draft and fact check, which spend on the model and need his
  "go". Next, once he answers: file TIME's text as a verbatim source, draft,
  run the fact gate, then visual gate (Meta and Muse logos), both scripts with
  the under.the.hood series line, read-back, Teleprompter send, publish page,
  Wednesday's tab of the board (not rebuilt yet: no publish page exists).
  Ticks copied: Monday's two Record ticks only (information; takes are on
  Monday's record). (Written by Wednesday's routine session, which pushed it
  only to branch `claude/relaxed-bell-vmveum`; copied here word for word.
  The session itself stopped at 16:56 UTC.)

- 2026-10-12, Monday, about 16:45 UTC: **Descript is out, teleprompter.com
  is in; every script opens with its series line and is held to a reading
  age of 12 by a hard gate; takes are matched by their Teleprompter title;
  and every video will get its own story intro and outro once Krish
  approves a design.** Built on this branch in both
  repositories; nothing committed, pushed, deployed, published or sent, and
  the only outside calls were engine reads. His words, kept verbatim in
  `config/teleprompter.json`, `AGENTS.md` and the house rules:
  "Also note that Descript is permanently gone, teleprompter.com is
  permanently in, connected via MCP here"; to "May every checked script go
  into your teleprompter.com account automatically, starting with Monday's
  two now?" he picked "Yes, automatic, Monday now", on the terms "One script
  per cut, in a folder per piece (e.g. "Mon 12 Oct follow.the.money"). When
  the words change, the same script is updated in place. Nothing is ever
  deleted."; "We need something catchy at the start of a video script like
  "Here's what you need to know about how money is changing because of AI.
  I'm Krish." at the start of follow.the.money videos. And then similar for
  the weds and fri scripts", with his picks for Wednesday and Friday and
  "Drop it at the end" for the closing "I'm Krish"; and "I also feel like
  these scripts are too complicated for a layman to understand. Every single
  script should be understandable by a 12-year-old. I can't even understand
  what I'm reading off the teleprompter. I thought we had hard gates for
  this?" In plain words:
  - **The series line.** The three lines live once, in the house rules
    (`SERIES_OPENERS`, rule `SERIES_OPENER`); `HOOK_AND_CTA` now puts the
    hook after the line and ends without his name. `story_check.py
    --series` refuses a script that does not open with its line or says
    "I'm Krish" again; `making.py scripts` passes the piece's series from
    the engine (the making route now returns `lane_slot`), `build.py` from
    the post, and the engine's script writer puts the line first itself.
  - **Reading age 12, a hard gate** (rule `R7`, same id). `story_check.py`
    refuses a spoken sentence over 20 words, more than 12 words a sentence on
    average, a reading grade over 6, a quotation over four words, and any
    word on the grown-up list (licensing, settlement, revenue, model,
    copyright and the rest, `SCRIPT_READING` in the house rules) its sentence
    does not explain. Then two fresh readers, each told to be an ordinary
    12-year-old hearing it once, must find nothing that loses them; their
    exact prompts are in `make-piece`, "The Scripts step", and the engine's
    script writer runs the same two (`read_back` on each script it writes).
    A pass is recorded with `making.py <piece> read-back CUT --readers ...`
    on the script check, tied to the words heard, and `teleprompter_send.py
    plan` sends no cut without it. Articles already have their own reading
    gate (the publish checks block above age 13), so they get no new one.
  - **The Teleprompter send** (`scripts/post-pack/teleprompter_send.py`,
    `making.py teleprompter`, the engine's new `teleprompter` field): `plan`
    prints the exact calls (a folder only when the record has none, then
    `create_script` or `update_script` with only text and duration), `record`
    writes the folder and each cut's script, `pending` lists what is missing
    or older. Control Center's Record step now says, per cut, "Read from
    Teleprompter: <title>"; the Scripts step says "in Teleprompter" or what
    is missing. The week's board shows the same and how to send the take
    back; its two Record ticks are now labelled "(Teleprompter)", same ids,
    so saved ticks carry over (`--teleprompter` replaces `--descript`).
  - **A take is matched against the current words, and by its title.**
    Monday's two takes (now on the piece, 184 and 95 seconds) scored 0.40
    and 0.42 on a home computer, because it heard them against the
    morning's scripts in its own checkout and the Drive pack, while Krish
    read the afternoon's words. `recording_match.py` now uses the copy whose
    words hash to the record's (`script_check.hashes`), looking in the files
    it knew and in the same files as committed on main, and says so when it
    has no copy of the current words. And teleprompter.com names each
    recording after its script ("Mon 12 Oct - 3-minute - Who gets paid for
    AI songs.mp4"): a file named after a cut's script title on a waiting
    piece's record is that piece and cut, unless its words are surely
    another piece's or its length surely the other cut's.
  - **A story intro and outro, in every format** (new house rule
    `STORY_INTRO_OUTRO`, in his words: "when the videos come back bear in
    mind that I want a proper animated branded intro to this specific story
    visually, the audio treatment, and then a proper animated outro card.
    Across all formats, and this should be part of the system moving
    forward."). Nothing is designed or built: design comes first and is his
    to approve. `produce-video` now stops before the final render, saying
    "story intro and outro not designed yet", while
    `config/story-intro-outro.json` says `awaiting_design`.
  - **Descript is retired**: `descript_send.py`, `descript_take.py`,
    `config/descript.json`, their tests and `making.py descript` are gone,
    the recordings upload is back to its form before Descript (no
    single-file send), and every skill and document now says a take comes
    back one way: dropped at the top of the Video Engine Inbox. The engine
    refuses a `descript` patch; records written today keep their `descript`
    field, which nothing reads.
  Next, in this order:
  1. Commit, merge and deploy the engine, then Control Center. The live
     engine drops the `teleprompter` field until then, so a record line run
     first is refused ("nothing to record") and nothing is stored.
  2. Straight after, from the repository root, record the four sends made
     by hand this afternoon. Until they run, `teleprompter_send.py pending`
     and `plan` print these lines and nothing else, so no second script is
     made. Each line carries the hash of the words that script holds now:
     Monday's as updated in place at about 15:49 UTC and Friday's at about
     16:08 UTC, after both were rewritten for the reading gate (each cut
     passed `story_check.py` and two fresh 12-year-old readers), the same
     hashes `making.py scripts` recorded at 15:50 and 16:10 UTC.

     ```
     python3 scripts/post-pack/making.py --by 'Claude Code' f328382d-71b3-41a7-a221-d8615826f12e teleprompter long --folder 86B6F74B-2F8A-4477-AE44-8DA1119D1CD9 --folder-name 'Mon 12 Oct follow.the.money - Who gets paid for AI songs' --script 45F414D8-31E1-4B2D-BBE4-44EBA042B346 --title 'Mon 12 Oct - 3-minute - Who gets paid for AI songs' --sha 89c38280deb755f3e16c37b07020847d5564fe6877dba7e044d889eb7e4034c9 --sent-at 2026-10-12T15:49:00Z
     python3 scripts/post-pack/making.py --by 'Claude Code' f328382d-71b3-41a7-a221-d8615826f12e teleprompter short --folder 86B6F74B-2F8A-4477-AE44-8DA1119D1CD9 --folder-name 'Mon 12 Oct follow.the.money - Who gets paid for AI songs' --script ED3DE98A-7158-4448-A622-A2A5115FFA83 --title 'Mon 12 Oct - 90-second - Who gets paid for AI songs' --sha d90a4415f9a86a6167379696b170320273a4314912f6365404733aff561a4693 --sent-at 2026-10-12T15:49:00Z
     python3 scripts/post-pack/making.py --by 'Claude Code' 904658db-4df2-4537-a0ed-ebe93e081db7 teleprompter long --folder DD28154B-B6D1-47DB-803A-79410D83196D --folder-name 'Fri 16 Oct mind.the.gap - Why so many AIs' --script 185F739E-733F-43B9-B5B2-66846CB5EC44 --title 'Fri 16 Oct - 3-minute - Why so many AIs' --sha f8ef15d3f1eb0f62a86afb780ba2294dbb49a9352903e6a94548b324d5023645 --sent-at 2026-10-12T16:08:00Z
     python3 scripts/post-pack/making.py --by 'Claude Code' 904658db-4df2-4537-a0ed-ebe93e081db7 teleprompter short --folder DD28154B-B6D1-47DB-803A-79410D83196D --folder-name 'Fri 16 Oct mind.the.gap - Why so many AIs' --script 1165370C-68A6-444E-88D5-A326A131E58C --title 'Fri 16 Oct - 90-second - Why so many AIs' --sha bc41bc8597977f90f95541f418006e8ae097033401779334a4c319982a286db5 --sent-at 2026-10-12T16:08:00Z
     ```

     Then `making.py <id> show` for each piece should say both cuts hold the
     current words, and `teleprompter_send.py pending` should list neither.
     Also record each cut's read-back of the words its two readers heard
     (`making.py <id> read-back long --readers "..." "..."`, and `short`),
     only for the exact words they heard; otherwise read them back again.
  3. Update both routines' prompts with `update_trigger` to the text in the
     parent session's scratchpad (`tp/routine-prompts.txt`): the Teleprompter
     send as the one standing exception, `teleprompter_send.py pending`, the
     series line and the reading-age gate. **Krish must attach the
     Teleprompter connector to both routines in claude.ai**; a session cannot.
  4. Rebuild this week's board with `--live --previous` and republish it to
     its link, so the Record card shows the Teleprompter scripts and the new
     labels (the ticks keep their ids).
  5. Rewrite the board items that still send him to Descript (at least
     `monday-record`, which names the "Record here" link and the timeline
     called "Monday"): read each cut from its script in teleprompter.com,
     then drop each take at the top of the Video Engine Inbox. Keep their
     `idea_id` and `closes_on`. Read the board first (`GET /api/workbench
     --full`) and change only the words.
  Waiting on Krish: the designs for the story intro, its audio treatment and
  the outro card (shown to him first, `krish-design`; no cut is finished
  until he approves one, and then `config/story-intro-outro.json` records
  it); attaching the Teleprompter connector to both routines;
  and, if he recorded any take in Descript before it was retired, exporting
  it and dropping the file in the Inbox. The four Descript projects of 12
  October stay in his Descript drive; nothing reads them. Everything listed
  as waiting in the entry below still is, except the Descript questions.
  Not verified here: the read-back's model calls in the engine's script
  writer (unit-tested with a stand-in, never called live), and the
  Teleprompter calls themselves (this session made none).

- 2026-10-12, Monday, about 15:30 UTC: **The Descript lane and the week's
  board are merged, deployed and live**, and every step left by the entry
  below is done. In plain words:
  - Merged to `main` in both repositories (engine 70e44fb, Control Center
    d337694) after the full checks passed (engine `npm run verify`: 126
    files, 1582 tests; Control Center lint, types, 906 tests, the handoff
    check). Both deployed from `main` and READY. The live week options now
    list `scheduled` (Monday f328382d, Wednesday 7554ed4a, Friday 904658db).
  - The four Descript record lines ran. `making.py show` says both cuts of
    both pieces hold the current words, with their read and Record here
    links; `descript_send.py pending` says every checked script is in
    Descript; `descript_take.py waiting` lists the four Record here links.
  - The week's board was rebuilt with `--live --previous` and republished
    to the same link (version 2): Monday and Friday made, Wednesday picked
    (Meta Muse, which Krish picked on the week page; the planning item
    `week-2026-10-12` was closed by Control Center), 90 tick ids, no ticks
    yet. The board item `week-publish-board-2026-10-12` is on him (rank 0,
    `only_you` post). It has no `closes_on`, because no making step closes
    a week, so Control Center holds it on the board's held lane, not his
    list; the link is what later sessions need from it.
  - `monday-record` now tells him to record the 3-minute cut only through
    its Record here link, the timeline called "Monday", and names the two
    6-second leftovers (one called "Record here") as not picked up.
  - Both routines' prompts were updated with `update_trigger` to the text
    the entry below names (the week's board, the tick copy, `pending`, and
    the Descript send as the one standing exception to the walls).
  - Both packs were rebuilt from the corrected scripts and sent earlier
    this afternoon (Monday 12 files, Friday 15); no page holds the line he
    cut.
  - **A mistake, put right.** At 14:39 UTC this session redeployed engine
    c948ad2 and Control Center 830435f by hand, after another session had
    already shipped newer `main` (engine fb5b1e3 at 13:50, Control Center
    d775916 at 14:27), so production ran older code for about 35 minutes.
    Both were redeployed from their `main` heads by about 15:10 and then
    replaced by the merge. No board item was written in that window. Rule
    for every session: a hand redeploy takes the current `main` head
    (`git fetch origin main`), never the commit you last pushed.
  Waiting on Krish: his reaction to the sting
  (https://claude.ai/artifact/FnDVNoCk1CqxGKTHRYENKH); recording in
  Descript; the music licence and levels; the 90-second question; and
  whether to delete the two leftover timelines in Monday's 3-minute project.

- 2026-10-12, Monday, late afternoon: **The review of the Descript lane and
  the week's board is fixed** (nothing committed, pushed, deployed,
  published or sent; the outside calls were engine reads only). In plain
  words:
  - **No second project, ever.** Until the four record lines below have
    run, `descript_send.py pending` prints those lines for Monday and
    Friday instead of a plan line, and `descript_take.py waiting` and
    `look` print them instead of sending a take through the Inbox (checked
    live this afternoon: both pieces show the hand-made lines). A send that
    fails after Descript has made the project is recorded on that project,
    and the next send finishes it there. A cut whose media minutes ran out,
    or whose send failed less than six hours ago, waits until its words
    change or Krish says go.
  - **A published piece keeps its day.** The publish watcher marks a piece
    published once its Substack post is live; the week options now list
    every piece scheduled in the week in any state (`scheduled`), the
    board reads each day's piece from there and from the board itself
    (`week_board.py --show`), and the tick copy keeps a tick whose piece
    is the one the board names for the day. A rebuild given the board it
    replaces (`--previous`) refuses to drop a day or a made day's page, and
    `--live` refuses a picked piece's publish page left out.
  - **Last week's board stays read.** Each week's board has its own board
    item, `week-publish-board-<Monday>`; `WORKBENCH.md` keeps last week's
    line until every day on it is at 100%, so his weekend reposts reach
    the record.
  - **His answer to a take question can be given.** `look`, `check` and
    `fetch` take `--krish-words` for a take of older words, a re-take of a
    cut already recorded and a copy already published; the words go onto
    the take's record. `produce-video` says so, and has a step for a
    re-take, which the waiting list never shows.
  - **A take in the wrong timeline is named.** Monday's 3-minute project has
    a spare timeline called "Record here" beside the real one, now called
    "Monday"; `look` names the timeline a stray recording is in, and
    nothing is copied from it.
  - **Only a take in the store is recorded.** `making.py recorded` checks
    the engine's recordings store first, and `descript_take.py fetch`
    prints the send and record lines only on a home computer with the
    runner key, else the handoff line.
  - **The board's own tick script is tested** in CI against a stand-in
    page and store, with the published board's tick ids kept in
    `fixtures/week-board/published-2026-10-12.json`; the board declares
    `"downloads": true`, as the artifact contract writes it.
  - `scripts/post-pack/README.md` has "Scripts into Descript" and "Takes
    recorded in Descript" in place of "not built", and its Checks list the
    new self-tests.
  Next, added to the list in the entry below: step 5's board item is now
  `week-publish-board-2026-10-12`, the rebuild takes `--previous` (the
  published board, read with `Artifact read`), and one more step:
  6. Put one line on Krish's board, on him: "Record Monday's 3-minute cut
     only through its Record here link
     (https://web.descript.com/16aa1f87-c054-4115-a11c-4342def815e5/f6eb1,
     the timeline called "Monday"). The same project also holds an older
     timeline called "Record here" and a spare Script timeline; a take
     recorded there is not picked up. You may delete those two in
     Descript; a session never does." (`idea_id`
     f328382d-71b3-41a7-a221-d8615826f12e, `closes_on` `record`.)

- 2026-10-12, Monday, afternoon: **Scripts go to Descript by themselves, a
  take recorded there comes back to its piece and cut, and the week has one
  publish board with a tick for every step.** Built on this branch; nothing
  committed, pushed, deployed, published or sent, and the only outside calls
  were reads (engine GETs, Descript `get_project`, the week board's store).
  Krish's words, kept verbatim in `config/descript.json` and `AGENTS.md`:
  "Descript is now my tool of choice for video script readouts on my phone -
  scripts should automatically be sent there, with the ability for Descript
  to put the video in the correct place when recorded."; "I can use the
  descript web app, otherwise my laptop to record"; to the automatic send,
  "3. yes", then "go, upload"; to private copies of his takes, "1. yes"; of
  the teleprompter, "2 fine, no issue with copy paste"; and of the week, "just
  give me one ... Publish Manager for the ... whole week with 3 tabs on it
  for Mon / Weds / Fri, which we need to get to 100%. Give me a tick box next
  to each one so I can tick as I go and you can durably record that
  completion where it needs to be recorded." In plain words:
  - **The send** (`scripts/post-pack/descript_send.py`, `config/descript.json`,
    `making.py descript`): when a piece's scripts pass, `plan` renders each
    cut's pages video and prints the exact Descript calls; the session makes
    them and records the project on the piece (`meta.making.descript`).
    Words that change go into the same project as a new Script timeline, so
    the "Record here" timeline and any take in it stay put. The engine keeps
    the field and says "in Descript" or "Descript has an older script" on the
    Scripts step, never holding it back; Control Center's Record step shows
    the two "record in Descript" links.
  - **The take** (`scripts/post-pack/descript_take.py`, the single-file send
    `recordings-upload.ps1 -File`, and `produce-video`'s new section "Takes
    recorded in Descript"): it reads what the "Record here" timeline holds,
    hears the words against the cut's script, makes the private copy, trims
    the slate on a home computer, sends the take into the recordings lane
    and records it on its piece and cut. A cloud session stops at the
    private copy and leaves one board item for a home computer.
  - **The week's publish board** (`scripts/post-pack/week_board.py`): one
    page, a tab per day, a tick per step, the ticks kept in the page's own
    store across every republish.
  - **Skills and documents**: `make-piece` runs `descript_send.py pending`
    first, sends at the Scripts step, names the send as its one standing
    exception, republishes the week's board with each day's page, and copies
    the week's ticks at the start and end of every session ("The week's
    ticks", used by `plan-week` and `produce-video` too). `plan-week` closes
    the ending week's ticks first and makes the new week's board last.
    `produce-video` says he records in Descript now, with the Inbox as the
    fallback. `AGENTS.md` has two new bold rules (the Descript scope; where
    completion is recorded), `docs/CADENCE.md` the new rows, "Where
    completion is recorded" and misreads 13 to 19, and `docs/INTEGRATIONS.md`
    and `docs/DRIVE.md` the Descript lines.
  Where things stand:
  - **The four Descript projects**, made by hand at 10:31 UTC in `Mindmake
    scripts`, each with the current words and a "Record here" timeline
    (`get_project` this afternoon: nothing recorded in any of them yet).
    Monday's 3-minute "Record here" timeline has been renamed "Monday" in
    Descript; the tools find it by its id. Monday's 3-minute project also
    holds the first attempt's media and two spare timelines; nothing was
    deleted, and the record line below lists that media as known.

    | Piece | Cut | Record here |
    |---|---|---|
    | Monday (f328382d) | 3-minute | https://web.descript.com/16aa1f87-c054-4115-a11c-4342def815e5/f6eb1 |
    | Monday | 90-second | https://web.descript.com/6e1c3178-ba5c-4603-a5e2-ec23f3612071/36a32 |
    | Friday (904658db) | 3-minute | https://web.descript.com/36040413-966a-417c-90a2-b2667f5ca4ef/d3f1e |
    | Friday | 90-second | https://web.descript.com/a8be9a54-1247-41ad-ae9a-aebe3ef22fa1/c9778 |

  - **This week's board**, https://claude.ai/artifact/RjLHJQi469BAKcvTCgneHV,
    published this morning from the two day pages; its store held no ticks
    and no links this afternoon. It shows Wednesday as not picked, but
    Wednesday's piece is picked: "Meta Muse Builds a Profile on Every Person
    in Your Life" (7554ed4a, under.the.hood, drafting, 14 October). The board
    item `week-publish-board-2026-10-12` does not exist yet.
  - **Both routines** ("Make a piece", "Plan the week") carry the Descript
    connector. Their prompts do not name the new steps yet, and "Make a
    piece"'s wall ("nothing sends ... without Krish's own words immediately
    before") must name the Descript send as its one standing exception, or a
    routine session may refuse to send.
  Next, in this order (the order matters; all five done on 12 October,
  about 15:30 UTC, in the entry above):
  1. Commit, merge and deploy the engine. The live engine drops the
     `descript` field, so a record line run before the deploy is refused
     ("nothing to record") and nothing is stored.
  2. Straight after, and before any session runs `descript_send.py plan` or
     a send for Monday or Friday, record the four hand-made projects, from
     the repository root. Until these run, `pending` and `plan` see both
     pieces as never sent and would make second projects:

     ```
     python3 scripts/post-pack/making.py --by 'Claude Code' f328382d-71b3-41a7-a221-d8615826f12e descript long --drive d8b77ba9-0c95-4b7b-8964-2f5b888c0b78 --project 16aa1f87-c054-4115-a11c-4342def815e5 --script-composition 46c2a75a-615d-4ab5-bdc4-c84b57a88454 --record-composition f6eb149a-82e8-4604-836e-b78ea7c73797 --links https://web.descript.com/16aa1f87-c054-4115-a11c-4342def815e5/46c2a https://web.descript.com/16aa1f87-c054-4115-a11c-4342def815e5/f6eb1 --media 'Script 2026-10-12 3e329b9.mp4' --sha 3e329b90efcc3a4198b58641576eb9dc9f1f34deb095341a4d3ce596f908383b --sent-at 2026-10-12T10:31:16Z --known-media 'Record here 3-minute.mp4' 'Script 2026-10-12 8043955.mp4' 'Record here 3-minute slate.mp4' 'Script 2026-10-12 3e329b9.mp4'
     python3 scripts/post-pack/making.py --by 'Claude Code' f328382d-71b3-41a7-a221-d8615826f12e descript short --drive d8b77ba9-0c95-4b7b-8964-2f5b888c0b78 --project 6e1c3178-ba5c-4603-a5e2-ec23f3612071 --script-composition f27bfc76-e71b-498d-a942-767063070c48 --record-composition 36a320ab-ed9a-4d7e-bddb-61668278faea --links https://web.descript.com/6e1c3178-ba5c-4603-a5e2-ec23f3612071/f27bf https://web.descript.com/6e1c3178-ba5c-4603-a5e2-ec23f3612071/36a32 --media 'Script 2026-10-12 38fe78d.mp4' --sha 38fe78d76748b5cd6c5c128c7a5e95b7839e9862fe972c67ef32daa0977188b5 --sent-at 2026-10-12T10:31:16Z --known-media 'Script 2026-10-12 38fe78d.mp4' 'Record here 90-second slate.mp4'
     python3 scripts/post-pack/making.py --by 'Claude Code' 904658db-4df2-4537-a0ed-ebe93e081db7 descript long --drive d8b77ba9-0c95-4b7b-8964-2f5b888c0b78 --project 36040413-966a-417c-90a2-b2667f5ca4ef --script-composition a1b03023-61ee-4c1a-bf66-352b11f13f81 --record-composition d3f1eeaf-35ed-4ed7-a607-62f509ee253d --links https://web.descript.com/36040413-966a-417c-90a2-b2667f5ca4ef/a1b03 https://web.descript.com/36040413-966a-417c-90a2-b2667f5ca4ef/d3f1e --media 'Script 2026-10-12 c767efb.mp4' --sha c767efbecea962549dfa8a45b2ad869b68d152fd62422fde3ec0907f06aa03b3 --sent-at 2026-10-12T10:31:16Z --known-media 'Script 2026-10-12 c767efb.mp4' 'Record here 3-minute slate.mp4'
     python3 scripts/post-pack/making.py --by 'Claude Code' 904658db-4df2-4537-a0ed-ebe93e081db7 descript short --drive d8b77ba9-0c95-4b7b-8964-2f5b888c0b78 --project a8be9a54-1247-41ad-ae9a-aebe3ef22fa1 --script-composition 7b38e479-2bf0-4b65-a328-c686f746a5a2 --record-composition c9778206-cc1e-4e45-b9c6-f161d34c707c --links https://web.descript.com/a8be9a54-1247-41ad-ae9a-aebe3ef22fa1/7b38e https://web.descript.com/a8be9a54-1247-41ad-ae9a-aebe3ef22fa1/c9778 --media 'Script 2026-10-12 de706a8.mp4' --sha de706a85f14fb3fe410737055acf46a594ef85b807af09a84ff77de1f997b289 --sent-at 2026-10-12T10:31:16Z --known-media 'Script 2026-10-12 de706a8.mp4' 'Record here 90-second slate.mp4'
     ```

     Then `making.py <id> show` for each piece should say both cuts hold
     the current words, and `descript_send.py pending` should list neither.
  3. Deploy Control Center's mirror (its making record and Record step).
  4. Update both routines' prompts to name the new steps (the Descript
     send's exact scope in "Make a piece"'s walls; the week's board, with
     its own item `week-publish-board-<Monday>` and `"downloads": true`,
     and the tick copy in both), with `update_trigger`.
  5. Rebuild this week's board with `--live --previous <the published
     board, as Artifact read saved it>` (so Wednesday shows as picked, not
     made yet, and neither made day is lost) and republish it to the same
     link, then put the board item `week-publish-board-2026-10-12` on
     Krish (rank 0, its link).
  Waiting on Krish:
  - Done since: his go ("go, rebuild and send Monday's and Friday's
    packs"); both packs were rebuilt and sent the same afternoon.
  - **The sting**: his reaction to the designs drafted today (the late
    morning handoff below).
  - **Music**: NO CURVES needs its licence certificate beside it, then his
    approval in words; the levels are approved by ear once he has heard a
    cut with music.
  - **The 90-second question**: does the short cut's 90 seconds include the
    sting and the end card?
  - **Library Sync on the backup machine**, if he works there; he moves it.
  - **Descript, still open**: whether Codex and his other Claude account
    reach the same drive, and his plan's media minutes (about 5 a piece).
  Not yet proven against a real take, because none exists: where Descript
  puts a new recording beside the slate, whether camera and microphone come
  as two files, the transcript's layout, the private copy's frame rate, and
  whether its download link needs a sign-in. The tool refuses safely on each,
  and the first take is the live test. Smaller gaps: a channel copied from
  the board is stamped when it is copied, not when he ticked it
  (`making.py posted` takes no time); the board does not show a channel he
  ticked in Control Center; and the publish page has no Descript links of
  its own (the board's Record card has them).

- 2026-10-12, Monday, early afternoon: **The second review of the video
  build is fixed** (two more reviewers; nothing committed, merged, deployed
  or written outside this repository). In plain words:
  - **The transcriber**: every fix line now points at the pinned set
    (`requirements.lock.txt`), because an unpinned install gives a pair that
    cannot decode sound; `make.py --doctor` and the lane's check decode a
    second of sound (`scripts/quick-edit/transcriber.py`), and a take that
    cannot be heard is one failed line, never a crash.
  - **Captions**: numbers are whole again ("$150,000", "$5.4 billion",
    "70%"), and a word heard the US way is captioned as the script spells it
    ("cheque", "neighbour", "licence"); a cue ending on such a word is found.
  - **The kit stops on what would go out wrong**: a picture no line brings
    in, or one whose words come out too small to read in that cut's shape,
    is a `CHECK` (exit 1), passed only with Krish's words (`--allow-missing`,
    `--allow-small`), which also reach the cut's config so make.py quotes
    them. Both cuts of a piece ask for music as long as the long cut, not a
    fixed four minutes. An end card's own sound is never mixed.
  - **The sting's approval** cannot be dodged by a value defined beside its
    registration; a global stylesheet there is hashed.
  - **The making record**: each cut keeps when its own words last changed;
    a record with no hashes yet counts as changed (so Monday's first hashed
    check stamps now, not 11 October); the record's start is fixed on its
    first write; `making.py recorded` refuses a take of older words without
    Krish's words (`--krish-words`); `making.py scripts` asks him on the
    board about such a take; a thumbnail is recorded only as the drawer's
    file of the right shape (`--thumb-file` always); `archive.py` checks the
    shape too. A new database trigger keeps the newer making record when a
    slow route (the chat, a revise, the fact check) writes back an old copy
    of the piece's meta (`supabase/migrations/20261012120000_keep_newer_making.sql`,
    to apply).
  - **The lane**: a board question is never reopened once Krish or a
    session closed it (the board's new `lane_if_new`), and is asked again
    only when it is a new question, not when a score shifts; a take older
    than every waiting piece is looked at again after six hours; a take
    downloaded only to hear it is deleted once heard; the installer installs
    a machine that sends but cannot place takes yet (its check's exit 3).
  - **House rules**: `VOICE_ON_CAMERA` no longer asks for a "made with
    Claude" line; his ruling is its own rule, `NO_AI_DISCLOSURE_LINE`, read
    by the writers, the draft judges and the final pass, and the story check
    and the Studio warn on such a line.
  - **Step 8 of the skill**: a thumbnail's logos are copied from
    `thumbs.json`'s new `companies`; the gate also reads a drawn row of two
    companies as both.
  Not done, because each is a write outside this repository: rebuilding and
  sending Monday's and Friday's packs (their pictures still live only in
  this cloud session's scratch: the first "Next" line below), the board
  item saying so, rebuilding the publish page from today's drafts before
  Krish records, and applying the migration.

- 2026-10-12, Monday, late morning: **The video build's review is fixed, the
  home computers will place takes by themselves, and Monday's and Friday's
  scripts are in Descript.** Two reviewers checked the video build (the
  produce-video skill and its tools); every finding is addressed on this
  branch (the library send and the show-first guard by the skill's own
  steps, the rest in code), uncommitted unless named below, nothing merged
  or deployed. In plain words:
  - **Committed today**: the matcher (`recording_match.py`), the sting, the
    music bed and the loudness finish, a thumbnail per size, `kit.py`, the
    `produce-video` skill, and Krish's Monday picks (the 3-minute script is
    460 words, the "I made this with Claude's help" line cut; Friday's
    3-minute is 457 words with the same line cut, as he ruled for every
    script: "correct, make that a rule").
  - **The kit finds a piece's files on any machine** (`kit.py`, new
    `scripts/post-pack/plan_files.py`): the scripts come from the dated
    drafts in `docs/plans/`, so Monday's no longer stops; a picture it cannot
    find is a `CHECK` (exit 1), passed only with Krish's own words in
    `--allow-missing`.
  - **The mix**: a clip named in a config opens a cut only if it is the
    approved sting or Krish's words say so, and its own sound is never used;
    the sting's approval hash is the same on Windows and Linux and covers
    everything the sting imports; each series gets its own colour; both cuts
    of a piece get one music track; `make.py --doctor` fails without
    faster-whisper; the archive folder falls back to `config/studio.json`;
    a cut with no pictures warns before rendering.
  - **The making record** keeps the hash of each script's words, keeps the
    time the scripts were checked when the words have not changed, and
    stamps each take with the script it was read from, so a take of older
    words stops counting. The engine route refuses a write that lost a race
    (409); Control Center shows "recorded from an older script". Thumbnails
    are recorded only with the drawn file (`--thumb-file`) or its link.
  - **Takes are placed by the home computers** (Descript lane, stage 1a):
    `scripts/recordings-upload.ps1` now runs `recording_match.py --record
    --board --by "Recordings lane" --json` with the pinned Python at the end
    of every pass, on either machine, when the engine holds a take no piece
    claims and the answered book does not hold; each unsure take is one
    board item. `install-recordings-upload.ps1`'s check now also proves the
    engine key, faster-whisper and ffmpeg. It starts only once this is on
    `main` (the lane pulls `main`).
  - **Thumbnails draw on any checkout**: Monday's and Friday's logos are SVG
    in `docs/plans/<plan>/logos/`, so no `--assets`; both pieces' thumbnails
    were drawn here, on plain ink (the pile-up background is a picture git
    does not keep), and pass the visual gate's thumbnail checks.
  - **The skills**: `produce-video` stops when a piece's Scripts step is not
    done, fetches recorded takes by sha256, sets `MAKING_BY`, records a
    thumbnail only when one was drawn, sends cuts to the library only with
    both thumbnails and the gate passing for videos and thumbnails, and
    never writes the Visual gate or Pack steps (`make-piece`'s publish board
    step does; `docs/CADENCE.md` agrees). `.claude/skills` now holds real
    copies, so Claude Code on Windows loads them; `npm run skills:validate`
    fails when a copy differs (`python scripts/validate-skills.py
    --sync-claude` refreshes them).
  - **House rules**: INTRO_STING, MUSIC_BED and THUMBNAIL_EVERY_SIZE moved to
    a new production stage, so the script writer and the channel cuts no
    longer read LUFS figures or a sting that does not exist; INTRO_STING now
    says no design is approved and quotes his rejection.
  - **Descript, by hand**: Krish said, of each checked script going to his
    Descript drive ("Krish Raja's Drive") as a view-access project per cut in
    `Mindmake scripts`, about 5 media minutes a piece, nothing published,
    edited or deleted, no AI credits: "yes ... go, upload". Of the takes: "a
    standing yes for the video skill to make a private copy, never public,
    of each take recorded in a Record here timeline, so it can download it".
    Of the teleprompter: "fine, no issue with copy paste". Monday's and
    Friday's four projects were made at 10:31 UTC, each with the script and
    a "Record here" timeline; the board items `monday-record` and
    `friday-record` link them. **Not built**: the automatic send, and
    bringing a take recorded in Descript back to the engine, so such a take
    does not reach the matcher or the record by itself yet. The making
    record has no Descript field yet.
  Waiting on Krish:
  - **The sting.** He turned down the first design: "it's ok, it's a bit
    boring and colourless and vanilla - and just what Powerpoint would do in
    2008". Other designs drafted today sit only in this cloud session's
    `.cache/sting` and use PNG pictures, which git does not keep and
    `intro.py` refuses; his reaction decides which one is rebuilt in
    `apps/renderer` with tracked assets, previewed in all three series and
    both shapes, and approved in his words. Until then every cut has no sting.
  - **Descript, still open**: whether Codex and his other Claude account
    reach the same Descript drive; which Descript plan he is on (media
    minutes); adding the Descript connector to the "Make a piece" routine
    (he does it in the routines page; a session cannot); and running
    `scripts/engine-key.ps1` on any runner that lacks the engine key, so
    both machines can place takes.
  - **Music**: NO CURVES needs its licence certificate beside it in
    `00_Brand-Assets > 07_Music`, then `music.py add` on a home computer and
    his approval in words; the levels are approved by ear once he has heard
    a cut with music. Until then cuts have his voice only.
  - **The 90-second question**: does the short cut's 90 seconds include the
    1.5 second sting and the 4 second end card? Until he says, the check is
    on his speech alone (`TALL_CAP` in `make.py`), and the report always
    shows the whole length beside it. A 219-word script runs about 88
    seconds of speech, about 93 with both.
  - **Library Sync**, if he works on the backup machine: it runs only where
    it is installed; he moves it.
  - `Video Engine > Archive` in Drive, if it is missing (the connector saw
    none on 12 October).
  Next, for the session that picks this up:
  - **Monday's and Friday's pictures exist only in this cloud session's
    scratch folder**, and both packs were built on 11 October from the old
    scripts and never sent. Before this session ends, a session holding
    them should rebuild each pack with the current drafts (`build.py
    --replace`) and send it (`send.py`, Krish's standing instruction), or
    the pictures are lost and a home computer's kit stops with a `CHECK` for
    every picture.
  - Commit this work, merge and deploy the engine before anything relies on
    the hashes (the old route drops them harmlessly), apply
    `supabase/migrations/20261012120000_keep_newer_making.sql` through the
    Supabase MCP, and deploy Control Center's mirror with it. Then run
    `making.py <id> scripts` for Monday and Friday so their records hold the
    hashes of today's words; with no hashes on their records yet, that check
    is stamped now, so a take of the old words recorded before it is asked
    about, not placed.
  - Before Krish records: rebuild the publish page and the pack from today's
    drafts (both still hold the line he cut), and put one board item on him
    saying the pictures must reach the library first (the line above).
  - Run `install-recordings-upload.ps1` once more on each runner to prove the
    engine key and faster-whisper there (its check names what is missing).
  - Build the Descript return (a take in a "Record here" timeline, privately
    published under his standing yes, onto its piece and cut), then the
    automatic send; `produce-video` says plainly until then that it cannot
    fetch a Descript take.
  - Smaller: the visual gate has no way to check only videos and
    thumbnails, so the skill reads its lines by kind; `recording_match`
    looks for scripts in a different order from `plan_files.py` (the same
    files today). Friday's long cut cues 3 of its 7 pictures and Monday's
    tall panels are under the 39 pixel floor: the kit now stops on both
    (a `CHECK`), so those cuts need their cues added by hand, panels drawn
    for video, or Krish's words.

- 2026-10-12, Monday: **The social profiles are rebuilt, and their kit
  lives here now.** Over 11 and 12 October a Claude session in Cowork rebuilt
  the YouTube, Instagram and Facebook profiles and Krish's own TikTok and X,
  in his browser, each change checked on the live page.
  `docs/AMPLIFICATION.md`, "The profiles every link lands on", has what each
  one carries, his decisions in his words, and what is left.
  - New: `scripts/channel-kit/profiles.py` makes the profile picture, the
    Facebook cover, the X header and the five Instagram highlight covers from
    the house style, with crop and size checks. Rebuilt here, it matches the
    uploaded avatars and highlight covers pixel for pixel; the cover and
    header differ only in the pills' letter spacing (this repository's pill style).
  - The profile picture on YouTube, Instagram and the Facebook Page is now the
    Mindmake icon over butter, lilac and coral paint splashes (Krish: "my
    mindmake icon but with splashes of these colors"). Social only; the brand
    kit's logo is unchanged.
  - Drive: the uploaded set is in `makeyourmindup > 2 Channel art
    (permanent)`, indexed in `READ ME - profiles.txt`.
  - Waiting on Krish, on his phone: the Instagram name (`makeyourmindup |
    AI, unpicked`) once its 14-day lock lifts; the five highlights once a
    full week of pieces is out; pinned posts; and, only if he wants it, a
    pinned post on X. Not on the board: this session had no engine key.
  - Proposed, not ruled: the playbook's your.call poll and Scored loop and
    its five templates (carousel, X card, poll frame, captions file, a
    short-cut ending with the call). Ask Krish before building any.

- 2026-10-11, Sunday evening: **The first planned week is set, and Monday is
  at its publish board.** Week of 12 October, on the week page (#/week):
  - Monday, follow.the.money: "Warner sued Suno. Now it takes a cut. Who else
    gets paid?" (f328382d). Fact gate passed on its fourth run (74 claims,
    none blocking; about $1.47 of model spend, Perplexity not metered),
    visual gate passed with all eight companies' logos, scripts 479 and 219
    words, pack built. Workroom
    https://claude.ai/artifact/MJQfHCaP7qg1mynF78K6rz (five picks with
    Claude's marked: "By Suno's own count" or the word "unaudited", which
    costs one more gate run; the title; two optional joke lines; the
    sign-off). Publish board
    https://claude.ai/artifact/QpGeGjaqZwvyXwRnSadqyS. Board item
    `monday-record`. Waiting on Krish: the picks, then recording both cuts.
  - Wednesday, under.the.hood: three options, the watermark piece
    (eb032d36) recommended. Topic only; nothing is made until he picks.
  - Friday, mind.the.gap: the AI models piece (904658db) moved from 9 to 16
    October with its long script cut to 478 words; its publish board
    (https://claude.ai/artifact/SHPLKcPPVDkg3j4Yy7vUVV) is updated in place.
  - The Monday purge no longer deletes a week's options: offering one moves
    its expiry past the week, the purge spares any row holding a day still to
    come, and the stale archive spares scheduled, restored and offered rows
    (migrations `20261011180000`, `20261011200000`, both applied).
  - The Sunday session's own ideas are source `week_research`, never
    `lane_sourcing` (the n8n workflow's, whose quiet alarm reads it).
  - CI is green again: Pillow is installed from `requirements-ci.txt` and
    vitest is 5.0.3 (the tinypool advisory). It had been red since 7 October.
  - Done by Krish on 12 October: the Make a piece token is in Control
    Center's Vercel project (`CLAUDE_MAKE_ROUTINE_TOKEN`, live since the
    07:21 UTC redeploy), and both routines (Make a piece; Plan the week, next
    Sunday 18 October 06:47 in New York) carry Brandfetch, Firecrawl and
    Google Drive and start with this repository attached.
  - For Codex: archive naming still leaves TikTok out of the default tall
    places (`scripts/quick-edit/archive.py`, `config/archive-naming.cases.json`,
    `build.py`'s tiktok flag). `archive.py` keeps its own clock in
    Europe/London while the week is planned in New York time.

- 2026-10-11, Sunday: **The two cuts and the standing five are enforced, not
  just written down.** Each cut is recorded from its own script with its own
  hook and outro (TWO_CUTS reworded; AMPLIFICATION.md and CADENCE.md match).
  The making record now needs both cuts for Record and for Video assets ("short
  cut still to produce"), and all five standing channels for Publish: the
  Substack post alone reads "Substack is out; 1 of 5 channels", and board items
  tied to a piece wait for the five (a piece made before the making record
  existed still closes on the Substack post). `making.py scripts long.md
  short.md` takes the cuts by position and fails without both; `build.py` warns
  when a script names no cut. The 90-second format aims at 200 words and the
  writer retries above 495 (3 minutes) and 220 (90 seconds). TikTok is a
  standing channel in the engine's lists; the Studio treats up to 90 seconds as
  normal. Control Center's mirror (`src/lib/making.ts`,
  `scripts/check-make-handoff.mts`) carries the same rules (control-center
  600eded).

- 2026-10-11, Sunday: **The week is planned on Sunday; the standing answers
  are written down.** Krish: every Sunday decide Monday, Wednesday and
  Friday; make Monday's through to its publish board the same day; leave
  Wednesday and Friday topic-confirmed until he starts them; the only Sunday
  question is "What are we writing about this week?". Standing: a 3-minute
  video and a 90-second version (house rule TWO_CUTS, story_check.py holds
  the lengths); every piece to Substack and YouTube, then Shorts, TikTok and
  Instagram (docs/AMPLIFICATION.md, publish_kit.py; LinkedIn, WhatsApp and
  Notes optional; the making record's publish step needs the five).
  `docs/CADENCE.md` rewritten. New: `/api/week/options` (a session writes
  each day's options onto the pieces), `.agents/skills/plan-week` (the
  Sunday routine), a `90s` video format. Krish is in New York, not Sydney:
  the 10 October slate cron assumed Sydney and is replaced. The AI models
  piece moved to Friday 16 October. Its long script runs about 4 minutes and
  must be cut to 3 before he records it.

- 2026-10-11: **Board items close themselves when the piece moves on.**
  Krish: things from Wednesday "should really be chalked off automatically
  when we are done with a publish flow". Root cause: board items carried no
  link to a piece, and no piece was ever marked published (he publishes by
  hand in Substack; nothing told the engine). Now `work_board_items` has
  `idea_id` and `closes_on` (migration `20261011120000`); the making route
  closes the items a step finishes; and the hourly publish watcher marks a
  piece published from the publication's public archive and closes every
  item tied to it. Control Center's own jobs are recorded as themselves on
  the board, not as Krish. See "The board" above for how to write items.

- 2026-10-11: **Codex owns video production; Claude Code owns ideation, the
  article and the publish board.** Every step of the making record now
  names its owner (`MAKING_OWNERS`), `.agents/skills/make-piece` stops at
  the pack and comes back for the publish board, and the new
  `.agents/skills/produce-video` is Codex's step from Recorded to Video
  assets, on a runner machine, through the visual gate. `docs/CADENCE.md`
  now holds who owns what, where every key and file lives, and the ten
  ways the cross-tool system could be misread and what stops each. In
  Control Center the slate now runs on a cron (Sunday, Tuesday and
  Thursday morning Sydney) and lays each coming slot on the work board.

- 2026-10-10, late: **The weekly rhythm is ruled** (`docs/CADENCE.md`).
  Krish: Sunday, Tuesday and Thursday are the preparation days, each with a
  slate of ideas to pick from (the cold ideas and Inspo folder on Drive, and
  the backlog); once picked, the artefact set is made the same day, he
  records the next morning, the runner and post-production follow, and he
  finishes on the publish board. **To build next, in this order:** (1) the
  slate in Control Center on those three days: a cron that assembles the
  three best from the Drive scan and the judged backlog into one
  `pick_for_series` call for the next slot, with an honest "nothing worth
  picking" when there is none; (2) the runner's post-production step
  records the finished cuts on the piece (`making.py <id> video ...`) by
  itself, so Video assets lands without a session; (3) the publish board
  on the piece opens the publish page beside the ticks. Friday's piece runs
  late by his own account, a learning week; he records both cuts first thing
  tomorrow.

- 2026-10-10, evening: **The control centre plans and tracks; Claude Code
  makes, and the two are one record.** Krish: "the control centre becomes
  more of a progress tracker, suggestions compiler, and ideas generator,
  which then saves my choices to the durable system and then a session here
  picks up that durable system ... It's crucial that everything is fresh and
  synchronised in real time." Where a piece is between the workroom and
  every channel now lives on its own row, `content_ideas.meta.making`,
  served by `/api/content-ideas/:id/making` (`api/_making.ts`) and written
  from any session with `scripts/post-pack/making.py` (`build.py` and
  `send.py` record the pack and the gate themselves when `post.json` carries
  `piece_id`). Control Center (ADR-031 there) shows it on every piece's call
  and in the composer over its realtime subscription, lets Krish tick
  channels off in the amplification order, and its "Make it in Claude Code"
  button fires the "Make a piece" routine with the piece id only; that
  session follows `.agents/skills/make-piece/SKILL.md`. Friday's piece is
  recorded: workroom, draft, visual gate, both scripts, pack built. **Waiting
  on Krish:** generate the routine's token at claude.ai/code/routines ("Make
  a piece") and set `CLAUDE_MAKE_ROUTINE_TOKEN` in Control Center's Vercel
  project (the id is set); add the connectors the routine should carry
  (Brandfetch, Firecrawl) in the routines UI; then the earlier items: test
  Copy in claude.ai, approve the text, record both cuts, the Manifold
  market, rotate the pasted keys.

- 2026-10-10: **The visual gate is live, and Friday's pictures pass it.**
  Krish, of the first cover: "really boring and losing it's personality", and
  "it needs to be a literal gate that stuff like this cannot be produced,
  whether in static asset form or video." House rule VISUAL_EVIDENCE;
  `scripts/post-pack/visual_gate.py` (run by `build.py` on every pack)
  refuses a pack unless every company the body names
  (`config/logo-registry.json`) has its real Brandfetch logo on a picture,
  on the cover and declared on each video; a piece about volume carries a
  picture built from at least six real, dated pages; and the cover came from
  `scripts/pages/build.py --cover` (its new `cover.json` receipt matches the
  PNG, portrait on, logo rows). Friday now has: the house cover (wordmark,
  Krish, OpenAI and Anthropic marks, twelve launch pages behind), the pile-up
  picture (twelve real pages, dated), real logos on all six pictures. The
  first flat cover is refused by the gate, proven in this session. One
  self-contained publish manager
  (`scripts/post-pack/publish_manager.py`, kind `publish-manager`; Krish:
  "there should just be a copy button. Same for pictures"): article with
  pictures, every picture, every channel's words and the scripts, each with
  Copy; proven in a browser (article pastes with 12 headings and 7 pictures;
  a picture copies as PNG). Live at
  https://claude.ai/artifact/SHPLKcPPVDkg3j4Yy7vUVV. Friday's pack
  (`docs/plans/2026-10-09-friday/post.json`, cover facts, pile-up page)
  builds and passes. **Waiting on Krish:** test Copy article and Copy picture
  inside claude.ai; approve the text in the engine; record both cuts; create
  the Manifold market; rotate the pasted keys.

- 2026-10-09, night: **Scripts are only scripts, and every post now has one
  publish page.** Two new house rules: SCRIPT_ONLY (Krish: "make sure my video
  scripts are literally just scripts without all the excess internal monologue
  commentary (forever)") and HOOK_AND_CTA (open on the most provocative true
  thing; close by sending people to the free article at makeyourmindup.ai).
  `story_check.py` now refuses a script with stage directions, labels,
  timings, headings or joke options, or with an outro that never mentions the
  article; the video writer (`_video.ts`) keeps "say" to spoken words and puts
  joke options in "notes". The amplification plan is `docs/AMPLIFICATION.md`:
  one Substack **Video** post (long cut on top, article under it; Substack
  uploads it to YouTube privately), then YouTube, LinkedIn, Shorts, Reels,
  WhatsApp and Notes with one vertical cut of at most 90 seconds.
  `scripts/post-pack/publish_kit.py` writes it per post as
  `0 Publish/publish.html` (a new library section, in the cases file, the
  engine and library.py). Friday's files: `docs/plans/2026-10-09-draft-script.md`
  (about 4 minutes), `-draft-script-90s.md` (76 seconds), `-publish.json`
  (every channel's words, linted by `_packaging.ts` and the publish checks),
  `-manifold-market.md`. **The engine key now reaches cloud sessions** as a
  network secret (health answered 200 through it on 2026-10-09).
  **Friday's fact check passed (9 Oct, 15:55 UTC), run from the cloud.** 27
  primary sources filed on the piece word for word
  (`docs/plans/2026-10-09-sources.json`); four runs took it from 36 failing
  claims to none. It caught a real error (ordinary ChatGPT shows one GPT-6
  with a Thinking slider, not Astra, Sol and Luna) and the article now says
  "more than a dozen" models, so every title and the hook dropped "14" for
  "more versions of Claude than there are Harry Potter books". The checked
  text is `docs/plans/2026-10-09-draft-body.md`; saving it moved the piece to
  `review`, so **approval is Krish's**. The workroom now has a Publish tab.
  **Waiting on Krish:** create the Manifold market (no Manifold key here; the
  text is ready), record both cuts, rotate every key pasted in chat (including
  the Vercel master token), and confirm on first use that the Copy post paste
  keeps pictures inside a Substack Video post.

- 2026-10-09, evening: **Friday's piece is rebuilt on Krish's angle, the big
  story: why there are so many AI models, and what it means.** His seed
  (Perplexity research) was treated as raw material, never as an override:
  20 claims checked against primary sources, ten corrections
  (`docs/plans/2026-10-09-seed-fact-check.md`, including OpenAI's revenue cut
  from ~$70bn to almost $50bn on 8 Oct). Our own thesis: the name is doing four
  jobs (version number, price tag, advert, queue ticket). The $20 SemiAnalysis
  story is one paragraph. Drafts: `docs/plans/2026-10-09-draft-body.md`
  (passes every blocking publish check, reads at about age 10) and
  `2026-10-09-draft-script.md` (passes story_check.py). The workroom
  (https://claude.ai/artifact/MmaKvtHTHUYbSY9JEiCBAn) carries all of it, with a
  new Mocks room (decoder, conveyor belt, four jobs, prices vs bills, the
  menu-misleads bars, the three futures) and new decision cards: angle, title,
  call and a new "revenue race" card. **All picks made:** angle "One name,
  four jobs"; title "Why are there suddenly so many AIs?"; revenue paragraph
  kept; Manifold market; level 1+, warm, both lengths. His call, in his words:
  "85% - big tech will make things more and more opaque and remove the illusion
  of choice to satisfy the masses and control margin/outcome". The checkable
  sentence is unchanged at 85%; his reason is now the stated bet in the article
  and script. **Waiting on Krish:** the paid fact-check cap (the call paragraph
  changed); approval to create the Manifold market; rotating the keys pasted in chat.

- 2026-10-09, afternoon: **Friday's piece now lives in a live workroom:**
  https://claude.ai/artifact/MmaKvtHTHUYbSY9JEiCBAn (private to Krish). Four
  rooms: Decide (seven decisions as tappable cards with Claude's pick, level
  and cost; picks save to the page's database), Article (the draft with the
  engine's checks and a change log; a Note on any paragraph opens a comment
  that can be sent to Claude), Script (one card per beat, timed at his pace
  against a 90-second target, with joke options), Mocks (cover with his face,
  the two receipts, the nerf timeline, the ladder, the subsidy bars, the
  carousel and the storyboard). Content is in the page's database
  (`piece/meta`, `piece/body`, `piece/script`, `piece/mocks`, `decisions/*`),
  so a session updates it with ArtifactData and the page refreshes itself;
  his picks are read back from `decisions/*`. This session watches it for
  comments sent to Claude. **Waiting on Krish:** his picks in the Decide room.
- 2026-10-09, later: **Friday's piece is drafted along the recommended lane,
  with the full creative menu and costs for Krish to choose from.**
  `docs/plans/2026-10-09-who-picks-your-ai-creative.md` is the menu (six
  angles, seven titles, seven cold opens, seven visuals, six video shapes,
  the personality options, the Call and its market, distribution stunts, and
  four cost levels from $0 to a day of filming). `2026-10-09-draft-body.md`
  and `2026-10-09-draft-script.md` are the drafts: the body passes every
  mechanical publish check except the fact gate, which needs the engine key
  and his cap; the script passes the story check at about 100 seconds. The
  SemiAnalysis article's own open text is now on hand through Firecrawl, so
  the piece quotes it word for word; the $20-plan dollar figures are behind
  its paywall and are not used. Gemini is placed and proven. Polymarket's
  search endpoint was wrong in the engine and is fixed; no market matches the
  Call, so the menu offers a Manifold market. **Waiting on Krish:** the five
  decisions at the end of the menu, then the paid fact check, record, pack.
- 2026-10-09, night: **the engine is wired for the 100x world and merged to
  `main`.** On Krish's "prepare and harden the entire engine as though all of
  this exists permanently": the scoreboard that keeps score is built (pin a
  Call to a Polymarket or Kalshi market at `/api/content-ideas/:id/call-market`,
  the `signals_odds` cron reads it daily, `/api/calls` serves every published
  Call with our confidence and the market's odds); the news-velocity sweep is
  built (`signals_news`, GDELT and Hacker News for every piece in play, a board
  warning when a subject doubles in a day); the on-camera voice rule
  (`VOICE_ON_CAMERA`) is live in the writers, judges, final pass, the story
  check's sixth point, a soft block in the Studio and a warning in
  `story_check.py`; a Gemini judge that can watch a cut
  (`scripts/signals/video.py`, needs `GEMINI_API_KEY`); Exa and Brave were
  already read by the research chain and now have the keys; X has a reader.
  Every check passes (typecheck, control-plane typecheck, tests, all 28
  control-plane guards, secrets, public copy). **Waiting on Krish:** rotate the
  four keys that were pasted in chat; a `GEMINI_API_KEY`; pin Friday's Call to
  a market once it is published; approve the piece-2 plan.
- 2026-10-09, later: **the outside tools are wired and the 100x plan is
  written.** `scripts/signals/collect.py` reads four free public sources
  (prediction-market odds, GDELT news velocity, Hacker News, SEC), tested
  live. Exa, Brave, the X API and the Hacker News value are placed in the
  content-engine Vercel env (`EXA_API_KEY`, `BRAVE_API_KEY`, `X_BEARER_TOKEN`,
  `HN_ALGOLIA_KEY`); **they were exposed in chat and must be rotated**
  (`docs/INTEGRATIONS.md`). `docs/ENGINE_100X.md` is the standing plan: every
  tool, every plausible use, and the combinations that are actually 100x (the
  scoreboard that keeps score against the market, the pile-on proven from
  GDELT, the fact gate with three checkers). Everything merged to `main` on
  Krish's command. **Next to build:** the scoreboard-odds feature (keyless),
  a cheap Gemini video reader, then the Exa/Brave/X readers.

- 2026-10-08: **Friday's piece is planned, waiting on Krish's yes.** Plan:
  `docs/plans/2026-10-09-who-picks-your-ai.md`. Piece 2 is rebuilt around the
  SemiAnalysis report of 5 October behind the screenshot Krish sent ("Same
  $20, five times the AI"), with the counter-evidence early (the gap is a
  middle-plan result; Artificial Analysis puts a finished task at $5.98 on
  Opus 5.5 against $0.72 on GPT-6.1 Sol), both companies' quiet changes from
  his "Upgrade Treadmill" research (two errors in that doc are noted in the
  plan), the three questions, a receipt picture and a plan slider. The call
  stays at 75%. **Waiting on Krish:** the angle, the title, and a cap for one
  paid fact check. This session had no engine key, so the board was not read
  or updated; the next session with the key should add the plan to the board.
  Then, on Krish's ask to take the engine up a level: `docs/TOOL_BANK.md`
  holds every way each paid tool could add to the engine, with a status that
  moves only on evidence, and the plan has a "Taking the engine up a level"
  section: the news wall for velocity, Reddit as the room, YouTube as a clue
  mine, a proposed `VOICE_ON_CAMERA` rule for scripts with opinion and dry
  wit, and an eight-step post-production list. **Waiting on Krish:** one yes
  for the tools and their ceiling, and the script rule.
- 2026-10-07, night: **ready for tomorrow's Friday planning.** Engine live at
  `main` (`16e40b4`), health ready. Friday 9 October is mind.the.gap piece 2
  (`904658db`, approved, draft of 2026-09-25): fold in the model-names
  research Krish dropped in Drive, fact-check the new numbers, then build the
  launch set the same way as Higgsfield. What changed today, all on `main`:
  - Drive: Krish moved `makeyourmindup` to `Ventures > Active`, with
    `Video Engine` inside it ("the moves were made on purpose"); every path,
    both machines' environment and both READ MEs follow (`docs/DRIVE.md`).
  - Recordings reach a cloud session by themselves from either runner
    machine: `python scripts/post-pack/recording.py get NAME`.
  - quick-edit: the logo opens every tall video; known mishearings
    ("Bike Dance") are fixed in every caption; a restart is cut by its time.
  - Pictures: nothing may run off an edge (`edge_check.py` in the pack,
    `card.py` before a PNG). Substack's social preview box wants 1200 x 630;
    the pack does not make one yet (made by hand for Higgsfield).
  - The call is marked right, wrong or too close to call, everywhere.
  - makeyourmindup.ai: YouTube live (`@makeyourmind-up`, Krish's handle; the
    clean one was taken), the newsstand lists articles only and refreshes
    every 15 minutes, the scoreboard is a labelled example board until the
    real one has calls to count, and a Meet the judges button.
  **Waiting on Krish:** change "held, broke or unclear" to the new words on
  the two published pieces in Substack; replace the 16 one-off docs in Drive
  with the reworked scripts (`docs/one-offs/scripts/`). **Next to build:** a
  warning on the board when library files wait over 30 minutes (the sync
  stalled 18 hours unseen); the 1200 x 630 social preview in every pack.
- 2026-10-06, night: **the Higgsfield video is edited and the recordings
  lane is live on both machines.** Krish recorded from script v4; the cut
  (restart at 3:02 removed, 3:38 to 3:04), six graphics, captions and end card
  are in the post's `3 Video` folder with YouTube words v2
  (`editions/2026-10-higgsfield/video-kit`). The recording first had to be
  sent by hand: the Drive connector stops at 10 MB and no route existed. Krish:
  "figure out how to never make that error again", then "just use whichever
  machine is online". Now `scripts/recordings-upload.ps1` runs on both runner
  machines (installed by Krish, 2026-10-06) and any session gets a recording
  with `python scripts/post-pack/recording.py get NAME`. The Studio script
  station is at version 3 and refuses a short-native script that fails the
  story check (`storyArcIssues`), on Krish's "Do this task here ... and then
  merge to main". **Waiting on Krish:** publish Wednesday's set.
- 2026-10-06, late: **every script now has to tell one story** (walk log
  F75, closed). Krish found the Higgsfield script unsayable, then that
  version 2 never set up "you don't do paid", had takeaways that did not follow
  and ended on 85% with no outro. He approved the five-point story check
  ("happy with that idea") and asked that the system never do it again.
  Built: house rules FOR_THE_EAR and STORY_ARC (writers, judges, final
  pass), every `_video.ts` shape now ends question answered, call, spoken
  outro, and `scripts/post-pack/story_check.py` refuses to pack a script that
  fails. The Sora facts are now in the article and passed the fact check
  (49 claims, 0 blocking). The corrected article pages, script v4 and
  LinkedIn v3 are in the post folder. **Waiting on Krish:** the same approve,
  record and publish as below, from those files. **Next:** the 16 one-off
  scripts fail the story check and are being reworked, and the Studio script
  station still needs the same check.
- 2026-10-06, evening: **Wednesday 7 October is "Higgsfield, taken apart:
  the $1bn AI video machine"** (under.the.hood, `9ae1a768`), in place of
  Koa, which Krish turned down as boring (walk log, end of "Piece 3"). Built
  on his own research from the Cold Ideas & Inspo folder; he chose the title,
  85% and the paid fact check ("Title 2. 85%. And yes"). Fact check passed,
  37 claims, 0 blocking, after the piece took Krish's three questions
  (walk log F74). The whole launch set is in the library under `3 Posts` and
  was sent in chat: the cover carries his face and is also the LinkedIn
  picture, and both explainers carry the companies' real logos. **Waiting on Krish:** approve it, record the
  video from the script, paste the Substack copy and cover, publish, and post
  the LinkedIn post with the cover (link in the first comment). Any change to
  the body needs the fact check run again. **Next to build**, each shown to
  Krish as exact wording before it changes anything live: the shift to
  fascinating subjects in the judges and the three channel briefs, idea
  sources pointed at AI creation, and the Cold Ideas scan reading whole
  documents and Word files. Then F73: check the launch set's words against
  the passed body before packing (three slips were caught by hand today).
  Friday 9 October stays mind.the.gap piece 2 (`904658db`), with the model
  names research Krish dropped in the folder folded in and its new numbers
  fact-checked.
- 2026-10-06, later: **the Drive library sync is merged** (walk log H42),
  on Krish's "yes, merge the library sync to main". Its private store is in
  the database. **Waiting on Krish:** on the always-on machine, run the
  three install lines in `scripts/post-pack/README.md` ("Install it, once"):
  they make the sync its own copy of the repository, `library-source`, and
  install from it. The first try ran the bare `-File
  scripts\install-library-sync.ps1` from a folder where that file did not
  exist, and PowerShell could not find it. All 33 files for the channel art and
  the first two posts (the launch and Who gets paid) are in the store, the
  two tall videos too since Krish raised the storage upload limit to 500 MB,
  and wait there until the sync writes them.
  **Also waiting on
  Krish:** send the Maven email (sent in chat as one copy page, made with
  `scripts/pages/broadcast.py`, H41), and swap Monday and Wednesday in the
  free welcome email, which still has the old order.
- 2026-10-06, Drive and one-off scripts (Claude Code, cloud). Krish asked for
  `04_Content` in Drive to be organised, for the whole system to know where
  things go, and for one-off main-channel scripts. Done: the four film folders
  sit in one `Films` folder with plain names; `Sales Materials` and `One Off
  Content Ideas` have READMEs; a "READ ME FIRST - what goes where" file sits at
  the top of `04_Content`; `docs/DRIVE.md` is the map, linked from `AGENTS.md`
  and `README.md` here and from the other three repositories' `AGENTS.md`.
  `Video Engine` and `makeyourmindup` were not touched (path-bound, F63).
  Sixteen scripts plus an index are Google Docs in `One Off Content Ideas`;
  source and research in `docs/one-offs/`. A new email signature (draft v1) is
  in `Sales Materials > Email signature`; its banner is on the makeyourmindup
  branch `claude/relaxed-dirac-ubqur0` and goes live at
  makeyourmindup.ai/brand/ when that branch merges. **Waiting on Krish:** a
  yes or changes on the signature and the scripts; dropping the banner PNG and
  preview (sent in chat) into the signature folder.
- 2026-10-06: article 1, the Who gets paid video post and the launch post
  are live on Substack, and Krish says the videos are posted, the Drive
  folders are back and the schedule is pasted ("done all the things waiting
  on me"). **Waiting on Krish:** two covers in Substack (article 1 still shows
  its old 1200 x 630 cover; the launch post's cover is the Monday card), both
  sent in chat as 3:2 covers that pass the crop and phone checks; one line for
  the welcome email, because Outlook hides pictures from a new sender (walk
  log F66; the line is in makeyourmindup's `apps/cover/substack-kit/COPY.md`);
  a yes, or not, for the address change in the `mindmake` canon and
  `ai-harness`. **New:** every finished video is archived in a folder named
  by date, subject and where to post it (H40). To file the two launch
  videos, on a runner machine: `python scripts/quick-edit/archive.py --subject
  "Who gets paid" --date 2026-10-05 --tall <tall file> --wide <wide file>`,
  and the same with the hello (subject "Launch hello" until Krish names it).
- 2026-10-05, closing the launch-day session. **Wednesday 2026-10-07 is
  under.the.hood, so it is piece 3** (Salesforce's Koa, `5255dcd8`):
  approved, fact check passed, call "By 30 September 2027" at 55%. Settle
  three things with Krish before building its launch set, all written out at
  the end of "Piece 3" in `docs/walks/2026-09-three-piece-walk.md`: the final
  pass said the title promises a fork the body never covers and the reader's
  "what do I build" is left implied; four house rules arrived after he
  approved it; and nothing is made from it yet. Then make the set in the
  session, the way he asked to work: `scripts/pages` for the branded page and
  the Substack copy, visuals that each explain one point, a video script for
  him to record, `scripts/quick-edit` for the edit, the engine's `package`
  step for the YouTube and Substack titles and descriptions, `scripts/pages --cover`
  for a cover that survives Substack's crops, `scripts/pages/card.py` to check
  any artwork reads on a phone, and the LinkedIn post. Friday
  2026-10-09 is mind.the.gap, piece 2 (`904658db`, approved).
  **The publication lives at `home.makeyourmindup.ai`**, shipped everywhere on
  2026-10-05 once Substack switched it on (the cover's Subscribe button and
  feed, Control Center's tracking and its migration, the engine, the AEO
  engine); tracking keeps the old address as an alias. Article 1 and the
  Who gets paid video post went live on Substack the same day. **Waiting on
  Krish:** swap in article 1's new 3:2 cover (the second one sent in chat, which
  reads on a phone; Substack cut the old one on every screen, walk log F64); publish the launch post with the
  hello video; paste the new schedule into Substack; put back the Drive
  folders the clean-up moved; a yes for Claude to change the address in the
  `mindmake` canon and `ai-harness`. Findings from the day are F58 to F65 in
  the walk log. Open: F61 (Ship's refusal is only a pop-up) and F63 (nothing
  protects the Drive folders the OS reads by path), both in control-center,
  and article 1's explainers, which read small on a phone (F64).
- 2026-10-05, evening: both launch videos are edited and with Krish (the
  hello and Who gets paid, each tall and wide). He recorded them and shared
  them by Drive link; the edit was done in the agent session with the new
  `scripts/quick-edit` tool, whose settings for both are in
  `editions/2026-10-launch/video-kit/`. Chat uploads stop at 30 MiB, so he
  has share copies made with `--share-mib 29`; the full-size masters were
  only in that session. A re-record runs through the same configs:
  `--plan` first, then render.
- 2026-10-05, later: the schedule is now Monday follow.the.money, Wednesday
  under.the.hood, Friday mind.the.gap, in Krish's words "Let's just make follow
  the money permanently a monday thing, and swap it out". It is changed in all
  three repos, the database's day labels and the live site. Substack's short
  description, About page, welcome email and free-benefit line need Krish to
  paste the new text (board item `you-substack-schedule`), and the Windows
  runner needs a `git pull` before its next render. Krish also asked to work
  in the agent session while the engine is built: pieces and their artwork
  are made there as branded HTML and image files, and Control Center is for
  locking and publishing only. Article 1 passed the fact check with his
  rewritten opening (62 claims, 0 problems). Its branded page, the launch post
  (a visual page and a one-column Substack copy) and two video scripts (a hello
  for the launch post, and Who gets paid) are linked from the board.
- 2026-10-05: Article 1 is the launch piece, rewritten deeper at Krish's
  request ("why they get paid for different things ... the incentives ... where
  the consumer or merchant could get stung"), with his practical sections kept
  word for word. It passed the fact check on the fifth run (59 claims, 0
  problems) and is in review. Locking it is Krish's, in Control Center. The
  launch kit (a private artifact linked from the board item
  `you-launch-today`) holds the Substack title and subtitle, the article with
  three images and 28 sources linked, the launch post, the LinkedIn post and
  card, and the video script. Nothing is published. After he publishes, he
  sends the link; the makeyourmindup.ai scoreboard and the move from Issue 00
  to Issue 01 need his yes. What the fact check taught is walk log F56. The
  article supersedes the 2026-10-04 notes below.
- Krish read the current Article 1 revision on 2026-10-04 and said, "ok,
  happy with this article". Treat that as his taste approval of the exact
  wording he saw. His decision is recorded in the edit ledger against that
  body. The engine correctly refused the official approval state because the
  practical section was added after the last fact check. Authoritative
  readback still shows the article in review with no production approval. No
  paid check ran and no video job exists. Krish approved pushing the no-cost
  counter correction, it is live, and the production readback now establishes
  the exact scope: 61 reusable sentences and 31 fresh sentences. Running one
  paid truth check with a hard cap of 31 is the next decision waiting on him.
- Three timed jobs that failed on every run are fixed and merged. The Sunday
  job that turns Krish's edits into suggested rules had never saved one because
  each suggestion lacked the list of edits behind it, which the database
  requires. It now attaches them. The Friday shift spotter now writes the
  current channel names instead of retired ones. The Saturday build-signals
  job now says why it fails. Krish said on 2026-10-04 that the GitHub key in
  this engine's Vercel project is fresh. Nothing further is waiting on him for
  that key; the next scheduled job is the proof that build signals now fill.
- Krish's current correction for Article 1 is that its true value is the
  practical implication for a business leader or consumer: what business to
  build, which features matter, what to be wary of, and what a shopper should
  demand. One section now makes a single commercial call: build the authorised
  front door between agents and merchants. It names the likely customer, the
  metric, the merchant and shopper controls, the trust features, the platform
  risk, and the consumer test. The advice is clearly judgement rather than a
  new fact. The revised article is saved and visible in Control Center. Its
  deterministic checks pass, including reading age about 12. Because the
  words changed, the earlier passing fact check no longer covers the current
  body. The free preview reports 61 reusable sentences and 31 new sentences.
  No new paid check has run, the article is still in review, and no video job
  or public post exists. Krish now needs to say whether the new section is the
  value he meant, or what still needs to change. He has now said it does. This
  ruling, his approval and the handoff are recorded in the local documentation
  commit. Krish approved pushing it with the no-cost counter correction on
  2026-10-04. The correction is live and production still reports 61 reusable
  sentences and 31 fresh ones. No paid check has run.
- Krish approved Article 1's clearer wording on 2026-10-03 and made clarity a
  critical rule for every future article. Every sentence must have one clear
  reading. When an unfamiliar mechanism needs help, use a factual historical
  parallel, a familiar analogy or a clearly signposted comic exaggeration that
  does not change the fact. These instructions are now engine house rules for
  writing, checking and visual planning. All 1,107 tests and the repository's
  type, skill, station, renderer, public-copy and secret checks passed.
- Krish approved the two safeguards and exactly one more Article 1 fact-check
  run on 2026-10-04, conditional on learning how to avoid repeated paid checks.
  Both safeguards are live. Article 1's four failed lines were repaired in one
  exact edit: two unsupported details were cut, and the two dated contrast
  sentences became plain source-backed statements. The free preview reported
  59 reusable sentences and four fresh sentences. The run used a hard cap of
  four, ran once and passed with no blockers. It covered that exact earlier
  body only; the later practical-value revision above means it no longer
  covers the current article. No production brief or video job exists, and
  nothing has been published.
- The repeat-spend cause and prevention are now durable. The earlier result
  predated the sentence ledger, and the paid route offered no preflight or hard
  scope ceiling. The live route now reports settled versus fresh sentences and
  refuses before any model or web call when the fresh scope exceeds the
  approved cap. The capped Article 1 run proved the guard on a real piece.
- The post-run readback exposed a smaller bookkeeping gap: short scenario
  labels, such as "Guess one.", could not settle by fuzzy matching. The live
  correction now lets exact short matches settle and fills deterministic
  ledger gaps from a successful check of the exact current body and sources.
  The full repository verification passed: 1,109 tests plus the type, skill,
  station, renderer, public-copy and secret checks. Production still reports
  61 reusable and 31 fresh sentences for the current Article 1 because its new
  section was added after the older check. The correction prevents this leak
  on future exact results; it does not rewrite an older ledger after the body
  changed. No paid check ran.
- The board failed to render in an already-open tab after a deployment because
  the old app shell requested a route file whose hashed name had been replaced.
  Its Retry button retried the obsolete request; a full reload restored the
  board. The fix is live: Retry performs that full reload only for this class
  of stale-file failure. Its production deployment is ready, its live build
  identity matches the pushed fix, and the board renders after reload. The
  dependency install reported 64 existing audit findings; this narrow recovery
  repair did not change unrelated packages.
- Krish said he is ready to watch the sample. A tracked Studio session found
  no Article 1 video job or review, recorded his relatable-explanation feedback
  without the surrounding chat, and closed cleanly. The Windows runner creates
  that job only after the exact article passes the truth gate and its approval
  is recorded. The first output is a governed phone review.
- Krish agreed to the outside-tools plan. Shape the stack only after real video
  results exist: post the first pieces by hand, collect YouTube results, then
  choose tools from the evidence. No purchase has been made. Runway remains one
  capped illustration test, Higgsfield may be one evidence-checked judge, and
  Native stays out because it would bypass his approval.
- The earlier work remains complete: Article 3 is approved but unpublished;
  the access fix and the timer-judge cost cut are live and verified; elegant,
  exact-artifact feedback at every phone review step remains active Studio
  work.

## What costs money

Krish pays for the model only when the engine calls it. A session's own
thinking runs on his Claude or Codex subscription. Measured over the 14 days to
2026-10-02 (`meter_daily` in the database):

| What | Cost |
|---|---|
| Judges scoring new ideas on a timer | $39.34 |
| Control Center's people, growth and strategist features | $17.87 |
| Fact checking (mostly repeated checks on articles 1 and 3) | $15.06 |
| Writing and rewriting articles | $2.52 |
| Everything else on the model | about $11 |
| Apify (LinkedIn and job scraping, not the model) | $33.10 |

Writing is cheap; keep it in the engine, where Krish's rules and his edits
teach it. The timer judges are the biggest cost and run whether or not anyone
is working. Before you run anything that spends, check this table is still
true.

One Article 1 fact-check run completed on 2026-10-03 after this table's
measurement window. Its exact meter delta has not yet been read back.
