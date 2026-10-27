# AGENTS.md

**Publish boards:** follow `docs/PUBLISH_BOARDS.md` and `config/boards.json.web_cutover`. After verified active cutover, both weeks live at content.krishraja.com and all new board interactions use the authenticated web API. Older Claude board instructions in this document are preserved compatibility/history, not directions to synchronize artifacts.


<!-- north-star:start -->
## Start route: every client, Claude Code and Codex alike

Codex reads no hooks and no `CLAUDE.md`, so the route is here (`docs/plans/2026-10-21-wednesday/FAILURE_REPORT_2026-10-24.md`):

1. `python3 scripts/check_failures.py`, then `WORKBENCH.md` and `NOW.md`.
2. Pick the one skill for the job and read it whole before acting: `.agents/skills/plan-week/SKILL.md` (Sunday ideas
   and the week's board), `.agents/skills/make-piece/SKILL.md` (a picked piece: story, scripts, creative direction,
   article), `.agents/skills/produce-video/SKILL.md` (cutting recorded takes).
3. Claude owns the words and the visuals: the story, the scripts, the article copy, every article figure and the
   creative direction (`docs/CREATIVE_DIRECTION.md`). Production renders only from a direction Krish signed;
   `kit.py` and `make.py` refuse anything else from 26 Oct 2026.
4. Feed the board through `week_board.py`'s inputs only; never a per-day feeder script (`npm run check:board-layout`).
5. Never publish, sign in to a publishing platform, or ask Krish for a login code. He publishes.
6. Never call anything ready from receipts: a separate reviewer watches and listens to the finished asset, and fact,
   transport and editorial status are reported separately.

## North Star: read it first, every session

This repository's North Star is [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md): an ambition Krish set that is not reached yet.

