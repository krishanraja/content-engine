---
name: produce-video
description: "Produce Krish's videos once he has recorded them. Use when he says he has dropped, recorded or uploaded his video or recordings, or asks to produce, cut or make the video or videos for a piece or a day, such as 'I've dropped the video', 'the recordings are in the Inbox', 'produce Monday's video' or 'make the videos for this week'. It works out by itself which new recording is which piece's long or short cut, with no file name or piece id, then makes the 16:9 long cut and the 9:16 short cut, each with the licensed music bed from the ledger and a thumbnail for its size, files them in the archive and the post's library folder and records them on the piece. Runs end to end on any machine: a cloud session (the Sunday-night run), GitHub's machine (produce-day, by hand only) or either home computer; takes, music and pictures all come from the engine. It is not the one-line launcher of the video-engine skill, not a Studio job from a production brief, and not for general questions about video or editing."
model: sonnet
---

# Produce the video

> Video is made with the ve engine (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`); the quick-edit path stays the fallback until ve passes Phase 3.


## Mandatory quality floor

For every production request, including just "Produce this video", load
`docs/MEDIA_STANDARD.md` and run `node --import tsx scripts/media-standard.ts show`.
Create this piece's own media brief, assets and explanatory motion against that
standard. Previous-piece assets are evaluation history, never the new asset kit.
Representative proof precedes full production. Read `scripts/media-standard.ts rollout`
as well: signed proof/final qualification becomes mandatory only after reviewed
activation. While pending calibration, retain every existing approval, audio,
clarity and delivery check; never claim the new automatic gate is active or that
missing reviewer capability is a pass. Follow the rollout section in the guide.
Repair routine failures internally and preserve existing user approvals.

Then read the rejection floor for every cut you make (`python3 scripts/floor.py
--format short_video`, `--format long_video`, and `captions`, `audio`, `motion`,
`card`, `intro_outro`): every rejection Krish gave, in his words, and the
standards no finished cut may fall beneath (AGENTS.md rule 20). Before a cut
reaches him, check the finished file against each one, by eye and by ear.

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

## Never call a video good without watching it

### Minimal words and visual comprehension

Follow `docs/VISUAL_CLARITY.md` (Krish, 25 October 2026). Plan recognisable visual
cues before writing labels; words must add information rather than repeat the
script or captions. Count all legible image text, retain the rendered inventory,
and run `scripts/quick-edit/visual_clarity.py`. The final delivery receipt needs
the hash-bound `visual_clarity` check; `quality.delivery_problems` enforces it.
Automated text checks and author inspection do not prove three-second layperson
comprehension. Keep that evidence distinct and never invent a viewer response.

### Mandatory camera-motion assessment

Krish, 2026-10-22: "stabilization should be a mandatory check to see if it is needed. it usually is".

Assess every recording before final composition, alongside sync, audio and
framing. Track static background features across continuous windows near the
start, middle and end; distinguish camera shake from the speaker's gestures.
An inconclusive measurement requires inspection or a better tracking region.
It cannot be treated as evidence that stabilisation is unnecessary.

When needed, stabilise the camera footage before adding cards, captions or
logos. Preserve the accepted speech edit, audio samples and caption clock.
Compare the untreated and treated footage, then inspect the finished cut for
residual shake, warping, exposed borders and lost headroom. Recheck sync after
the picture changes. When treatment is unnecessary, record the measured and
visual evidence supporting that decision. Never apply treatment merely to
satisfy the checklist if it makes the picture worse.

The exact-byte validation receipt needs a `motion` check with the recording
hash, assessment evidence hash, `stabilised` or `not_needed` decision, treatment
and before/after measurements when applicable, and final picture review bound
to the delivered video hash. `quality.delivery_problems` refuses missing,
inconclusive or stale motion evidence. Working renders remain available for
inspection; they do not count as finished delivery.

Krish, 2026-10-13, after Wednesday's runner video went out with a title running
off the page: "Did you actually watch these? ... I'm pissed off that you didn't
pick them up." The runner's preview stills (one frame per beat) are not a
review. Before telling Krish a video is ready, download both finished files and
look at a frame every second of the whole cut, plus every quarter second of the
intro and the outro, as one contact sheet per shape. Check: every word inside
the frame at every moment of every animation, the brand faces only (Anton,
Archivo, IBM Plex Mono), logos people recognise, badges and labels drawn the
same way, nothing half-built in the 9:16 layout, no kicker that uses another
series' ground. If anything fails, say so and fix the engine, not just the file.

Krish, 2026-10-19: "these eyebrows and source citations are prohibited".
Video cards must not carry small eyebrow labels, source-credit lines or metadata
footers such as "Car analogy". Keep source evidence, photographer attribution and
licences in the accompanying records. Meaning-bearing qualifications belong in
the main message or spoken wording. Preserve explicitly approved story clips.

Krish, 2026-10-19: "don't just leave random big spaces". A card introducing a
person should show the person or a useful illustrative scene. Text-only beats
need a deliberate, compact type composition; never reserve an empty image slot.
Inspect the whole held beat at phone size, not just its transition. Space may
support emphasis, but unrelated decoration is not a fix for a missing composition.

Krish, 2026-10-12: "give me a skill (or the codex equivalent) that
understands everything going on here that invokes properly when I engage it
for video production - i.e I will need to have dropped a video in the exact
location, it will need to know which one it is (ideally automatiically
without me having to give the exact filename), and exactly what to do from
there, how to engage the backup runner machine if needed etc etc."

This is that skill. Codex is a visual asset maker, never an editor (Krish,
2026-10-28: "Visual asset maker"): it makes pictures, plates and library
devices from cards (`docs/ve/ENGINE.md`), and never cuts his takes, joins
his words, draws captions or mixes sound. That retires, for editing, his
move of 11 October ("I'm going to transfer all video production iteration
through to Codex"). The engine assembles every cut, run by this skill: the
Sunday-night run (below), or Claude Code when Krish engages it. The
record's owner label for the step (`MAKING_OWNERS` in
`apps/control-plane/api/_making.ts`, mirrored in control-center's
`src/lib/making.ts`) is stale: it still says Codex until both copies change
together. The step is Claude Code's, and a Claude Code run writes `--by
"Claude Code"`. Every write says who wrote it:
set `MAKING_BY` in the preflight (step 1), or pass `--by Codex` or
`--by "Claude Code"`. Nothing before the recordings (the article, the
scripts, the cover, the pictures, the visual gate, the pack) and nothing
after Video assets (the publish board, the posting) is this skill's to write.

Both cuts render through `scripts/quick-edit/make.py`, the only path that
makes 16:9 as well as 9:16 and the only one that carries music and an
opening sting (the Studio renders 9:16 only and refuses both). Each cut is
its own recording of its own script (house rule TWO_CUTS): the long cut
renders with `--only 16x9`, the short cut with `--only 9x16`.

Commands are written `python`, as on Windows; it is `python3` in the cloud.

## What Krish does

1. Records each cut as its own take: the long cut from the long script, the
   short cut from the short one.
2. Reads each cut from its own script in his teleprompter.com account, on
   his phone or his laptop: one folder per piece, one script per cut, put
   there when the scripts pass (`make-piece`, "The Scripts step"; Krish,
   2026-10-12: "Also note that Descript is permanently gone,
   teleprompter.com is permanently in, connected via MCP here").
   Teleprompter holds scripts only: it records nothing and sends nothing
   back.
3. Drops each take at the top of the Video Engine Inbox, Drive
   `makeyourmindup > Video Engine > Inbox`
   (`H:\My Drive\Ventures\Active Ventures\makeyourmindup\Video Engine\Inbox`). Never
   in a subfolder: the upload lane reads only the top level. Any name will
   do. A file over 500 MiB is skipped by the lane, so that one is produced
   on a home computer, straight from H:. This is the one way a take comes
   back.
4. From 1 November, his Titles press on the day's tab starts the night's
   cuts (the Sunday-night run, below). For a re-cut, a take outside that
   run, or while the press cannot start it yet, he tells Claude Code "I've
   recorded" or "I've dropped the video".

A take reaches the engine within about ten minutes, from whichever home
computer is on, and the same lane then places it on its piece and cut by
itself, stamped with the script it was read from (step 2). He never has to
give a file name or a piece id. He is asked only when the matcher is unsure,
in a session's reply to him (the lane holds one board item per take for a
session, never on his list), and for approvals that are his alone (a music
track, the mix levels, the sting's design, the story intro and outro
designs).

**Descript was retired on 12 October.** That morning his takes were to be
recorded in Descript; the same afternoon Krish ruled "Descript is
permanently gone". No session reads, copies or publishes anything there. A take he recorded in
Descript before then reaches the engine only when he exports it and drops
the file in the Inbox like any other: ask him to, in one line, and never
fetch it another way.

## Before anything

**Render only from the signed creative direction** (Krish, 2026-10-24:
"Once the videos are recorded, Claude gets the scripts and the visual
creative direction locked so that codex can take over on the video
production"). Read `docs/CREATIVE_DIRECTION.md` and the piece's
`creative-direction.json` beside its `post.json` first. From 26 October
`kit.py` refuses a cut without a direction Krish signed for its exact
words, and `make.py` refuses one that changed after kit.py checked it.
Make each beat as written: its picture, its source label, its on-screen
words, its modules. Never invent a visual, a caption, a figure or a style;
when a beat cannot be made as written, stop and name the beat. Never sign in
to a publishing platform or ask Krish for a code: he publishes. A cut is
ready only when a reviewer who did not make it has watched it at full size
and listened across every join against the direction's `acceptance`, with
fact, transport and editorial status reported separately.

Read `AGENTS.md`, `WORKBENCH.md`, `docs/CADENCE.md` ("Who owns what, and
where things live") and `scripts/quick-edit/README.md`. Read the board
(`WORKBENCH.md`, "The board"). This skill does not use the
Studio; if a session touches it, `docs/ENGINE_SESSION.md` applies and a
cloud session is read-only for it.

In every tool, copy Krish's ticks from the week's publish board onto the
records now and again before you stop (`.agents/skills/make-piece/SKILL.md`,
"The week's ticks"). After active cutover use the authenticated web API in
`docs/PUBLISH_BOARDS.md`, including edits, picks, queue and comments. Do not
defer this to Claude Code. Only an explicit legacy-artifact session needs
ArtifactData. A Record tick is information only; Record is done from the takes
on the record.

## The Sunday-night run (from 1 November)

His Titles press on the recording Sunday (about 15:30; Krish, 2026-10-28:
"Sunday evening press") starts this skill for the week in a fresh session;
until the board's press can fire it, he starts it by telling Claude Code
"I've recorded". Nothing starts it at a fixed time, and 21:30 is only the
deadline for a surface he has not picked, which then takes its top-ranked
option, never recorded as his pick. Read
`.agents/skills/produce-video/references/sunday-night.md` before the first
cut: it holds the run in full. Its gates: the floor first; his signed
storyboard for the cut's exact words, or the cut is held; the words gate
(`scripts/quick-edit/words_gate.py`), blocking, so a cut that lost a content
word, or a checkout without the gate, files nothing; every other check an
advisory row until calibrated; and every gate below still holding. It
builds no publish board: it records each cut, each held cut with its
reason, and its report for the Monday board, which is built at 06:30 by its
own routine (until that routine exists, by the first session on Monday).
No one is in its chat.

## 1. Preflight: which tool, which machine

- **Who is writing.** Set it once, so every record this session makes (the
  matcher's, `making.py`'s, and any that `send.py` or `build.py` write)
  names the right tool: PowerShell `$env:MAKING_BY = "Codex"` in Codex, or
  `$env:MAKING_BY = "Claude Code"` in Claude Code (`export MAKING_BY=...` in
  the cloud). `making.py` also tells Codex by itself, but set it anyway.
- **Any machine renders: a cloud session, GitHub's machine, a home
  computer.** Krish, 2026-10-12: "record this capability of yours so you do
  not whine about this ever again". Nothing here needs H:. The takes come
  from the engine (`recording.py get`, step 2), the music from the
  library (`python scripts/quick-edit/music.py fetch`, then
  `MINDMAKE_MUSIC_ROOT=<the folder it prints>`; both home computers
  publish it every pass), the pictures from the post's pack
  (`GET /api/library/file`) or `--files`, and the finished cuts go to the
  post's `3 Video` folder through `send.py` (Library Sync writes Drive).
  Never send Krish to a home computer, never relay a runner's status light
  as his blocker, and never ask him for a music licence number (Epidemic
  Sound has none; `config/music-licences/` is the record). From 1 November
  the cuts are made on the recording Sunday night (Krish, 2026-10-28:
  "record the entire week on a Sunday, but it does not go live until the
  Monday after (8 days later)"). The production run
  (`.github/workflows/produce-day.yml`, `scripts/produce_day.py`) runs
  by hand only since that ruling: nothing makes the videos by itself at
  noon any more. It does the
  steps below on GitHub's machine or a home computer, and stops red when a
  gate holds a cut (the words gate, or a receipt the delivery gates refuse),
  sending nothing. In Wave 1 no machine records a cut's review evidence, so
  a fresh run always stops there: this session watches both cuts, records
  the evidence, then files with `produce_day.py --file-only` (its stop
  message gives the command, and on GitHub the cuts are in the run's
  artifacts).
- **A home computer** (Windows): work in `C:\Users\krish\dev\content-engine`,
  never in `Documents\MindmakeVideoStudio\runner-source`, at the latest
  `main` (`git pull --ff-only`). Codex runs every step outside its sandbox
  (ask for escalated permissions; Krish approves): inside it, the engine
  key, H:, the internet and the scheduled tasks are all out of reach.
- **Which machine this is.** `Get-ScheduledTask -TaskName "Mindmake Video
  Studio Runner"`: `Ready` or `Running` is the main machine (the Studio's
  active runner); `Disabled` is the backup. `make.py --doctor` says the same.
