# Workbench: where we are and what's next

This is the one file every working session reads first and updates last,
whatever tool it runs in: Claude Code (web, desktop or phone), Codex (cloud or
desktop), or anything else that can open this repository. It is how work moves
from one tool to another without anything getting lost. The rules for agents
are in `AGENTS.md`; this file is the live state of the work.

Last updated: 2026-10-12, about 15:30 UTC, by a Claude Code session (cloud).

## How Krish wants to be worked with

- Plain words. Nothing he reads may contain codes, labels, hashes, version
  numbers or project shorthand. Say what happened, what it means for him, and
  what you need from him. If a sentence would confuse someone outside the
  project, rewrite it.
- After everything you do, update the board (below), and end every reply to
  him with its link: https://controlcenter.krishraja.com/#/board. Update this
  file when how the work is done changes.
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
  `week-publish-board-2026-10-12`; Monday and Friday made, Wednesday
  picked, not made yet):
  https://claude.ai/artifact/RjLHJQi469BAKcvTCgneHV

Last week's publish board: none (the first board was made on 12 October).

## The board: what is waiting on Krish, in progress and done

The live list lives in the shared database, not in this file. Krish sees it in
Control Center at https://controlcenter.krishraja.com/#/board (phone or desk),
and what is waiting on him reaches his one list on Control Center's Home
(https://controlcenter.krishraja.com/#/home?waiting=1), where he clears, bumps
or purges it. Every session, in Claude Code or Codex, reads and writes it
through the engine:

- Read it: `python3 scripts/engine.py GET /api/workbench --full` (`python` on
  Windows). Any replies he has written are in `replies`; `unseen_replies`
  counts the ones no session has acted on.
- Add or change items (up to 50 at once; an existing item changes only the
  fields you send):
  `python3 scripts/engine.py POST /api/workbench @items.json` with
  `{"action": "upsert_items", "client": "codex", "items": [{"id": "p3-record", "lane": "on_you", "rank": 2, "area": "Article 3", "title": "Record both cuts from the scripts", "detail": "...", "only_you": "face", "link": "https://...", "link_label": "Open the scripts", "idea_id": "<the piece's uuid>", "closes_on": "record"}]}`.
  Lanes: `on_you`, `in_progress`, `done`, `archived` (hidden). Ids are
  lowercase words joined by hyphens. Links must start with `https://`.
- Change the headline or the status lights: `{"action": "set_state",
  "headline": "...", "signals": [{"label": "Home computer", "state": "ok",
  "text": "On and ready"}]}` (state is `ok`, `warn`, `bad` or empty).
- After you act on a reply of his: `{"action": "mark_seen", "ids": ["<reply id>"],
  "client": "codex"}`. The board then shows him that you read it.
- Only Krish writes a reply, from Control Center. The engine key cannot: a
  session must never put words in his mouth. Never leave an item waiting for
  one: Control Center is retiring the reply box, and an item on him ends when
  it closes itself or when he clears, bumps or purges it on his list.

Set `"client"` to `"codex"` or `"claude_code"` so the board says who changed it.
Write every item in plain words: what happened, what it means for him, and what
you need from him.

**An item about a piece names the piece, so it closes itself** (Krish,
2026-10-11: items "should really be chalked off automatically when we are
done with a publish flow"). Give it `"idea_id": "<the piece's uuid>"` and,
when one step finishes it, `"closes_on"`: a making step (`workroom`,
`draft`, `visual_gate`, `scripts`, `pack`, `record`, `video`, `publish`) or
`published`. The engine then moves it to done the moment that step lands on
the piece's making record, moves every item tied to a piece to done when its
publish step is done (the standing five ticked: Substack, YouTube, Shorts,
TikTok and Instagram; Krish, 2026-10-11), and archives them when the piece is
dropped (`apps/control-plane/api/_boardClose.ts`). The Substack post alone
closes only the items whose `closes_on` is `published`, so use `published`
only for an item about the Substack post itself; an item about the reposts
uses `publish`. A piece made before the making record existed (no step a
session wrote, at most the watcher's Substack tick) still closes everything
on the Substack post. The
publish watcher (`/api/publish/watch`, hourly) learns a piece is published
from the publication's own archive, so Krish never has to say so; a post
whose title matches no piece becomes one board question. A session that hears from Krish
that something is done, or that is not about a piece, still moves it itself.
Never leave an `in_progress` item behind you: when you stop, it is done,
handed on, or back on him.

**An item waiting on him reaches his list only when it is ready** (Krish,
2026-10-11: one list, holding only what he alone can do, what is prepared,
and what says how it closes itself). Give every `on_you` item all three:

- `"only_you"`, why only he can do it: `send`, `post`, `spend`, `delete`,
  `permission`, `credential`, `face` (his face and voice), `login` or
  `judgment` (his call).
- `"link"`, an `https://` link to the prepared thing he acts on (the script,
  the draft, the page), with a short `"link_label"` for its button. A typed
  answer is not a link.
- `"closes_on"` with the piece's `"idea_id"`, so the engine closes it when that
  step lands (above). The week's planning item uses `"closes_on":
  "week_planned"` and needs no `idea_id`; Control Center closes it once every
  day has a piece. A `judgment` item needs one of these closes too.

Control Center holds back an `on_you` item that lacks any of them: it is
counted and named on the board's held lane, never shown on his list. That
includes a job only he can do that nothing can see finished yet (a login, a
key only he can change), so say in its detail what would show it done.
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
> read the board and my replies on it. Tell me in plain words what is waiting
> on me and what you will do next, then do the top thing that is not waiting
> on me. Update the board and WORKBENCH.md before you stop, and end every reply
> with the board link.

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
words, and the `produce-video` skill takes it from there. Once this branch's
change to the lane is on `main`, the home computers also place each take on
its piece and cut by themselves at the end of every pass, and a take already
on a piece is fetched by the path its record holds
(`recording.py get "recordings/<sha256>.<ext>"`).

## Latest handoff

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