- Read it before any work, every session.
- Before you start, say which part of it the task moves. If it moves nothing, say so first and let Krish decide.
- Prefer the work that moves it furthest, and close by noting what moved.
- Check the North Star number and its urgency (U1 to U5) on the first line under "Where it is right now" in `NOW.md`, and push at the intensity [the harness contract](https://github.com/krishanraja/ai-harness/blob/main/contract/north-star-metric.md) sets for that level. Update it whenever you can measure it; a number nobody measures is U4.
- Only Krish changes it.
<!-- north-star:end -->

Rules for any agent working in this repository: Claude Code, Codex, Claude.ai,
ChatGPT or anything else. Read `docs/NORTH_STAR.md` first; it says what the
whole system is for, and every rule below serves it. `README.md` says where
everything is.

**Nothing a session makes lives only in its own container.** Krish, 2026-10-18: "in general ensure nothing is ever not accessible by another session, ever". Before you stop, commit what belongs in git (code, configs, specs, transcripts, small data) and send media and captures to the post's library folder (`scripts/post-pack/send.py FOLDER --as "3 Posts/<post folder>"`, files under `2 Covers and images` or `3 Video`), and say in `WORKBENCH.md` where each is. Nothing stays only in `.cache`, a scratchpad or a workflow journal.

**The publish board is fed, never shaped.** Krish, 2026-10-21: "the rest of the content engine needs to know how to feed it and not be permitted to change random parts of the UI and UX but feed it in the right way consistently. That applies to Claude and to Codex." From the week of 26 October every board has one layout (`config/board-layout.json`): five tabs (Ideas, Queue, Monday, Wednesday, Friday) and four steps in every day (Brief, Drafts, Record, Publish). Feed it through `week_board.py`'s inputs only (`docs/PUBLISH_BOARDS.md`, "The fixed layout"); never add a section, banner or style, never patch a built board. `week_board.verify()` and `npm run check:board-layout` (CI) refuse anything else, and a change to the layout itself is Krish's: there are no approval prompts for board edits; the layout is held by CI and changes only with his recorded words (Ruling, Krish, 2026-10-21). `scripts/check_board_layout.py` holds the hash of `config/board-layout.json` and `scripts/post-pack/tokens.css` and the board's structure in its snapshot, and fails until `--update --approved "Krish, YYYY-MM-DD: <his exact words>"` records the change with them.

**No Claude artifact, ever; engine work merges to main by itself.** Krish, 2026-10-19: "we are now retiring the Claude artefact permanently and we are working in content.krishraja.com for all published board updates ... Make sure the entire engine never ever Produces another artefact in the future and always pushes to that URL and merges to main automatically." Every board update (the week's board, a day's tab in draft, the workroom, a publish page) is built with `week_board.py --target web` (the default) and published with `board_web.py publish-web --apply` (`docs/PUBLISH_BOARDS.md`); `scripts/hooks/artifact_gate.py` refuses every Artifact publish and every ArtifactData write. Engine work never waits on a hand merge: run `npm run verify`, push the session branch, open a pull request and turn on auto-merge, so GitHub merges it to main once CI passes. Never push to main directly; a red CI is fixed on the branch. No session creates a scheduled task (a routine, a trigger, a cron) that builds, updates or publishes a publish board: Krish deleted those from both accounts on 2026-10-19 ("We are not ready for this yet"), and board updates happen only in a session he started, until he says otherwise.

**Cost: six standing rules.** Krish, 2026-10-18: "They should all become standing rules" (the six habits in `docs/COST_AUDIT_2026-10-18.md`; one six-day session read 1,086M tokens because every step re-read a 459k-token context). (1) One fresh session per job, started from its handover and stopped when the job is done. (2) Switch topics by writing the handover and starting a new session. (3) Fewer, bigger steps: one script, not five commands. (4) Keep big outputs out of the chat: never read a board into the conversation (the builder reads the saved copy), one contact sheet per output, quiet logs. (5) Sonnet for production work (renders, packs, filing, board rebuilds), Opus for writing and judgment. (6) Agents and workflows only for work that needs a separate reader. Before any paid run, estimate it from `meter_daily`'s last run, never from a count. The guards that will enforce these are in `docs/COST_GUARDS.md`. When Krish asks for files (Markdown, an export), hand him the files themselves; never also put them on a board or make an artifact (Krish, 2026-10-18: "I don't need these as artefacts. I need them as Markdown.").

**Start every session with `WORKBENCH.md`**: what is waiting on Krish, what is
in progress and what is next, and how he wants to be worked with (plain words,
no project shorthand). Update it before you stop, so the next session, in any
tool, picks up where you left off.

**Every visual, interactive or animation makes a critical point land faster.**
Krish, 2026-10-05: "The visuals need to explain something critical in the
article in a way that would help them understand the point quicker. this needs
to be a permanent rule, right now the visuals just feel like gimmicks". Before
you build one, write the point it carries and the reader's question it answers.
Build it from the piece's checked numbers, quotes and evidence, never from
figures or icons acting out an analogy. If a reader who sees only the visual
would not get the point, do not make it. The rule is `VISUAL_EXPLAINS` in
`apps/control-plane/api/_houseRules.ts`.

**Every post's assets go into Krish's asset library the same day.** Krish,
2026-10-06: "make sure the brand kit is always updated here [the library's
Drive folder]", then "I want every single asset in there, permanent and for
individual posts, categorized properly, clear what to use them for, and every
new post gets its own new folder with all assets including the article HTML I
can copy paste, video scripts, etc etc". Pack every post's launch set with
`scripts/post-pack/build.py` and send it with `scripts/post-pack/send.py` the
same day it is made, and send a brand kit change with `send.py --brand-kit`.
His always-on Windows machine writes them into the makeyourmindup folder on
Drive (`scripts/library-sync.ps1`). The architecture doc's rule 0a.5 says
agents never write into his Drive; this is his explicit instruction for that
one folder, carried out by his own machine, and it covers that folder only.
`scripts/post-pack/README.md` has the layout and the commands.