- **Whether the main machine is on.** `python scripts/engine.py GET
  /api/content-engine/health --full`: `runners.active.fresh` is true when the main
  machine was heard in the last two minutes. It says which machine is on;
  it never by itself means a failover (see "The backup machine", `.agents/skills/produce-video/references/backup-machine.md`).
- **Whether this machine can render.** `python scripts/quick-edit/make.py
  --doctor` (or `--doctor --json`). It checks ffmpeg and ffprobe and every
  filter, the caption font, `faster-whisper`, Pillow, Playwright, node, the
  music folder and the archive folder, the music ledger, every approved
  track's file against its sha256, and the sting for every shape and
  series. **Exit 1 stops the run**: fix what it names first. A
  `faster_whisper` that is missing, or that imports but cannot decode a
  second of sound, is a FAIL, because the matcher and make.py both hear the
  takes with it. Install the pinned set, never an unpinned `pip install
  faster-whisper` (its newest pair cannot decode): `python -m pip install
  --require-hashes -r requirements.lock.txt`, or on a runner machine `npm run
  bootstrap:python`. "No approved track" and "sting still
  a candidate" are expected until Krish approves them: the cuts then go
  without them and the report says so. The archive folder is
  `MINDMAKE_ARCHIVE_ROOT`, else on Windows `runtime.archive_root` in
  `config/studio.json`.

