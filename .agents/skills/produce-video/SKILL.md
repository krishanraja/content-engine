---
name: produce-video
description: Produce Krish's finished videos once he has recorded them. Use when he says he has dropped, recorded or uploaded his video or recordings, or asks to produce, cut or make the video or videos for a piece or a day, such as 'I've dropped the video', 'the recordings are in the Inbox', 'produce Monday's video' or 'make the videos for this week'. It works out by itself which new recording is which piece's long or short cut, with no file name or piece id needed, then makes the 16:9 long cut and the 9:16 short cut, each with the approved intro sting, the licensed music bed from the ledger and a thumbnail for its size, files them, packs them and records them on the piece. Runs end to end on either Windows home computer, the main one or the backup; a cloud session matches and prepares, then hands rendering to a home computer. It is not the one-line launcher of the video-engine skill, not a Studio job from a production brief, and not for general questions about video or editing.
---

# Produce the video

Krish, 2026-10-12: "give me a skill (or the codex equivalent) that
understands everything going on here that invokes properly when I engage it
for video production - i.e I will need to have dropped a video in the exact
location, it will need to know which one it is (ideally automatiically
without me having to give the exact filename), and exactly what to do from
there, how to engage the backup runner machine if needed etc etc."

This is that skill. Video is Codex's step (Krish, 2026-10-11: "I'm going to
transfer all video production iteration through to Codex"; `MAKING_OWNERS`
in `apps/control-plane/api/_making.ts`). Claude Code on a home computer runs
the same skill when Krish engages it there. Every write says who wrote it:
`--by Codex` or `--by "Claude Code"` (or `MAKING_BY`). Nothing before the
recordings (the article, the scripts, the cover) and nothing after the
record (the publish board, the posting) is this skill's to change.

Both cuts render through `scripts/quick-edit/make.py`, the only path that
makes 16:9 as well as 9:16 and the only one that carries music and an
opening sting (the Studio renders 9:16 only and refuses both). Each cut is
its own recording of its own script (house rule TWO_CUTS): the long cut
renders with `--only 16x9`, the short cut with `--only 9x16`.

Commands are written `python`, as on Windows; it is `python3` in the cloud.

## What Krish does

1. Records each cut as its own file: the long cut from the long script, the
   short cut from the short one.
2. Drops each file at the top of the Video Engine Inbox, Drive
   `makeyourmindup > Video Engine > Inbox`
   (`H:\My Drive\Ventures\Active\makeyourmindup\Video Engine\Inbox`). Never
   in a subfolder: the upload lane reads only the top level. Any name will
   do. A file over 500 MiB is skipped by the lane, so that one is produced
   on a home computer, straight from H:.
3. Tells Codex (or Claude Code on a home computer) "I've dropped the video".
   A take reaches the engine within about ten minutes, from whichever home
   computer is on.