**content-watcher files fetched posts into his two inspiration folders.** Krish,
2026-10-24: "Yes to Drive filing". The second exception to rule 0a.5, and only
this: krishanraja/content-watcher, running on his home computers through the
synced Drive folders, adds the media of a link he pasted on the Inspiration
board to one of the two folders under `Ventures > Inspiration`, where his own
drops go, so the taste ledger makes its card: **Production Inspo**
(`1QxrzxISYFXq0er0DG0XSapm7qhvuRmh-`, production quality he likes) or
**Content Inspo** (`1FNztJOU82M8zb6IIbUAbvuI6Kr0pF5Hu`, the content he likes;
it was "Cold Ideas & Inspo"). Krish moved them there on 2026-10-24 ("Can you
ensure absolutely everywhere recalibrates to this moving forward first?");
`Video Engine > Inspiration` is gone. It only adds files: never deletes, never
overwrites, never renames, and a second fetch of the same post is a no-op. It
writes nowhere else in his Drive. Its queue is `apps/control-plane/api/watch/`
(content-watcher `docs/WATCH_API.md`).

**A recording in the Video Engine Inbox reaches a cloud session through
`python scripts/post-pack/recording.py get NAME`.** The Drive connector caps
downloads at 10 MB, so never tell Krish a recording cannot be reached; if the
lane fails, say which step failed: the recording has yet to reach the Inbox,
neither runner machine has sent it, or the download broke.
`scripts/post-pack/README.md`, "Recordings:
from the Inbox to a cloud session".

**The home computers place each take on its piece and cut by themselves.**
Krish, 2026-10-12: each recording "goes to the right place when recorded".
The recordings upload runs `scripts/post-pack/recording_match.py --record
--board --by "Recordings lane"` at the end of every pass, on either machine;
each take is stamped with the hash of the script it was read from, so a take
of words that have changed since stops counting, and every take it is unsure
of is one board item held in progress for a session, never on Krish's list
(a session works it out, or asks him in its reply). A take already on a
piece is fetched by the path its record holds: `recording.py get "recordings/<sha256>.<ext>"`.
`scripts/post-pack/README.md`, "Placing takes on the runners". This is the
one way a take comes back: Krish drops it at the top of the Video Engine
Inbox.

**Every video script opens straight on its hook, closes on what he would do,
and a 12-year-old can follow it; every article ends with "3 things you can do
tomorrow".** Krish, 2026-10-21: "we need to cut that opening line from every
content piece moving forward and just launch straight in to "I put GrokBot
and Muse head to head" etc. Also trim the closing to "the full deep dive is
at makeyourmindup.ai." right after a "Here's what I'd do with this info if I
were you" closing line. That needs to be the format moving forward for all
scripts. The articles all need to have a really clear "3 things you can do
tomorrow" at the end of every piece too." So a script has no series line and
no "I'm Krish" (house rule `SERIES_OPENER`, which retires the lines he
picked on 2026-10-12; they stay in `SERIES_OPENERS` in
`apps/control-plane/api/_houseRules.ts` only for records made under them).
After the call it closes on a beat that starts "Here's what I'd do with this
info if I were you" and says the actions, and its final sentence is exactly
"The full deep dive is at makeyourmindup.ai." (house rule `SCRIPT_CLOSE`,
refused by `scripts/post-pack/story_check.py`). An article ends with a
section headed "3 things you can do tomorrow" holding exactly three concrete
actions (house rule `THREE_THINGS_TOMORROW`, read by the publish check of the
same name). The tone in every series is observational, witty and positive,
with a dry Hannah Fry edge on true details only (house rule
`TONE_OBSERVANT_WITTY`; his words: "Generally yes - observational and witty
and positive are my general go tos"). The reading gate stays, from
2026-10-12: "I also feel like these scripts are too complicated for a layman
to understand. Every single script should be understandable by a
12-year-old. I can't even understand what I'm reading off the teleprompter.
I thought we had hard gates for this?" House rule `R7` is that hard gate on
every script: `scripts/post-pack/story_check.py` refuses a script that
breaks the close or the reading gate (`SCRIPT_READING`), and two fresh
readers, each a smart, non-technical manager at a 200-person company
hearing it once (Krish, 2026-10-19: "My customers are medium sized
enterprises"), must find nothing that loses them before it is sent
(`make-piece`, "The Scripts step"; `making.py <piece> read-back`).

**Each checked script goes to Krish's teleprompter.com account, and nothing
there is ever deleted.** Krish, 2026-10-12: "Also note that Descript is
permanently gone, teleprompter.com is permanently in, connected via MCP
here". Asked "May every checked script go into your teleprompter.com account
automatically, starting with Monday's two now?", he picked "Yes, automatic,
Monday now", whose terms were: "One script per cut, in a folder per piece
(e.g. "Mon 12 Oct follow.the.money"). When the words change, the same script
is updated in place. Nothing is ever deleted." The exact scope
(`config/teleprompter.json`):

- **The send**, by `make-piece` at the Scripts step, or by any session that
  `scripts/post-pack/teleprompter_send.py pending` shows a cut still to
  send: `list_folders`, `list_scripts`, `list_scripts_in_folder`,
  `get_folder` and `get_script` to look; `create_folder`, one folder per
  piece, only when its record holds none; `create_script`, one script per
  cut, only when its record holds none; `update_script` of the cut's own
  script with only its `text` and `duration`, exactly as
  `teleprompter_send.py plan` prints them, then `teleprompter_send.py
  record`.
- **Never**: `move_script` or `update_folder`; his font size, speed,
  alignment or timed speed, which are his to set; a second folder for a
  piece or a second script for a cut; and any deletion (Teleprompter has no
  delete tool). Teleprompter holds scripts only: a take comes back through
  the Inbox (the rule above).

Descript was retired on 2026-10-12, the day it was set up, in his words
above; no session calls it. Records written before then keep a `descript`
field that nothing reads.

**Web publish board migration (19 October 2026).** Full parity is implemented
behind the existing access code at `content.krishraja.com/board/<Monday>`.
Release is pending, not live: `config/boards.json` carries the web URLs and an
explicit `web_cutover` marker. Only after all four source exports, final delta
and authenticated acceptance pass does that marker become `active`. Then every
making session reads ticks, links, edits, picks, queue and comments through
`board_web.py read`; only the web board takes new interactions. Preserve the
Claude artifacts and artifact generator; no ongoing two-way sync. See
`docs/handovers/board-web-release.md` for approval gates and exact commands.
The artifact workflow below applies before cutover and to explicit legacy builds.

**The week's publish board is where Krish ticks; the piece's making record
is where it counts.** Krish, 2026-10-12: "Give me a tick box next to each
one so I can tick as I go and you can durably record that completion where
it needs to be recorded. That Publish Manager is what you create every
Sunday and let me iterate inside until we're done". The Sunday session makes
one board a week (`scripts/post-pack/week_board.py`, a private artifact with
a tab for Monday, Wednesday and Friday; its link is on that week's board
item, `week-publish-board-<its Monday>`, and in `WORKBENCH.md`), and a
session that makes a piece republishes it to that same link, so no tick is
lost and no day it holds is dropped (`--previous`). Completion is recorded
in this order: his tick is saved at once in the board's own store; every
making session in Claude Code (`make-piece`, `plan-week`, `produce-video`)
copies each channel tick onto the piece the board names for that day,
published or not, at its start and again before it stops (`making.py
<piece> posted <channel> [url]`; `.agents/skills/make-piece/SKILL.md`, "The
week's ticks"), reading last week's board too until every day on it is at
100%; and from the record Control Center's done-check sweep closes the
board items and Control Center shows it. An untick never removes a record. A Record tick is
information only: Record is done from the takes on the record.

**Every board item says how it ends; record the fact and the check closes
it.** Krish, 2026-10-11: "I think closing what you can check is already
done is one of the most obvious things I've ever heard of as a
suggestion", and "I am happy to Clear(complete)/Bump/Purge things off my
lists as I go but the rest should be automatically done." Every open item
you write states `closes_on` (and `close_ref` when its kind needs one): a
piece's step or `published`, the week's `week_planned` or
`week_published`, `share_image_changed`, `job_ok`, `post_matched`,
`take_placed`, `session` for work you hold, or `his_word` when nothing
can see it done (only Krish puts one of those on his list). Close only items
you hold (`closes_on` `session`); the engine and the database refuse any
other close from a session (`check_closes_it`), and turning an open item
that closes on a check's kind into `session` work (`kind_is_the_checks`).
A close or reopen you relay
from his words carries his exact words in `said`. Nothing in this
repository closes a board item but the board route, which takes a close
only from the sweep, Krish, or a session on its own work: a new kind of
close is a new check in Control Center's `api/_doneChecks.ts`, never a
closer here (`scripts/check-one-close.ts`). The rules and every refusal are
in `WORKBENCH.md`, "The board".

**`manual` means Krish's words; never write it.** A content idea with
`source_type` `manual` is one he said, filed by Control Center's one door
with `source_ref` `said:<said_parts id>`. Name your own source instead.
The engine refuses a `manual` idea without that ref (400
`manual_needs_his_words`), and so does the database: the CHECK
`content_ideas_manual_is_his_words` holds every row (validated 2026-10-20). No code under `apps/`
calls a transcription API: his spoken ideas come in through Control
Center's one door. Board
items whose id starts `said-` are filed by Control Center from his words,
and his notes about any open item come back on it as `said` from
`GET /api/workbench`: read them before you work the item, and never answer
them (`WORKBENCH.md`, "The board").

**Video production goes through `.agents/skills/produce-video`, and licensed
music lives only at `MINDMAKE_MUSIC_ROOT` with its ledger
`config/music-library.json`**; never browse Drive for audio.

**Codex on a Windows home computer:** run `scripts/engine.py` and `git pull` or
`git push` outside the sandbox, asking Krish to approve. The sandbox runs as a
separate Windows user that cannot see the engine key or reach the internet.

## What this repository is

The Mindmake content engine: the engine behind Krish's publication and the
Shorts and carousels made from it. Two halves share one purpose and one
database:

- **The content engine**, `apps/control-plane/`: ideation, curation, drafting,
  iteration, channel copy, production briefs and the learning ledger.
  `docs/CONTENT_ENGINE.md`.
- **The Studio**, `packages/`, `apps/runner/`, `apps/renderer/`: Shorts and
  carousels from approved briefs, on Krish's Windows machine.
  `docs/STUDIO.md`.

Control Center (`krishanraja/control-center`) is where Krish works. This
repository serves it and has no interface of its own.

## Say nothing twice

Krish, 2026-10-17: "everything I say to you, whether it's feedback or ideas,
you should always be thinking about why I'm saying it and what that means for
the future. I want a "say nothing twice" policy in this engine, where you
understand me, how we work, and how we iterate."

So every message from him is read three ways before anything is done with it:
what he asks for now, why he is saying it (what went wrong, or what he wants
that he did not get), and what it changes from now on. The last two become one
entry in `config/learnings.json`: his exact words (an excerpt, never a
transcript), why, what it means from now on, and every place it is now
enforced, each with a marker (a house rule, a check that refuses, a skill
step, a lesson a tool prints). A failure he raised goes in
`config/failures.json` instead. `python3 scripts/check_failures.py`, run first
in every session, fails when a marker is gone and lists what is still open.
Before writing or proposing anything, read the learnings that bear on it, so
he never has to say it again. His own example, the first entry: titles,
headlines and thumbnail words are signed off after he records, because "only
after recording do I really feel like I've got a message".

## Rules for every agent

- **Krish decides.** Approve, drop, publish, and every choice of taste are
  his. The engine and its agents propose, show their reasoning, and leave him
  the decision.
- **Your own actions are observations.** On the content engine an operator
  session's rows are `observation_only` unless it relays a decision Krish made
  in words, with `decided_by: 'Krish'`. Never relay a decision he did not
  make, and never write that he expressed a preference he did not state.
  Silence is not feedback. What he typed is his: an exact quote of words he
  typed, in any session or on any page, counts as his words, his view of what
  should be done with that content (Krish, 2026-10-24: "exact typed quotes
  count as my opinions on what I think you should do with that content"). A
  paraphrase, a summary or an inference stays an observation.
- **Every durable taste or performance rule needs explicit user approval.** A
  rule is proposed, may be trialled, and becomes active only when he approves
  it and it lands in code or configuration.
- **Check before you ask.** Before putting a question to Krish, check whether
  an earlier answer already covers it, read for its reach rather than its
  literal wording. A question his feedback already answers is not asked
  (Krish, 2026-10-24: "If you read what I am feeding back, it's pretty
  obvious what it is"). On mobile, ask in a plain message.
- **Public publishing is never automatic.** YouTube is private-only; LinkedIn,
  TikTok and Instagram Reels output stays a local draft package; the content
  engine never posts.
- **Truth, rights, confidentiality, meaning preservation and canonical naming
  are hard gates.** Never invent a number, a quotation, a source or an
  attribution; label inference as inference.
- **The mandate is the test.** Each subchannel's mandate lives in
  `venture_formats.mandate` and is read live. Never copy a mandate, the voice
  block or the corpus into code, a prompt or a document.
- **Voice.** Plain English and no em dashes in anything public. No "Not X, Y"
  construction in any piece, in either order (rule R2, Krish, 2026-09-24: "Cut
  it everywhere").
- **Spend.** Stay inside the amount Krish approved for the session and check
  `meter_daily`. Research through Perplexity, Exa and Brave is not metered, so
  count it yourself.
- **Drive folders are load-bearing.** Read `docs/DRIVE.md` before you put
  anything in Google Drive or move, rename or tidy a folder there. Folders are found by ID,
  never by path, wherever the API allows it (Ruling, Krish, 2026-10-24); the
  home computers still reach `Video Engine` and `makeyourmindup` through `H:`,
  so a move needs its new path in `config/studio.json` `runtime`.
- **Leave the knowledge in the repository.** What you learn about the engine
  goes into `docs/STATE.md`, `docs/walks/` or the document it corrects, never
  only into a chat.

## Names

The publication's subchannels are **follow.the.money**, **mind.the.gap** and
**under.the.hood** (`follow_the_money`, `mind_the_gap`, `under_the_hood`). The Money
of AI and Built with AI were retired as subchannels on 2026-09-17 and survive
as aliases in `format_aliases`.

The Studio knows the three subchannels as series (`follow_the_money`,
`mind_the_gap`, `under_the_hood`) since 2026-09-26, and keeps **The Money of
AI** and **Built With AI** (`money_of_ai`, `built_with_ai`) valid for records
made under them: they sit inside hashed and signed records, so never rename,
drop or rewrite them (`packages/contracts/src/series.ts`, `docs/STUDIO.md`).
`paid` and `built` are its import aliases only. Wordmarks for the three
subchannels are Krish's decision; until he approves them a branded render
refuses. Every other retired name is in `docs/GLOSSARY.md`.

## Content engine invariants

- Every route that writes or spends is guarded: `guardEngine` for the idea,
  ledger and judge routes, the cron guards for scheduled jobs, the runner and
  MCP guards for the Studio. A new route never uses `preamble`, which checks
  nothing. The routes that still do are a known risk (`docs/STATE.md`).
- `content_edit_events` is append-only, enforced by a trigger. A wrong row is
  corrected by a new row or a note in the walk log, never by an update.
- Most routes read a row, call a model, then write the whole `meta` back. Run
  such calls one at a time, and guard new writes on `updated_at`.
- Draft, revise, final pass and the draft judges read the subchannel's
  mandate; a new drafting or checking stage must too.
- The content engine owns new DDL for content and Studio tables; add it under
  `supabase/migrations/`.

## Studio invariants

- Control Center is the governed mobile review surface. Codex may orchestrate
  the same versioned contracts, but the Windows runner must operate without a
  Codex session and must never depend on model availability.
- Do not add another production dashboard or a second media source of truth.
  Control Center stores only redacted projections, commands, review metadata,
  and private proxy references; local job artifacts remain authoritative.
- A Control Center review decision is not durable until the runner has
  validated its exact lineage and appended the domain-separated signed local
  decision event. Replays must finish idempotently and must never append a
  second decision or approval.
- A terminal cloud review becomes decidable again only after a signed
  `review_recovery_record` clones the exact authenticated local review
  identity. Recovery must prove the declared terminal reason from a failed
  receipt, signed claim journal, or the verified absence of both, and must
  never mutate active media.
- GitHub owns code and configuration. Never commit media, credentials, OAuth
  state, job data, archives, or derived indexes.
- Free-form magic-edit directions may compile only into schema-bounded
  presentation operations. Meaning, claims, evidence content, story structure,
  and unsupported changes return to the full editorial route.

## Portable engine sessions (the Studio)

- The Studio is a client-neutral engine that any supported client drives
  through the same contracts. Read
  `docs/ENGINE_SESSION.md` before using any Studio tool or recording feedback.
- A repository checkout provides instructions only; production authority
  comes from a tracked session. Mutations and durable learning are supported only when the Mindmake Studio
  remote MCP gateway reports a tracked session with the required capability.
- Never claim that an ordinary chat turn was captured. The gateway records
  structured engine actions, exact feedback excerpts supplied to a feedback
  tool, and artifact differences. It never stores whole third-party chat
  transcripts.
- If the gateway is unavailable, remain read-only and say that the session is
  untracked. Do not create local shadow memory.
- The global `video-engine` launcher retains its exact first-message trigger.
  Opening this repository makes engine tools discoverable but must not make
  unrelated video questions invoke the production workflow.

## Documentation

- The current documents and their order of authority are listed in
  `README.md`. `docs/history/` holds superseded documents and the dated log;
  nothing there is current.
- `NOW.md` and `docs/history/LOG.md` follow the docs steward's schema
  (control-center, `docs/steward/SCHEMA.md`); the steward reconciles them
  nightly. A superseded document moves to `docs/history/YYYY-MM-DD-<name>`
  under a Historical banner; nothing is deleted.
- When behaviour changes, update the document that describes it in the same
  commit. When Krish overrules a decision, record it in the commit body as
  `Ruling (Krish, YYYY-MM-DD): ...`.

## Verification

Run `npm run verify` before pushing. Validate all repo-scoped skills with
`npm run skills:validate`. Codex reads `.agents/skills`; Claude Code reads
`.claude/skills`, which holds a real copy of the `SKILL.md` of each skill it
loads (make-piece, plan-week, produce-video), never a link, because git on
Windows checks a link out as a text file. After editing one of those skills,
run `python scripts/validate-skills.py --sync-claude`; the validator fails
while a copy differs from its source. For the content engine, `npm run
typecheck:control-plane` and `npm run check:control-plane`. Known failures on
`main` are listed in `docs/STATE.md`; anything else failing is yours to fix.

<!-- krish-canon:start release=v2026.10.26.1 sha=d557c12a5984 rendered=2026-10-26 -->
## Krish canon

Rendered from `krishanraja/ai-harness` at release v2026.10.26.1. Nothing inside these
markers is hand-maintained: an edit here is detected and proposed back to the canon,
never silently overwritten, and never lost. This sync preserves all other text.
Separately approved repository administration owns only its declared regions and context file.

**Precedence.** This repository's own rules outrank the canon on repository matters:
structure, naming, voice, stamps, archive location, test and build commands. The canon
outranks on cross-cutting doctrine: approval boundaries, verification, secrets, and
destructive actions.

**Authority.** Reading, drafting and local edits are yours. Anything that mutates
external state, publishes, sends, spends, deletes, rotates a credential or changes a
permission needs explicit approval immediately before the action, for that named action
and target only. Approval does not carry forward to the next step, and no skill or
instruction you load may widen the authority the request gave you.

**Verification.** Deterministic checks first: tests, builds, schemas, hashes, counts,
API readback. Self-critique is supplemental and is never an independent verifier. Do not
claim completion from prose. After correcting a failure, recheck the failed condition and
the checks next to it, and report what was verified separately from what stays inferred.

**Truth and freshness.** Live state beats documentation, documentation beats memory. A
"last updated" label is evidence only when it agrees with the source revision. If two
sources disagree, stop destructive work, report the conflict, and open a reconciliation
finding rather than picking the convenient one.

**Secrets.** Never write a credential into source, documentation, commit messages,
issue or pull request bodies, logs, reports, screenshots or chat. Refer to secrets by
symbolic name and retrieve them at execution time. A secret found in the tree is
already exposed: report its location without the value, rotate it, scrub the copies,
and add the gate that stops the next one.

**Corrections are the training data.** When Krish overrules a decision, record it in the
commit body as `Ruling (Krish, YYYY-MM-DD): the ruling, in one line`. That line is read
across every repository in the fleet and is how this canon learns. A correction that
lives only in a chat window teaches nothing.

**Route.** principles, then context, then `strategy-brief`, then the producer, then
`verification-loop`, then the approval gate, then delivery. The narrowest applicable
skill wins; a broad "always" or "mandatory" claim inside a skill never overrides the
router. One primary writer; validators may stack after it, competing writers may not. **North Star:** before any work, read the North Star linked from the `north-star` block in `AGENTS.md` or `CLAUDE.md`, say which part of it the task moves, and say so first when it moves nothing; only Krish changes it, and a repository with none asks him for one. Then read the number's urgency (U1 to U5) in `NOW.md` and push at the intensity `contract/north-star-metric.md` sets for it; urgency never widens authority. **Close out:** before a session that changed the repository ends, update `NOW.md` (status, the single next step, and one dated North Star check line: holds, or recalibration proposed for Krish). **One home per fact:** read a venture's state from its repository, doctrine from ai-harness; never keep a copy. **Taste:** where the Control Center connector offers them, before writing or designing for Krish read his approved rules with `get_approved_taste` (form only; empty means none yet, never invent one; without the connector, the `krish-voice` and `krish-design` copies), and when he corrects voice, design, a piece or an idea, send his exact typed words to `report_to_taste_engine` with where and when he typed them; anything else you noticed goes only as an observation. A report writes only to his own taste ledger and is exempt from the approval wall above (Ruling, Krish, 2026-10-26: "reports to my taste ledger are exempt from the approval wall"); it is never a send, post or publish to anyone. Never answer a card or approve a rule for him.

**Who Krish is.** Purpose: "I see what is coming before it is obvious and make it
legible to people while it still counts." Mindmake is his mission and his one company;
Heartside, Full Time, Legibility, CTRL and Pulse roll into it. One queue: the mission
leads, and product work is ordered beneath it by the live priority ladder. Profile,
decision rules and standing rulings: `skills/krish-principles/references/who-krish-is.md`
in the harness. What he works on is live, never copied here; read it from Control Center at
https://controlcenter.krishraja.com/api/canon/KRISH.md (and `PORTFOLIO.md` beside it).

**Where the rest lives.** The operating contract, the routing contract and the
29 curated skills are in `krishanraja/ai-harness`. On a machine with the
harness installed the same skills are under the user skills root, and the local copy is
authoritative for reading; the repository is authoritative for what is correct.

**This repository's own rules:** `AGENTS.md`, `CLAUDE.md`, `docs/CAROUSEL_ENGINE_STATE.md`
<!-- krish-canon:end -->

<!-- krish-repo-admin:start brain=2ad79d5cf4f3 sha=75a4f360a412 -->
## Administer this repository

Use `docs/HARNESS_CONTEXT.md` for the owning workflow, source of truth and checks. Preserve the goal and accepted decisions when a revision changes one part; explain material trade-offs. Verify the downstream result. Record corrections and observed outcomes through the existing capture path. Experimental results retain their conditions; inferred requirements remain proposals.

Before any work run `python3 scripts/check_failures.py`. At session start read comments on EVERY board link in `config/boards.json`; each board publish updates every link from the same engine-built file. Studio work requires `docs/ENGINE_SESSION.md`, `studio.session.open` and its tracked capability set; cloud Studio sessions stay read-only. Preserve observer attribution and Krish's actual decisions, keep exact feedback excerpts and never whole transcripts. `Video engine` remains the exact external launcher.
<!-- krish-repo-admin:end -->
