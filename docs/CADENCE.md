# The weekly rhythm

**Publish boards:** follow `docs/PUBLISH_BOARDS.md` and `config/boards.json.web_cutover`. After verified active cutover, both weeks live at content.krishraja.com and all new board interactions use the authenticated web API. Older Claude board instructions in this document are preserved compatibility/history, not directions to synchronize artifacts.


Krish, 2026-10-11, superseding the Sunday, Tuesday and Thursday slates of 10
October: "We're going to enable planning for the whole week on a Sunday.
Every Sunday we're going to decide which of the three pieces are going to go
out on Monday, Wednesday, and Friday. We're going to get Monday's piece all
the way to iteration and the publish board, whilst leaving Wednesday and
Friday as topic confirmed and waiting on me to do the iteration workflow."
And of the questions he is asked each week: "I don't think there are too many
questions you need to be asking me every Sunday, other than: What are we
writing about this week? Here are your ideas and options. Do you want to drop
in any other ideas that we can flesh out?"

## The standing answers (never asked again)

Video is made with the ve engine (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`); the quick-edit path stays the fallback until ve passes Phase 3.

The render and filing steps below describe the fallback workflow. A schema 2 direction follows ve's protocol; it does not go through `kit.py` or `make.py`.

- **Two cuts, every piece** (house rule TWO_CUTS): a 5-minute video and a
  90-second version, each recorded from its own script with its own hook
  and outro. `story_check.py` holds the lengths.
- **Every piece goes to** Substack and YouTube, then YouTube Shorts, TikTok
  and Instagram (`docs/AMPLIFICATION.md`). LinkedIn, WhatsApp and Substack
  Notes stay available as optional steps.

## The week

Times are Krish's, in New York (`system_config.operator_timezone`).

| When | Where | What happens | Who |
|---|---|---|---|
| Sunday, early morning | A Claude Code session ("Plan the week" routine, `.agents/skills/plan-week`) | Copies the ending week's ticks onto the records; researches three or four options for Monday, Wednesday and Friday, fleshes out what he dropped in the Cold Ideas & Inspo folder, stress-tests them, and writes them onto the pieces (`/api/week/options`); then makes the week's publish board (`scripts/post-pack/week_board.py`): one private page with a tab for each day and a tick for every step, its link on the week's own board item `week-publish-board-<Monday>` (on him, at the top) and in `WORKBENCH.md`; the ending week's board stays read until every day on it is at 100% | Claude Code |
| Sunday, 8am (7am in winter) | The work board | One item asks the Sunday question and links to the week page (`control-center api/content/slate.ts`, refreshed every morning, done when all three days have a piece) | Control Center |
| Sunday | Control Center, the week page (`#/week`) | He picks a piece for each day, or drops in an idea to flesh out. A pick holds its day (scheduled_for) | Krish |
| Sunday, on the Monday pick | Claude Code ("Make a piece" routine, `.agents/skills/make-piece`) | Monday's piece is made through to its publish board: workroom, fact-checked article, visual gate, both scripts (each opening straight on the hook and closing on the deep dive line, held to a reading age of 12 and read back by two fresh readers, then sent to his teleprompter.com account: one folder for the piece, one script per cut), publish page, pack. The week's publish board is rebuilt with the picks and Monday's page and republished to its link, so its ticks stay | Claude Code |
| Monday morning | teleprompter.com on his phone or laptop, and his camera | He records Monday's two cuts, each read from its own script in Teleprompter, then drops each take as its own file at the top of the Video Engine Inbox (any name), the one way a take comes back. Then he tells Codex or Claude Code "I've recorded" | Krish |
| Within about 15 minutes of an Inbox drop | Whichever home computer is on (the recordings upload, every five minutes) | Each take reaches the engine, and the same lane places it on its piece and cut by itself (`recording_match.py --record --board --by "Recordings lane"`), stamped with the script it was read from; a take it is unsure of becomes one board item held for a session, never on his list (the session asks him in its reply) | the home computers |
| Monday, Wednesday and Friday, 12:00 | GitHub's machine, on its own (`.github/workflows/produce-day.yml`, `scripts/produce_day.py`; Krish, 2026-10-12: "GitHub always renders"); its Run workflow button runs it at any time | Waits for both takes on the day's piece, fetches them, the licensed music and the pictures from the engine, renders the story intro and outro for the piece, makes both cuts and their thumbnails, sends them to the post's `3 Video` folder (Library Sync puts them in Drive) and records them on the piece; a stop is one board item saying exactly what stopped. At 13:30 a Claude Code routine puts the videos on the day's tab of the publish board | GitHub, then Claude Code |
| Monday (before the midday run existed) | Codex on a home computer, or Claude Code there when he asks it (`.agents/skills/produce-video`) | Places any take still unplaced; both cuts produced with the intro sting once he approves one, the licensed music bed and a thumbnail for each size, and with the animated intro made for the story, its audio treatment and the animated outro card once he approves their design (house rule STORY_INTRO_OUTRO: until then production stops before the final render, saying "story intro and outro not designed yet"); filed in the archive and the post's library folder (`3 Video`) and onto the record | Codex |
| Monday | The week's publish board, Monday's tab | He posts in the standing order and ticks each step as he goes; each tick is saved at once on the board, and the next making session copies each channel tick onto the piece (`making.py <piece> posted <channel>`) | Krish, then the next session |
| When he is ready | The week page, Wednesday's and Friday's cards | "Make it in Claude Code" starts each one's making; it then follows Monday's path, on its own tab of the same week's board | Krish starts, Claude Code makes |

A day with nothing worth picking is a day with nothing picked; the options
never force a piece.

## Where completion is recorded

Krish, 2026-10-12: "Give me a tick box next to each one so I can tick as I
go and you can durably record that completion where it needs to be
recorded." It is recorded in three places, in this order:

1. **The week's publish board, at once.** His tick is saved in the board's
   own store (`ticks/<day>-<step>`; the article and YouTube links he pastes
   in `links/<day>`). There is one board a week, made on Sunday and
   republished to the same link all week, so a tick is never lost
   (`scripts/post-pack/README.md`, "The week's publish board").
2. **The piece's making record, by the next session.** At its start and
   again before it stops, every making session in Claude Code (`make-piece`,
   `plan-week`, `produce-video`) copies each channel tick onto the piece the
   board itself names for that day (`week_board.py --show`; a piece posted on
   Substack is published and is still its day's piece), with `making.py
   <piece> posted <channel> [url]` (`.agents/skills/make-piece/SKILL.md`,
   "The week's ticks"). It reads this week's board and last week's, until
   every day on last week's is at 100%. Codex cannot read the board, so the
   next Claude Code session copies for it. A Record tick is information
   only, because Record is done from the takes. An untick is told to Krish
   and never removed from the record.
3. **The board items and Control Center, from the record.** The Publish
   step is done once the standing five are on the record, which closes every
   board item tied to the piece; Control Center reads the record live.

A channel he ticks in Control Center goes straight onto the record, but the
week's board does not show it: the board shows only his ticks on the board.

## Who owns what, and where things live

Krish, 2026-10-11: "I'm going to transfer all video production iteration
through to Codex, whilst Claude will remain the overall place for initial
ideation, article creation and publish board building." Two tools, one
record, one rule: **a tool never writes a step it does not own.** The owner
of every step is in the record itself (`MAKING_OWNERS` in
`apps/control-plane/api/_making.ts`, mirrored in Control Center), so the
board, the strip and both skills read the same table.

| Step | Owner | Skill | Writes |
|---|---|---|---|
| Options for the week | Claude Code (Sunday routine) | `.agents/skills/plan-week` | `meta.week_option` through `/api/week/options` |
| The Sunday question and the pick | Control Center (cron), Krish | `api/content/slate.ts`, the week page | the work board's week item; the pick and its day |
| Workroom, fact-checked draft, visual gate, scripts, publish page, pack | Claude Code | `.agents/skills/make-piece` | `meta.making.workroom`, `.publish_manager`, `.visual_gate`, `.script_check`, `.pack`; the body through the engine |
| The read-back | Claude Code, at the Scripts step: two fresh readers, each an ordinary 12-year-old hearing the script once | `make-piece` ("The Scripts step", step 4), `making.py <piece> read-back` | `meta.making.script_check.read_back`: who read each cut, when, "nothing lost", and the hash of the words they heard |
| Scripts into Teleprompter | Claude Code, at the Scripts step, or any session that `teleprompter_send.py pending` shows a cut still to send | `make-piece` ("The Scripts step", step 6), `scripts/post-pack/teleprompter_send.py` | one folder per piece and one script per cut in his teleprompter.com account, then `meta.making.teleprompter` (the folder, each cut's script and title, and the hash of the words sent) |
| Record | Krish records, then drops each take in the Inbox; the home computers' recordings lane writes it, and the production session one the lane has not placed | `scripts/post-pack/recording_match.py --record`, run by `scripts/recordings-upload.ps1` at the end of every pass on either machine (`--board --by "Recordings lane"`) and in `.agents/skills/produce-video` | `meta.making.recordings`, each take with the hash of the script it was read from (`script_sha256`) |
| Video assets | Codex, on a home computer (Claude Code there too when Krish engages it) | `.agents/skills/produce-video` | `meta.making.video_assets`, each cut with its thumbnail and music track; the cuts and thumbnails in the archive and in the post's library folder (`3 Video`). Never the visual gate or the pack |
| Publish board with the cuts | Claude Code | `make-piece` (last step) | the publish page; and the pack again with the cuts (`build.py --replace`, which records Visual gate and Pack, then `send.py`) when the session holds the post's working folder and the cut files |
| The week's publish board | Claude Code: `plan-week` makes it on Sunday; `make-piece` republishes it whenever a day's publish page changes or a pick lands | `scripts/post-pack/week_board.py` | a new private artifact each Sunday, republished to the same link all week; the week's own board item `week-publish-board-<Monday>` and `WORKBENCH.md` carry the link |
| Posting and ticks | Krish ticks on the week's publish board (or in Control Center); a Claude Code session copies each channel tick onto the piece | the week's board; `make-piece`, "The week's ticks" | the board's own store at once, then `meta.making.channels` |

Where each thing lives, and nowhere else:

| Thing | Lives in | Reached by |
|---|---|---|
| The piece and its making record | the shared database, `content_ideas` | the engine's routes only (never SQL for a body, walk log F32); Control Center reads it live |
| The work board | the engine's `work_board_*` tables | `/api/workbench` on the engine key or Krish's cookie |
| The engine key | Claude Code cloud: a network secret bound to the engine's host. Codex cloud: the environment secret. Windows home machines: Credential Manager, read by `scripts/engine.py` | never a file, a chat or a commit |
| The runner's bearer | Credential Manager on each runner machine | the recordings and library lanes |
| Control Center's secrets (access code, cron secret, the routine's id and token) | Control Center's Vercel project | its own routes; the slate cron speaks to the board on the access-code cookie |
| Recordings | the engine's recordings lane (object store plus manifest), fed only from the top of the Video Engine Inbox | the home computers place each Inbox take on its piece and cut by themselves (`scripts/recordings-upload.ps1`, then `scripts/post-pack/recording_match.py`); `scripts/post-pack/recording.py get` fetches a take by its Inbox name or by the path its piece's record holds (`recordings/<sha256>.<ext>`); never the Drive connector (10 MB cap) |
| Scripts for Krish to read while he records | his teleprompter.com account: one folder per piece ("Mon 12 Oct follow.the.money - Who gets paid for AI songs"), one script per cut ("Mon 12 Oct - 5-minute - Who gets paid for AI songs"); and the publish page's Copy | each cut's script title on the piece's making record (`meta.making.teleprompter`), shown on Control Center's Record step ("Read from Teleprompter: <title>") and on the week's publish board. Sent at the Scripts step by `teleprompter_send.py`; words that change update the same script in place, and nothing there is ever deleted |
| The week's publish board and all decisions | content.krishraja.com, authenticated dated boards and immutable builds | each week's `week-publish-board-<Monday>` item and `WORKBENCH.md`; every tool reads all six collections with `board_web.py`, following `docs/PUBLISH_BOARDS.md` |
| Licensed music | Drive, `makeyourmindup > 00_Brand-Assets > 07_Music` (`MINDMAKE_MUSIC_ROOT`), each licence certificate beside its track; the ledger `config/music-library.json` in GitHub | `scripts/quick-edit/music.py` on a home computer; only approved ledger tracks, never browsed |
| The pack, the publish page, the finished cuts | Krish's Drive library, written by his own machine from the engine's library store | `build.py`, `send.py`; the Drive folder is the canonical copy for every tool and for Krish |
| The workroom and the publish page as artifacts | claude.ai | Claude Code and Krish only; a convenience view of what the pack holds. Codex and the runner never need them |
| Code, rules, skills | GitHub `main` of this repository, and of `control-center` | both tools commit small and pull first; the docs steward writes `NOW.md` and the log |

What could be misread, and what stops it:

1. **Both tools think a step is theirs.** The record carries the owner;
   each skill reads `making.py <id> show` first and stops at a step that
   is not its own: `produce-video` produces nothing for a piece whose
   Scripts step is not done, and `make-piece` never writes the video
   assets. `by` on every write says who wrote it (`making.py --by`, or
   `MAKING_BY`, which each skill's first step sets; `making.py` also tells
   Codex by itself).
2. **A Codex session is asked, in chat, to touch the article or the
   approval.** The produce-video skill names what it never writes. A
   decision Krish made in words is relayed with `decided_by: 'Krish'` by
   either tool, never invented.
3. **A link only one tool can open.** Artifact links open only in
   claude.ai. The pack in Drive is canonical, so Codex and the runner work
   from the folder; the strip shows both.
4. **A key in the wrong place.** The engine key is never in a repository,
   a file or a chat. Inside Codex's Windows sandbox it cannot be read: the
   skill says to run outside the sandbox with Krish's approval. In Claude
   Code's cloud the proxy adds it; the container never holds it.
5. **Two sessions start for one piece.** Control Center fires one routine
   per press and opens a live session instead of firing again. Codex has
   no trigger from Control Center: Krish telling it he has dropped the
   takes is its signal, `recording_match.py` works out which take is which
   piece and cut, and the record shows the session making it.
6. **The slate at the wrong time.** Krish is in New York
   (`system_config.operator_timezone`; the 10 October cron wrongly assumed
   Sydney). The slate cron runs every day at 12:00 UTC (8am New York in
   summer time, 7am in winter), puts the week's item on the board only when
   it is Sunday in his zone, and only refreshes it on other days. The
   planning routine runs at 6:47am New York on Sunday (CRON_TZ in the
   routine). When his zone changes, the routine's schedule moves with
   CRON_TZ; the slate needs no change, because the Sunday test reads his zone.
7. **A pack rebuilt without the gate.** `build.py --replace` runs the
   visual gate again, so a cut added without its logos declared refuses
   the whole pack. Only Krish's own words in `visual_gate_override` pass
   one through.
8. **A recording that never arrives, or never reaches its piece.** The
   lane sends every finished recording from whichever runner machine is
   on, within about ten minutes, and then places it (Record) by itself;
   a session fetches with `recording.py get --wait`, and a take already on
   a piece by the path its record holds (`recording.py get
   "recordings/<sha256>.<ext>"`). A take over 500 MiB never reaches the
   engine: `recording_match.py --inbox` on a home computer reads it from
   H:. A runner with no engine key or no pinned Python fails
   `install-recordings-upload.ps1`'s check, naming which; the other runner
   still places the take. A missing file is reported by step, never
   worked around through Drive.
9. **The row changes under a write.** The making route merges onto the row
   it read and is guarded on `updated_at`: a lost race comes back 409
   (`stale_row`) with nothing written, and `making.py` sends it once more
   before it reports the failure. Most other routes that write a piece's
   meta (the chat, revise, challenge, dive-deeper, score, materials, the
   fact check and others) read the row, wait on a model, then write the
   whole of meta back with no such guard. A stale copy of the making record
   in such a write is never put back over a newer one: the database keeps
   the newer record (trigger `content_ideas_keep_newer_making`, migration
   `20261012120000_keep_newer_making.sql`, live once applied), and the
   making route and the publish watcher stamp every new record later than
   the last. Those routes' own keys have no such protection, so run them
   one at a time (`AGENTS.md`).
10. **Drift between the two mirrors.** `scripts/check-make-handoff.mts`
    in Control Center fails CI when its step rules or owners differ from
    the engine's lines.
11. **A take of an older script.** Each script's words are hashed when
    they pass (`making.py scripts`), each cut keeps the time its own words
    last changed, and checking the same words again keeps those times (a
    record from before the hashes counts as changed). Each take is stamped
    with the hash of the script it was read from. When a cut's words change
    after Krish has recorded it, that take stops counting: Record shows
    "long cut recorded from an older script", `making.py scripts` asks him
    on the board, `produce-video` refuses the take, and `making.py recorded`
    will not stamp it as current without his words (`--krish-words`). A
    take recorded after the piece's record began (fixed on its first write)
    but before its cut's words last changed is asked about, never silently
    left alone; a change to one cut never makes the other's take look old.
12. **Two tools rebuilding the pack.** Only Claude Code writes the Visual
    gate and Pack steps. `produce-video` files the finished cuts and
    their thumbnails into the post's `3 Video` folder from the archive,
    only once each shape has its thumbnail and the visual gate passes for
    the videos and thumbnails, and never rebuilds the pack; `make-piece`'s
    publish board step rebuilds it with the cuts when it can.
13. **Teleprompter holds an older script.** When a cut's words change
    after they were sent, `teleprompter_send.py plan` updates the same script
    in place, sending only its text and duration, so Krish's font, speed and
    alignment stay as he set them. Every `make-piece` and `plan-week`
    session starts with `teleprompter_send.py pending`, so a change no
    session sent is caught by the next one that has the Teleprompter
    connector; a session without it says so and sends nothing.
14. **A second folder or a second script.** `plan` reads the making record:
    a piece with a folder there gets no new one, and a cut with a script
    there is updated, never created again. Before a create, the session
    lists what is there (`list_folders`, `list_scripts_in_folder`) and uses
    a folder or script of exactly that name instead. The four sends of 12
    October were made by hand: while `WORKBENCH.md` keeps their `making.py
    <piece> teleprompter CUT ...` lines and the record does not hold them,
    `pending` and `plan` print those lines and nothing else. A send that
    fails after `create_folder` is recorded with that folder (`record
    --folder ... --error`), so the next plan never makes a second.
15. **Something deleted, moved or overwritten.** Teleprompter has no delete
    tool, and the allowed calls (`config/teleprompter.json`) never include
    `move_script` or `update_folder`; an update never sends his font size,
    speed, alignment or timed speed, which are his to set.
16. **A script a 12-year-old could not follow** (house rule R7, the hard
    gate; Krish, 2026-10-12: "I can't even understand what I'm reading off
    the teleprompter. I thought we had hard gates for this?").
    `story_check.py` refuses a script with a spoken sentence over 20 words,
    more than 12 words a sentence on average, a reading grade over 6, a
    quotation over four words, or a word on its list (licensing, settlement,
    revenue, model and the rest) that its sentence does not explain, and
    `build.py` will not pack one. A formula alone misses a script that loses
    a child on its ideas, so two fresh readers hear each script once, and
    `teleprompter_send.py plan` sends no cut whose current words they have
    not passed (`script_check.read_back`).
17. **A script that does not close the way Krish ruled (2026-10-21).**
    The series line and "I'm Krish" are retired: a script opens straight on
    the hook. `story_check.py` refuses a script of a minute or more with no
    "Here's what I'd do with this info if I were you" beat in its last beats,
    or that does not end on exactly "The full deep dive is at
    makeyourmindup.ai." (house rule SCRIPT_CLOSE). `--series` is still
    taken, from `making.py scripts` and `build.py`, and no longer checked.
18. **A tick that never reaches the record.** A tick lives only on the
    week's board until a Claude Code session copies it, at the start and
    end of every making session; Codex cannot read the board. Each tick is
    copied onto the piece the board itself names for its day: the publish
    watcher marks a piece published once its Substack post is live, and
    that piece is still its day's piece (the week options' `scheduled`
    list keeps it too). A tick saved for another piece is not copied, an
    untick never removes a channel, and a Record tick never writes Record.
    Last week's board is read by every session until every day on it is at
    100% (its own item, `week-publish-board-<Monday>`, stays open till
    then), so a repost Krish ticks at the weekend still reaches the record.
19. **Two boards for one week, or a rebuild that loses the ticks or a
    day.** One board a week, its link on that week's item and in
    `WORKBENCH.md`. Every rebuild republishes to that link, which keeps
    every tick, because the store stays with the page and each tick's id
    depends only on its day and step. A rebuild given the board it replaces
    (`--previous`) refuses to turn a day it holds into not picked, and with
    `--live` refuses a made day without its publish page, so no tab loses
    its Copy cards while he is still posting. A new board is made only on
    Sunday, for the new week.
20. **A take recorded somewhere else.** Teleprompter records nothing, and
    Descript was retired on 12 October (Krish: "Descript is permanently
    gone"). A take reaches the engine only from the top of the Video Engine
    Inbox; a take he recorded in Descript before then comes in only when he
    exports it and drops the file there.
21. **A send that keeps failing.** A failed send is recorded with when it
    failed. `pending` holds back a cut whose last send failed less than six
    hours ago, unless its words changed or Krish says go (`--retry`), so no
    session sends on every start.
22. **A take recorded that is not in the store.** `making.py recorded`
    refuses a path the engine's recordings store does not hold; the take
    reaches the store when it is dropped in the Inbox and the lane sends it.