He never has to give a file name or a piece id. He is asked only when the
matcher is unsure, and for approvals that are his alone (a music track, the
mix levels, the sting's design).

## Before anything

Read `AGENTS.md`, `WORKBENCH.md`, `docs/CADENCE.md` ("Who owns what, and
where things live") and `scripts/quick-edit/README.md`. Read the board and
his replies (`WORKBENCH.md`, "The board"). This skill does not use the
Studio; if a session touches it, `docs/ENGINE_SESSION.md` applies and a
cloud session is read-only for it.

## 1. Preflight: which tool, which machine

- **A cloud session** (Claude Code or Codex on the web) has no H: drive, no
  music folder and no archive. It may find and match the takes (step 2),
  build the kit (step 3), plan (step 4, with `faster-whisper` installed),
  and draw the thumbnails if it holds the cover's work folder (step 5). It
  never renders the finished cuts: it leaves a board item for a home
  computer with the piece's `idea_id` and `"closes_on": "video"`, naming the
  commands still to run, and says so.
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
  it never by itself means a failover (see "The backup machine").
- **Whether this machine can render.** `python scripts/quick-edit/make.py
  --doctor` (or `--doctor --json`). It checks ffmpeg and ffprobe and every
  filter, the caption font, `faster-whisper`, Pillow, Playwright, node, the
  music folder and the archive folder, the music ledger, every approved
  track's file against its sha256, and the sting. Exit 1: stop and fix what
  it names (`python -m pip install faster-whisper` for the transcriber).
  "No approved track" and "sting still a candidate" are expected until Krish
  approves them: the cuts then go without them and the report says so.

## 2. Find and match the takes

```
python scripts/post-pack/recording_match.py            # the engine's copies of the Inbox (any machine)
python scripts/post-pack/recording_match.py --inbox    # a home computer: the Inbox on H: itself
```

It finds the pieces waiting for a recording this week and next (Scripts
done, Record not), hears the first 45 seconds of every new take, and prints
one line per file:

- `placed`: the piece and cut, and why (its words, its length or its name).
- `unsure`: ask Krish, using the line it printed. Never guess. When he names
  it in words, record it by hand with the command below.
- `left alone`: an older take of the same cut, or a take that arrived before
  the scripts were checked. Mention it to Krish in one line: if the scripts
  were checked again after he recorded, his real take shows here.
- `failed`: say which step failed (the download broke, no transcriber, the
  engine could not be reached).
- A file still arriving reads as unsure: run it again in a couple of minutes.
- A take Krish says he dropped that shows nowhere: say which step it is
  stuck at. It has not reached the Inbox, or neither home computer has sent
  it yet (allow about ten minutes; `--inbox` on a home computer sees it
  sooner). Never fetch it through the Drive connector.

Exit 0: every new take placed (or none). Exit 2: at least one is unsure.
Exit 1: something failed. `--json` gives the same answer to read.

Then record the sure matches on their pieces (the recordings lane only
uploads files; nothing else writes the Record step):

```
python scripts/post-pack/recording_match.py [--inbox] --record --by Codex      # --by "Claude Code" in Claude Code
python scripts/post-pack/making.py --by Codex PIECE_ID recorded long "PATH IT PRINTED" --seconds N   # a take Krish named in words
python scripts/post-pack/making.py PIECE_ID show
```

Record reads done once both cuts are in. Work the pieces in the order it
printed, the nearest first. When this session has an https link, record it
on the piece: `python scripts/post-pack/making.py --by Codex PIECE_ID
session LINK`.

Get each placed take onto this machine: `python
scripts/post-pack/recording.py get "FILE NAME"` (the name the matcher
printed; it uses the copy the matcher downloaded into `.cache/recordings`).
A take over 500 MiB is never in the engine: copy it from the Inbox to a
local work folder (`Copy-Item`, never a move). quick-edit never works on
the Inbox itself.

## 3. Build the kit, once per cut

Use a local work folder per piece, such as `.cache/produce/DATE-SUBJECT`
(git ignores `.cache`). The piece's `post.json` is the one under
`docs/plans/` whose `piece_id` is the piece.

```
python scripts/quick-edit/kit.py docs/plans/PLAN/post.json --cut long --recording LONG_TAKE --out WORK/kit [--files FOLDER]
python scripts/quick-edit/kit.py docs/plans/PLAN/post.json --cut short --recording SHORT_TAKE --out WORK/kit [--files FOLDER]
```

It draws the house end cards for both shapes, the wide frame in the
subchannel's look, the tall strap, a panel per picture, and writes a
starter `long.json` or `short.json` for make.py (intro and music on auto,
the same piece id on both, so both cuts get the same track). `--files` says
where the post's pictures and scripts are when they are not beside
`post.json`: the working folder, or on a home computer the post's library
folder, `H:\My Drive\Ventures\Active\makeyourmindup\3 Posts\POST FOLDER`
(the pack folder `making.py show` names). Exit 1 prints `CHECK` lines: fix
each and run it again. A config edited by hand is never overwritten.

## 4. Plan, then render each cut

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
  `{"restart_near": "m:ss"}`). A misheard name: `replacements`.
- **Render** each cut from its own recording with its own `--only`. Never
  `--archive` on either run (that files the two cuts in two folders), and
  never one recording for both shapes.
- Each cut carries the intro sting when Krish has approved it and the music
  bed from the ledger when a licensed, approved track fits (both sections
  below). Neither ever blocks a render.

## 5. A thumbnail for every size

Krish, 2026-10-12: "I always want a video thumbnail for all video sizes
produced as an asset every time" (house rule THUMBNAIL_EVERY_SIZE): wide
1280 x 720 for the long cut, tall 1080 x 1920 for the short cut, with his
face and the real logos (LOGOS_AND_FACE), drawn from the piece's cover facts.

```
$env:MYMU_BROWSER = "msedge"     # Windows; in the cloud container: MYMU_BROWSER=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
python scripts/pages/build.py docs/plans/PLAN/cover-facts.json --assets COVER_WORK_FOLDER --thumbs --out WORK/thumbs
```

It writes `thumb-wide-1280x720.jpg`, `thumb-tall-1080x1920.jpg`,
`thumbs.json` (each file's sha256, the portrait, the logos) and
`thumbs-check.png`, both or neither. `--assets` is the folder the cover was
drawn from, because the facts' logo paths are relative to it.

- The logos live only in the cover's work folder, so the session that drew
  the cover draws the thumbnails with it and packs them (`make-piece`, its
  visual gate step). On a machine without that folder, use the ones the
  pack already holds: `3 Video\SUBJECT - wide 16x9 - thumbnail.jpg` and
  `... - tall 9x16 - thumbnail.jpg` in the post's library folder.
- If neither exists, never draw a thumbnail without the real logos. Render,
  file and record the cuts anyway, and put a board item (`idea_id`,
  `"closes_on": "video"`) asking the session that holds the cover to draw
  and pack them. Video assets stays "thumbnail still to make" until then.
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
- **The 90 second check.** A short cut whose total runs over 90 seconds is
  in `warnings`. Tighten it with `remove` where he stumbled; never speed it
  up. Still over: tell Krish before it goes anywhere.
- Every other line in `warnings`, said as it is.

Then look, with your own eyes, at `preview-SHAPE-intro.jpg` (when there is
a sting), every `preview-SHAPE-NN.jpg` (each graphic on its line, captions
readable, his eyes in frame in the tall shape), `NAME.cut.txt` (misheard
names) and `thumbs-check.png`. A fault goes back to step 4 or 5.

## 7. File both cuts in the archive, once

```
python scripts/quick-edit/archive.py --subject "SUBJECT" --date YYYY-MM-DD --tall WORK/short/NAME-9x16.mp4 --wide WORK/long/NAME-16x9.mp4 --tall-thumb WORK/thumbs/thumb-tall-1080x1920.jpg --wide-thumb WORK/thumbs/thumb-wide-1280x720.jpg
```

`SUBJECT` and the date are `post.json`'s `subject` and `date`. It makes one
folder in `MINDMAKE_ARCHIVE_ROOT` (Drive, `Video Engine > Archive`), named
by date, subject and where to post, with each thumbnail beside its video
and `where-to-post.txt`; it never overwrites. Home computers only. If the
`Archive` folder does not exist it stops: ask Krish to create it in Drive.

## 8. Into the pack and the library

The cuts and thumbnails reach Krish's library the same day (`AGENTS.md`).

- **With the post's working folder on this machine** (every file
  `post.json` names is there): add four entries to `post.json`, each
  declaring the logo of every company the piece names:
  `{"kind": "video", "shape": "wide", "file": ..., "share": ..., "logos": [...]}`,
  `{"kind": "thumbnail", "shape": "wide", "file": ..., "logos": [...]}`,
  and the same for `tall`. Then `python scripts/post-pack/visual_gate.py
  post.json` must say ready, `python scripts/post-pack/making.py --by Codex
  PIECE_ID visual-gate post.json`, `python scripts/post-pack/build.py
  post.json --replace` (it refuses a video with no thumbnail of its shape),
  and `python scripts/post-pack/send.py "PACK FOLDER"`.
- **Without it** (the usual case on a home computer: the piece was made in
  a cloud session), never build a partial pack. Send the archive folder
  into the post's video section, dry run first:
  `python scripts/post-pack/send.py "ARCHIVE FOLDER" --as "3 Posts/POST FOLDER/3 Video" --purpose "The finished videos and their thumbnails: wide 16:9 for YouTube and Substack, tall 9:16 for Shorts, Reels, TikTok and LinkedIn" --dry-run`,
  then without `--dry-run`. The publish board step (`make-piece`, last
  step) puts them in the publish page.

## 9. Put both cuts on the record

```
python scripts/post-pack/making.py --by Codex PIECE_ID video long "Long cut, 16:9" "3 Video/SUBJECT - wide 16x9 - YouTube, Substack.mp4" --seconds N --thumb "3 Video/SUBJECT - wide 16x9 - thumbnail.jpg" --music TRACK_ID
python scripts/post-pack/making.py --by Codex PIECE_ID video short "Short cut, 9:16" "3 Video/SUBJECT - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4" --seconds N --thumb "3 Video/SUBJECT - tall 9x16 - thumbnail.jpg" --music TRACK_ID
python scripts/post-pack/making.py PIECE_ID show
```

`--seconds` is the report's `total_seconds`; `--music` is the report's
track id, left out when the cut has voice only. Add `--url https://...` and
`--thumb-url https://...` once the library has the Drive links; sending the
same video path again replaces that asset. Video assets is done only when
both cuts are there, each with its thumbnail.

## 10. The board and the workbench

Every board item about the piece carries `"idea_id": "PIECE_ID"` and, when
one step finishes it, `"closes_on"` (`record`, `video`). Put on Krish only
what is his: an unsure take, an approval, a missing folder, Library Sync to
move. Update `WORKBENCH.md` and end every reply with
https://controlcenter.krishraja.com/#/board.

## The backup machine

Quick-edit production needs no switch of any kind. The matcher, the kit,
the renders, the thumbnails, the archive and the record run on whichever
home computer Krish is at, the main one or the backup, and nothing in the
database changes. On the backup:

- Krish turns it on and signs in to Windows as himself, so Google Drive for
  desktop mounts H:.
- The work copy is at the latest `main` and `scripts/engine-key.ps1` has been
  run there once. `make.py --doctor` must say ready; an approved sting
  renders itself once on a machine that has none.
- The recordings upload already runs on both machines: nothing to move.
- **Library Sync runs only on the machine it is installed on, and does not
  follow the runner role.** With the main machine off, the pack and the cuts
  sent in step 8 wait in the engine until Krish moves it: install and enable
  it on the machine in use (`docs/OPERATIONS.md`, "Library sync",
  `scripts/install-library-sync.ps1` from `library-source`) and
  `Disable-ScheduledTask -TaskName "Mindmake Library Sync"` on the other.
  Tell him; he does it.

The Studio failover is a different thing. It is only for work that goes
through the Studio's queue (production briefs, review decisions and edits
sent from Control Center), never for these cuts, and only when Krish asks
for it in words. Never infer that one is needed from a missing heartbeat
alone: a sleeping laptop, a Windows update or a lost Drive mount all
silence a healthy main machine. The steps (`docs/OPERATIONS.md`, "Primary
and cold standby"):

1. **Main machine.** `powershell -NoProfile -ExecutionPolicy Bypass -File
   scripts/runner.ps1 -Mode status` shows zero pending and zero conflicted
   receipt and project journals and no active command. Then
   `Stop-ScheduledTask -TaskName "Mindmake Video Studio Runner"` and
   `Disable-ScheduledTask -TaskName "Mindmake Video Studio Runner"`, and
   `scripts/runner.ps1 -Mode stop-preflight` must return exactly
   `"active": false`. If the main machine cannot be inspected, stop here.
2. **Cloud, read only.** The health route shows the main machine silent
   (`runners.active.fresh` false) and nothing waiting: no queued or leased
   command and no claimable brief (`runners.waiting`).
3. **Backup.** `Enable-ScheduledTask` and `Start-ScheduledTask` for the same
   task name. `runner.ps1 -Mode status` must show `active: true`, the
   expected commit, provenance `verified`, Drive `ready` and zero conflicts.
4. **Krish switches the active role** in Control Center (OS, Systems, Studio
   runners, "Switch the active runner", with a reason). An agent cannot and
   never tries.
5. Move Library Sync as above. Failing back is the same in reverse; the
   machine that is not running keeps its task disabled.

## The music

Krish, 2026-10-12: "I am also going to get some licensed audio to put behind
my videos, so help me prepare to put it somewhere you and codex will always
know where that is, and use it correctly (high volume during the intro, low
whilst I am talking, higher during the outro)." (house rule MUSIC_BED)

- **Where it lives.** Drive, `makeyourmindup > 00_Brand-Assets > 07_Music`:
  on the home computers
  `H:\My Drive\Ventures\Active\makeyourmindup\00_Brand-Assets\07_Music`,
  read from `MINDMAKE_MUSIC_ROOT`, else `runtime.music_root` in
  `config/studio.json`. Each licence certificate sits beside its track.
  Audio is never committed, and never goes in the Inbox (the lane would send
  it as a recording).
- **The ledger** is `config/music-library.json`, committed. A track is used
  only when it is in the ledger, approved by Krish in his words, its licence
  in date and covering every place the cut goes (wide: YouTube and
  Substack; tall: Shorts, Reels, TikTok and LinkedIn), cleared for YouTube
  Content ID, long enough or loopable, and its file matches its sha256.
  Never browse Drive for audio, and never use a file because it is in the
  folder. `python scripts/quick-edit/music.py list` and `music.py check`
  show where things stand; `music.py pick --seconds N --piece PIECE_ID
  --shape 16x9` shows which track a cut gets and why the others were passed
  over.
- **How a track gets in.** Krish licenses it, saves the audio and its
  certificate in the music folder, and says so. On a home computer:

  ```
  python scripts/quick-edit/music.py add "MUSIC FOLDER\track.wav" --provider NAME --licence-id ID --licence-file "licences\track.pdf" --title .. --artist .. --platforms youtube,substack,shorts,tiktok,reels,linkedin --content-id-cleared yes --acquired-on YYYY-MM-DD [--expires-on ..] [--intro-cue S] [--outro-cue S] [--loopable]
  ```

  It measures the file and writes it as `proposed`; a track already listed
  by its file name (NO CURVES, today) is completed in place. Let him hear
  it under a cut; only when he approves it in words, `music.py approve
  TRACK_ID --words "his exact words"`. Commit and push the ledger (pull
  first), so both machines and every session read the same one.
- **The levels**, in the ledger's `levels`, proposed until Krish approves
  them by ear: about -16 LUFS over the sting, about -31 under his voice
  (about 17 LU below his -14) and about -18 over the end card; down over
  0.5 seconds as his face comes in, up over 0.8 seconds after his last word;
  a set rise and fall over time, never a compressor keyed to his voice.
  The finished mix is -14 LUFS integrated, plus or minus 1, with true peak
  at most -1 dBTP, measured after the encode. When he approves them,
  `music.py approve-levels --words "his exact words"`, then commit and push.

## The intro sting

Krish, 2026-10-12: "I also want the video to have a 1-2 sec animated make
your mind up intro visual before my face comes in" (house rule
INTRO_STING). It is a 1.5 second clip per shape (1 to 2 allowed) with a
silent track, joined in front of the captioned video, so no word, caption or
graphic moves; the music is high over it.