## 2. Find and match the takes

The home computers do this by themselves: at the end of every five-minute
pass, the recordings upload (`scripts/recordings-upload.ps1`, on both
machines) runs `recording_match.py --record --board --by "Recordings lane"`
whenever the engine holds a take that no piece claims and that it has not
already asked about. So by the time Krish says he has dropped the takes,
they are often already on their piece. Look first, then match what is left:

```
python scripts/post-pack/making.py PIECE_ID show              # Recorded, with a note for a cut still to record
python scripts/post-pack/recording_match.py                   # the engine's copies of the Inbox (any machine)
python scripts/post-pack/recording_match.py --inbox           # a home computer: the Inbox on H: itself
```

It finds the pieces waiting for a recording this week and next (Scripts
done, Record not), hears the first 45 seconds of every take no piece holds
yet, and prints one line per file:

- `placed`: the piece and cut, and why (its words, its length or its name).
  Each take is heard against the words its piece's record says are current
  (the copy whose hash is the record's, on this machine or as committed on
  main), never a stale pack. And teleprompter.com names each recording
  after its script ("Mon 12 Oct - 3-minute - Who gets paid for AI
  songs.mp4"): a file named after a cut's script title on a waiting piece
  is that piece and cut, unless its words are surely another piece's or its
  length surely the other cut's.
- `unsure`: ask Krish, using the line it printed. Never guess. When he names
  it in words, record it by hand with the command below. A take recorded
  after the piece's record began but before its own cut's words last
  changed is unsure too, "recorded before the script last changed": it may
  be a take of the older words, so Krish says whether to use it or record
  that cut again. Each cut has its own time, so a change to the long script
  never makes a short take look old. With `--board` each unsure take is one
  board item held in progress for a session (never on his list: you ask him
  in your reply), asked once, and never reopened once he or a session
  closed it. Control Center's done-check sweep closes it once the take is
  on a piece; the lane notes one no waiting piece can be (the sweep then
  lets it go), and the sweep lets one no session touches go after a week.
- `left alone`: an older take of the same cut, or a take that arrived
  before any waiting piece's record began, so it is none of their takes.
- `failed`: say which step failed (the download broke, a transcriber that
  is missing or cannot decode, the engine could not be reached). One take
  failing never stops the others.
- A file still arriving reads as unsure: run it again in a couple of minutes.
- A take Krish says he dropped that shows nowhere: say which step it is
  stuck at. It has not reached the Inbox, or neither home computer has sent
  it yet (allow about ten minutes; `--inbox` on a home computer sees it
  sooner). Never fetch it through the Drive connector.

Exit 0: every new take placed (or none). Exit 2: at least one is unsure.
Exit 1: something failed. `--json` gives the same answer to read.

Then record the sure matches the lane has not recorded yet (nothing else
writes the Record step):

```
python scripts/post-pack/recording_match.py [--inbox] --record              # writes as MAKING_BY
python scripts/post-pack/making.py PIECE_ID recorded long "recordings/SHA256.EXT" --seconds N   # a take Krish named in words
python scripts/post-pack/making.py PIECE_ID show
```

`making.py recorded` refuses a take that is on the record from an older
script, or that the matcher found was recorded before the script last
changed: stamping it would make it count for the current words. Only when
Krish says in words to use it, add `--krish-words "Krish, YYYY-MM-DD: his
exact words"`; they are kept on the take.

Each recorded take is stamped with the hash of the script it was read from,
the piece's current words for that cut. Record reads done once both cuts
have a take of their current words. Work the pieces in the order it
printed, the nearest first. When this session has an https link, record it
on the piece: `python scripts/post-pack/making.py PIECE_ID session LINK`.

**Before producing a piece, read where it is**: `making.py PIECE_ID show`.

- **Scripts must read done.** If it does not, stop: the scripts are Claude
  Code's step (`make-piece`). Say so in one line, leave a board item with
  the piece's `idea_id`, and produce nothing.
- **Recorded must read done**, for both cuts. A cut still to record, or a
  line "older script: the long take ... does not count", means that cut has
  no take of its current words: never produce from a take of an older
  script. Krish records it again, or says in words to use that take (then
  record it with `making.py ... recorded ... --krish-words "Krish, DATE: his
  words"`, which stamps the current words and keeps his).
- **Video assets already done** means the cuts exist. A new take of a cut
  that is already produced is never a remake by itself: put one board item
  asking Krish, and remake only on his words.

**Which take, and getting it onto this machine.** A piece's takes are on its
record: `python scripts/engine.py GET /api/content-ideas/PIECE_ID/making
--full` lists `making.recordings` (each take's `cut`, `path`, `at` and
`script_sha256`) and `making.script_check.hashes` (the current hash of each
cut's script). For each cut, use the newest take (the latest `at`) whose
`script_sha256` is that cut's current hash; a take with no hash (recorded
before hashes were kept) also counts. Fetch it by the path the record holds,
which works on any machine and in any later session:

```
python scripts/post-pack/recording.py get "recordings/SHA256.EXT"
```

`--sha256 SHA256` does the same, and `get "FILE NAME"` still fetches a take
by the name the matcher printed. A take over 500 MiB is never in the
engine: copy it from the Inbox to a local work folder (`Copy-Item`, never a
move). quick-edit never works on the Inbox itself.

## 2b. After the takes: his narration, then the packaging round

House rule TITLES_AFTER_RECORDING. Krish, 2026-10-17: "the fact that I need to
approve/sign off on titles and headers and thumbnail headings and whatnot after
recording is an important distinction because only after recording do I really
feel like I've got a message. Usually I change or understand a fair bit more
after reading a script out loud than I do creating a script."

- **Measure every take against its script** and keep it in the ledger (he
  ad-libs: 9% of what he said was his own on 12 October, 38% by 16 October):
  `python scripts/post-pack/narration_diff.py SCRIPT WORDS.json --md WORK/narration.md --json WORK/narration.json`
  (SCRIPT: the cut's current words; WORDS.json: make.py's words file once
  `--plan` has heard the take; `--fixes LONG.json` folds in the config's
  verified caption fixes), then
  `python scripts/post-pack/narration_diff.py ledger WORK/narration.json --cut short|long|feature --date YYYY-MM-DD --piece PIECE_ID`.
  story_check reads the ledger to warn when the next script will run long.
- **The packaging round comes now, never earlier**: the Substack headline and
  cover words, the YouTube title and thumbnail words, the Shorts title, the
  video's title card, every picture heading and chapter divider, written from
  what he said on camera and his playbook for each surface (headings and
  dividers in one channel style, never pasted from the transcript:
  CHANNEL_HEADINGS), every line judged by whether it tells the piece's
  story (STORY_FIRST: `title_check.py lessons --plan docs/plans/<plan>`
  prints it), put to him in one
  round (`make-piece`, "Titles, headlines and headings"). Claude Code runs it;
  Codex leaves one board item for the next Claude Code session. Nothing with
  those words on it (a title card, a thumbnail, a card heading) is drawn before
  he picks; `title_check.py verdict --picked` refuses a packaging pick while
  the piece has no take on the record.
- **His sign-off first, then punch through without him** (SIGN_OFF_FIRST;
  Krish, 2026-10-17: "do you not want to get sign off on headings and titles first so you can punch through to 100% without me?").
  The round is the first thing done once a take is on the record, before any
  render, capture, drawing or copy that waits on it, and it is one sheet with
  every decision that is his for the piece: the lines above, the headings and
  dividers, the intro stand-off, any script or speed choice for a cut still to
  record. Never queue it behind a slow machine step. Once he answers, finish
  to publish-ready without coming back to him, except for a send, publish,
  spend or delete.

## 3. Build the kit, once per cut

Use a local work folder per piece, such as `.cache/produce/DATE-SUBJECT`
(git ignores `.cache`). The piece's `post.json` is the one under
`docs/plans/` whose `piece_id` is the piece. First see where its files are:

```
python scripts/post-pack/plan_files.py docs/plans/PLAN/post.json [--files FOLDER]
```

It only reads. Exit 0: every script and picture is found. Exit 1: it lists
each one it could not find and every place it looked. Then:

```
python scripts/quick-edit/kit.py docs/plans/PLAN/post.json --cut long --recording LONG_TAKE --out WORK/kit [--files FOLDER]
python scripts/quick-edit/kit.py docs/plans/PLAN/post.json --cut short --recording SHORT_TAKE --out WORK/kit [--files FOLDER]
```

It draws the house end cards for both shapes, the wide frame in the
subchannel's look, the tall strap, a panel per picture, and writes a
starter `long.json` or `short.json` for make.py (intro and music on auto,
the same piece id on both, so both cuts get the same track).

- **The scripts** come from the dated drafts the repository keeps beside
  the plan (`docs/plans/DATE-draft-script.md` and `-draft-script-90s.md`),
  so they need no `--files`.
- **The pictures** need `--files` only until the pack is sent: the post's
  working folder (in a cloud session that holds it). Once `send.py` has
  sent the pack, a home computer finds the post's library folder by itself
  (`runtime.library_root`, the `3 Posts` folder on H:), with no `--files`.
- **Exit 2: stop and fix the input** it names (a script that is nowhere, a
  bad `--files` folder, another piece's `--out`).
- **Exit 1: a `CHECK` line for each problem**, and each one means the cut
  would go out without a picture's evidence. Exit 0 is the only clean run:
  never render on exit 1. Fix each one and run it again:
  - **a picture that is nowhere on this machine**: find the folder that
    holds it and give it with `--files`;
  - **a picture no line of the script brings in** ("not cued"): add its cue
    to `WORK/kit/long.json` (or `short.json`) by hand, with `id`, `panel`
    and the words he says over it as `start` and `end`; kit.py keeps a
    config edited by hand, and a picture cued there counts. A picture named
    only in the opening line or the call to action is a note, never a CHECK;
  - **a panel whose words come out under the size a viewer can read** in
    this cut's own shape ("under the 39 px a viewer can read" in the tall
    cut, 21 px in the wide one): draw a version of that picture for video,
    with fewer and bigger words, and give its folder with `--files`; or take
    the cue out by hand and ask Krish.
  Only when Krish has said in words that this cut goes without those
  pictures, or with a small panel, pass his words: `--allow-missing "Krish,
  YYYY-MM-DD: his exact words"` or `--allow-small "Krish, YYYY-MM-DD: his
  exact words"`. They must start with "Krish"; anything else is refused, and
  they are recorded in `kit.json` and in the cut's config, so make.py quotes
  them instead of warning. Never write words for him.

A config edited by hand is never overwritten (when Krish's words come after
the edit, copy the new config's `kit` block across: kit.py says so).
kit.json also keeps each cut's recording length, which make.py reads so both
cuts ask for the same music: make the kit for both cuts before rendering
either.

## 4. Plan, then render each cut

**First, the style recipe** (`docs/STYLE_REFERENCES.md`). If
`config/style-references.json` has a recipe for this piece, plan the cut
with its editing, camerawork and graphics modules, always on top of the
base (Krish's house rules win). Say in the report which modules were used,
and set this cut's pace (cuts a minute, median shot) beside the pace of the
references they came from. Then ask Krish for his verdict on each one.

**First, the story intro, the audio treatment and the outro card: required
before the final render** (house rule `STORY_INTRO_OUTRO`). Krish,
2026-10-12: "when the videos come back bear in mind that I want a proper
animated branded intro to this specific story visually, the audio
treatment, and then a proper animated outro card. Across all formats, and
this should be part of the system moving forward." A cut is finished only
with all three made for its piece: an animated, branded intro to this
story, in the 16:9 long cut and the 9:16 short cut; the audio treatment;
and an animated outro card made for the piece, in both sizes. Design comes
first, and the designs are his to approve (`krish-design`): read
`config/story-intro-outro.json`. While its `status` is not `"approved"`,
say "story intro and outro not designed yet" in one line, in the report and
on the piece's board item for a home computer, and stop before the final
render: the kit and `--plan` may go on, but no cut is rendered as finished,
filed, sent to the library or recorded (`making.py video`) without them.
Never build or improvise the designs here, and never ship a cut without
them on anyone's word but Krish's own, quoted.

Approved on 12 October: the stand-off (`config/story-intro-outro.json`,
`approved`). Render the piece's own clips, then point each cut's config at
them:

```
python scripts/quick-edit/story_io.py props --plan docs/plans/PLAN --out WORK/story-io/props.json
python scripts/quick-edit/story_io.py render --piece-props WORK/story-io/props.json --out WORK/story-io
```

In `long.json` set `"intro": {"16x9": "WORK/story-io/intro-16x9.mp4"}` and
`"endcard": {"16x9": "WORK/story-io/outro-16x9.mp4"}` (in `short.json` the
`9x16` pair), and `"intro_override"` to `"Krish, <approved.on>:
<approved.words>"` from the config. The intro runs 3 s and the outro 4 s;
make.py takes an intro of up to 5 s on those words and sizes the music for
both. `scripts/produce_day.py` does exactly this.

```
python scripts/quick-edit/make.py WORK/kit/long.json --out WORK/long --only 16x9 --plan
python scripts/quick-edit/make.py WORK/kit/long.json --out WORK/long --only 16x9 --share-mib 29
python scripts/quick-edit/make.py WORK/kit/short.json --out WORK/short --only 9x16 --plan
python scripts/quick-edit/make.py WORK/kit/short.json --out WORK/short --only 9x16 --share-mib 29
```

- **Plan until clean.** Read `shapes.16x9` (or `9x16`): the sting or why
  not, the music track or why not, the intro, main, end card and total
  seconds, and the warnings. A graphic whose words were not found: change
  its `start` and `end` to the words he actually said and plan again. A
  stumble or restart: `remove` (`{"say": ..., "after": ...}` or
  `{"restart_near": "m:ss"}`). A misheard name: `replacements`. A US
  spelling: the captions take the script's spelling by themselves where the
  heard word lines up with a script word (`spellings` in the plan lists
  each); a warning naming a US spelling no script word covers (an ad-lib)
  needs a `replacements` entry, unless it is a name or a quotation (house
  rule BRITISH_SPELLING).
- **A plan that warns "the config has no cues, but its post has N
  picture(s)"** would send the cut out as a bare talking head: go back to
  step 3 and find the pictures. A line "this cut goes without ..., as Krish
  said" quotes his words from step 3: it is not a reason to go back.
- **Render** each cut from its own recording with its own `--only`. Never
  `--archive` on either run (that files the two cuts in two folders), and
  never one recording for both shapes.
- Each cut carries the intro sting once Krish has approved one, and the
  music bed from the ledger when a licensed, approved track fits (read
  `.agents/skills/produce-video/references/intro-sting.md` and
  `.agents/skills/produce-video/references/music.md` before this step).
  Neither ever blocks a render.

**A long episode** (a 15-minute feature Krish called, house rule FEATURE, or a deep cut already recorded under the retired DEEP_CUT) is made to
`docs/production/one-shot-episode-corpus.md`, the standard Krish gave on 16
October. Its config carries the episode settings (`scripts/quick-edit/
episode.py`, and the README's table): `"voice": "repair"`, the one-take pause
rule (`"max_gap": 0.9, "pad_before": 0.2, "pad_after": 0.3`),
`"reframe": true` and `"emphasis"` on the pivotal lines, the chapter dividers
as cues and `"chapters"` for the description's chapter list,
`"captions": false` with the caption file (`NAME-16x9.srt`) uploaded to
YouTube, `"end_screen_s": 20`, and `"music_mode": "episode"` with
`"music_seconds"` so a three-minute track covers the open, the chapter lifts
and the close. The short cut keeps the house look.

A 15-minute feature goes through that same one-shot episode path; it is a
third cut beside the 5-minute and the 90-second, which are made as usual.
Only a piece in `config/features.json` has one (Krish's call alone; never
make a feature for any other piece). What changes for it:

- **Its own cut, `feature`.** Its take is placed on the `feature` cut by
  the feature script's hash (`recording_match.py`: its words, its
  Teleprompter title, a name saying "feature", or a raw length of 10:00 and
  over), and fetched like any take (`recording.py get`).
- **Its own spoken-length cap**, `SPOKEN_CAP_S['feature']` in
  `scripts/post-pack/story_check.py` (990 seconds, 16:30), not the 5-minute
  cut's 330 or the retired deep cut's 720. Measure the take against the
  feature's script and keep it in the ledger with `--cut feature`, so the
  next feature's script is warned against his own pace on features.
- **Its own wide thumbnail and record.** Draw a 1280 x 720 thumbnail for it
  and record it as `making.py PIECE video feature NAME PATH --thumb ...
  --thumb-file ...`, then `drive-link feature`. The record's Record and
  Video assets steps wait for the feature on such a piece.
- **Its own publish steps.** The publish page adds a YouTube long-form step
  and a Spotify episode step for it, beside the 5-minute ones
  (`publish_kit.py`).

## 5. A thumbnail for every size

Krish, 2026-10-12: "I always want a video thumbnail for all video sizes
produced as an asset every time" (house rule THUMBNAIL_EVERY_SIZE): wide
1280 x 720 for the long cut, tall 1080 x 1920 for the short cut, with his
face and the real logos (LOGOS_AND_FACE), drawn from the piece's cover facts.

```
$env:MYMU_BROWSER = "msedge"     # Windows; in the cloud container: MYMU_BROWSER=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
python scripts/pages/build.py docs/plans/PLAN/cover-facts.json --thumbs --out WORK/thumbs
```

It writes `thumb-wide-1280x720.jpg`, `thumb-tall-1080x1920.jpg`,
`thumbs.json` (each file's sha256, the portrait, the logos) and
`thumbs-check.png`, both or neither. It needs the internet for Krish's
portrait and the wordmark. Never pass `--assets`: the logo paths are
relative to the facts file.

- A plan keeps its real logos as SVG in `docs/plans/PLAN/logos/`, so any
  checkout draws its thumbnails, a home computer included. The pile-up
  background is a picture git does not keep: without it the thumbnails are
  drawn on plain ink and the drawer says so. That is fine.
- A plan with no `logos/` folder (made before 12 October) cannot be drawn
  here: never draw a thumbnail without the real logos. Render and archive
  the cuts, but do not send them to the library (step 8) and record them
  without a thumbnail (step 9). Put a board item (`idea_id`,
  `"closes_on": "video"`) asking the session that holds the cover's logos
  to commit them as SVG under `docs/plans/PLAN/logos/` and draw the
  thumbnails. Video assets stays "thumbnail still to make" until then.
- Every company the piece names must be on each thumbnail. One missing goes
  into the cover facts as `"thumbs": {"strip": [{"logo": ..., "name": ...}]}`
  with its real logo, never a drawn stand-in.

## 6. Check it from the report

Read `WORK/long/NAME.report.json` and `WORK/short/NAME.report.json`, and
report these numbers back in plain words:

- `loudness.integrated` within -14 plus or minus 1 LU and
  `loudness.true_peak` at most -1.0 dBTP. With music, `bed_to_voice_lu`
  about 17 and the intro, voice and outro short-term about -16, -14 and
  -18. `normalisation` should be `linear`; `limited` comes with a warning.
- `intro_seconds`, `main_seconds`, `outro_seconds`, `total_seconds`, and
  `music` (the track id, its sha256 and the levels used).
- **The 90 second check is on his speech.** House rule TWO_CUTS gives the
  short cut at most 90 seconds, and story_check holds its script to 225
  words, 90 seconds at 150 words a minute. Krish has not yet ruled whether
  those 90 seconds include the sting and the 4 second end card, so make.py
  checks `main_seconds` (his words alone) and the warning gives
  `total_seconds` beside it. When `main_seconds` is over 90, tighten it with
  `remove` where he stumbled or paused; never speed it up unless Krish has
  said so in words for that cut, and then only through the config's
  `"speed": {"factor": F, "krish": "Krish, DATE: his words"}` (make.py
  refuses it without his words, and over 1.35). A sped cut is sped once, as
  one continuous file, then transcribed fresh on the sped clock: its cut
  points and its caption file come only from that new transcript, and the
  finished file's own transcript must hold every word of the script in order
  (Krish, 2026-10-24: "last time Codex glitched a bunch of words on the
  speedup and also misaligned the captions"). Still over: tell Krish both
  numbers before it goes anywhere. When only `total_seconds` is
  over 90 (his speech is inside it), say both numbers in your report; it is
  not a stop, and it is his open question in `WORKBENCH.md`.
- Every other line in `warnings`, said as it is.

Then look, with your own eyes, at `preview-SHAPE-intro.jpg` (when there is
a sting), every `preview-SHAPE-NN.jpg` (each graphic on its line, its words
readable on a phone, captions readable, his eyes in frame in the tall
shape), `NAME.cut.txt` (misheard names, US spellings, and every number
whole: "$150,000", "70%") and `thumbs-check.png`. A fault goes back to step 4
or 5.

## 7. File both cuts in the archive, once

```
python scripts/quick-edit/archive.py --subject "SUBJECT" --date YYYY-MM-DD --tall WORK/short/NAME-9x16.mp4 --wide WORK/long/NAME-16x9.mp4 --tall-thumb WORK/thumbs/thumb-tall-1080x1920.jpg --wide-thumb WORK/thumbs/thumb-wide-1280x720.jpg
```

`SUBJECT` and the date are `post.json`'s `subject` and `date`. It makes one
folder in the archive (Drive, `Video Engine > Archive`:
`MINDMAKE_ARCHIVE_ROOT`, else on Windows `runtime.archive_root` in
`config/studio.json`), named by date, subject and where to post, with each
thumbnail beside its video and `where-to-post.txt`; it never overwrites.
Leave out `--tall-thumb` and `--wide-thumb` only when step 5 could not draw
them. Home computers only. If the `Archive` folder does not exist it stops:
ask Krish to create it in Drive.

## 8. Into the post's library folder

The cuts and thumbnails reach Krish's library the same day (`AGENTS.md`),
in the post's `3 Video` folder. This skill never rebuilds the pack and never
writes the Visual gate or Pack steps: those are Claude Code's, and its
publish board step (`make-piece`, last step) puts the cuts on the publish
page and into the pack. Send the archive folder only when all of these hold:

1. **A thumbnail of each shape** was drawn in step 5 and filed beside its
   video in step 7. Without both, stop here: the cuts stay in the archive,
   the board item from step 5 stands, and nothing goes to the library.
2. **The piece's Visual gate reads done** in `making.py PIECE_ID show` (the
   pack's pictures and cover passed when it was built). If it does not,
   stop here and say so.
3. **The visual gate passes for the videos and thumbnails**, on a minimal
   post file in the work folder, `WORK/gate/post.json`. It has no
   `piece_id`, so nothing is recorded from it:

   ```json
   {"date": "YYYY-MM-DD", "subchannel": "SUBCHANNEL", "subject": "SUBJECT",
    "files": [
     {"kind": "fact-checked-text", "file": "FULL PATH TO docs/plans/DATE-draft-body.md"},
     {"kind": "video", "shape": "wide", "file": "FULL PATH TO WORK/long/NAME-16x9.mp4", "logos": ["..."]},
     {"kind": "video", "shape": "tall", "file": "FULL PATH TO WORK/short/NAME-9x16.mp4", "logos": ["..."]},
     {"kind": "thumbnail", "shape": "wide", "file": "FULL PATH TO WORK/thumbs/thumb-wide-1280x720.jpg", "logos": ["..."]},
     {"kind": "thumbnail", "shape": "tall", "file": "FULL PATH TO WORK/thumbs/thumb-tall-1080x1920.jpg", "logos": ["..."]}
    ]}
   ```

   Write each path in full with forward slashes (`C:/Users/krish/...` on
   Windows), so the JSON needs no escaping. A video's `logos` are the
   companies whose real logos are on screen in
   that cut: the logos of the pictures its cues show (`kit.json` and the
   plan list the cues), never one more. A thumbnail's are the companies the
   drawer drew: copy `thumbs.json`'s `companies`, one name per company (its
   `logos` lists the drawn rows, such as "Warner Music Group and BMG", and
   the gate reads those as both companies too). Then
   `python scripts/post-pack/visual_gate.py WORK/gate/post.json`. It must
   print **no line about a video or a thumbnail** ("declares no logo",
   "thumbs.json", "portrait", "the drawer drew no row or strip"). On this
   minimal post it always also prints the pack's own lines, "no picture
   carries the real logo of ..." and, for a piece about volume, one about
   the real pages: those are the pictures already gated in condition 2, and
   are expected here. A video that misses a company the piece names goes
   back to step 3 or 4 (cue the picture that carries it); never declare a
   logo that is not on screen.

Then send the archive folder into the post's video section, dry run first:

```
python scripts/post-pack/send.py "ARCHIVE FOLDER" --as "3 Posts/POST FOLDER/3 Video" --purpose "The finished videos and their thumbnails: wide 16:9 for YouTube and Substack, tall 9:16 for Shorts, Reels, TikTok and LinkedIn" --dry-run
```

then without `--dry-run`. `POST FOLDER` is the pack folder `making.py show`
names. An archive folder is not a pack, so `send.py` records nothing on the
piece.

## 9. Put both cuts on the record

With a thumbnail drawn and filed for that cut:

```
python scripts/post-pack/making.py PIECE_ID video long "Long cut, 16:9" "3 Video/SUBJECT - wide 16x9 - YouTube, Substack.mp4" --seconds N --thumb "3 Video/SUBJECT - wide 16x9 - thumbnail.jpg" --thumb-file WORK/thumbs/thumb-wide-1280x720.jpg --music TRACK_ID
python scripts/post-pack/making.py PIECE_ID video short "Short cut, 9:16" "3 Video/SUBJECT - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4" --seconds N --thumb "3 Video/SUBJECT - tall 9x16 - thumbnail.jpg" --thumb-file WORK/thumbs/thumb-tall-1080x1920.jpg --music TRACK_ID
python scripts/post-pack/making.py PIECE_ID show
```

With no thumbnail drawn for that cut, leave out `--thumb` and
`--thumb-file`: the step then reads "thumbnail still to make", which is the
truth. `--thumb` is refused without `--thumb-file`, the file `build.py
--thumbs` drew on this machine (`WORK/thumbs/...`, never a copy): it must be
that cut's shape (1280 x 720 for the long cut, 1080 x 1920 for the short)
and listed, by its sha256 and shape, in the `thumbs.json` beside it.
`--thumb-url` (its https link in the library) goes with `--thumb-file`,
never in place of it.

`--seconds` is the report's `total_seconds`; a fraction is fine, it is
rounded. `--music` is the report's track id, left out when the cut has
voice only. Add `--url https://...` and `--thumb-url https://...` once the
library has the Drive links; sending the same video path again replaces
that asset. Video assets is done only when both cuts are there, each with
its thumbnail. `archive.py` refuses a thumbnail of the wrong shape too.

## 10. The board and the workbench

Every board item about the piece carries `"idea_id": "PIECE_ID"` and, when
one step finishes it, `"closes_on"` (`record`, `video`). An item for a home
computer or another session is `"lane": "in_progress"`. Put on Krish
(`"on_you"`) only what is his, and only with `"only_you"`, an `https://`
`"link"` to what he acts on and a `"closes_on"` step: the engine refuses an
item on him without them and names the field it lacks (`WORKBENCH.md`, "The
board"). A question of his that no step closes (an approval, a remake, a
missing folder, Library Sync to move) goes `"in_progress"` with
`"closes_on": "session"`, its detail saying what would show it done, and
you ask him in your reply. Every new open item says how it ends (the
engine refuses one that does not, `open_needs_closes_on`). The
recordings lane writes its own take questions this way. In Claude Code, copy
the week's ticks once more (`make-piece`, "The week's ticks"). Update
`WORKBENCH.md` and end every reply with
https://controlcenter.krishraja.com/#/home?waiting=1.

## The backup machine

Read `.agents/skills/produce-video/references/backup-machine.md` before running on the backup machine or failing over to it; it holds this section in full.

## The music

Read `.agents/skills/produce-video/references/music.md` before you choose or lay the licensed music bed from the ledger (step 4); it holds this section in full. House rules it carries: MUSIC_BED.

## The intro sting

Read `.agents/skills/produce-video/references/intro-sting.md` before you place the intro sting (step 4); it holds this section in full. House rules it carries: INTRO_STING.

## Walls

- Nothing here posts, publishes, spends or deletes, and nothing is sent to
  anyone. `send.py` only files work in Krish's own library, by his standing
  instruction.
- No cut is finished, filed or recorded without its story intro, its audio
  treatment and its outro card, in both sizes, from a design Krish
  approved (`STORY_INTRO_OUTRO`, `config/story-intro-outro.json`): until
  then the report says "story intro and outro not designed yet".
- Nothing is sent to, read from or published in Descript, which Krish
  retired on 12 October, and nothing in Teleprompter is this skill's: it
  holds his scripts, put there by `make-piece`.
- Never move, rename or delete anything in the Inbox, the archive or the
  music folder, and never create or rename a Drive folder by hand; ask
  Krish. The archive's dated folder (`archive.py`) and the library sync are
  the only things that write there.
- Never browse Drive for audio. Only a ledger track that passes every check
  goes under a video.
- Never record an approval Krish did not give in words: a track, the
  levels, the sting, a take the matcher was unsure of, a take of an older
  script. Never write `--allow-missing`, `--allow-small`, `--krish-words`,
  `"intro_override"`, `"thumbnail_override"` or `"visual_gate_override"`
  words he did not say.
- The article body, the approval, the scripts, the pictures, the visual
  gate, the pack and the channel ticks are never written from here, except
  that a Claude Code session copies Krish's own channel ticks from the
  week's publish board onto the record (`make-piece`, "The week's ticks"),
  which records only what he ticked. A step that is not this skill's is not
  written, whatever the chat says.
- Never speed up a cut except on Krish's own words, quoted in its config's
  `"speed"` (Krish, 2026-10-16, of Friday's 90-second cut: "if I go over
  90sec, just speed the video up a bit in post"), and never declare a logo
  that is not on screen.
- A cloud session is read-only for the Studio (`read_only_untracked`), and
  these cuts never go through it: say nothing was produced in the Studio.