- Its design is two Remotion compositions in `apps/renderer`, named in
  `config/intro-sting.json`. make.py uses the sting only when that file's
  `status` is `approved`; until then the cuts go without it and the report
  says so. Never hold a render for it.
- `python scripts/quick-edit/intro.py status` says where it stands (and if
  the compositions are not in the renderer yet, the design is still being
  built: carry on without it).
- To approve it: `intro.py render --preview`, show Krish both shapes, and
  only on his words `intro.py approve --words "his exact words"` (bound to
  the preview he saw). Commit and push, then `intro.py render` on each
  machine that renders. A sting changed after approval is not used until he
  approves it again.

## Walls

- Nothing here posts, publishes, spends or deletes, and nothing is sent to
  anyone. `send.py` only files work in Krish's own library, by his standing
  instruction.
- Never move, rename or delete anything in the Inbox, the archive or the
  music folder, and never create or rename a Drive folder by hand; ask
  Krish. The archive's dated folder (`archive.py`) and the library sync are
  the only things that write there.
- Never browse Drive for audio. Only a ledger track that passes every check
  goes under a video.
- Never record an approval Krish did not give in words: a track, the
  levels, the sting, a take the matcher was unsure of.
- The article body, the approval, the scripts and the channel ticks are
  never written from here. A step that is not this skill's is not written,
  whatever the chat says.
- Never speed up a cut, and never declare a logo that is not on screen.
- A cloud session is read-only for the Studio (`read_only_untracked`), and
  these cuts never go through it: say nothing was produced in the Studio.
