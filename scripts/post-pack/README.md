# post-pack

Puts every asset of the publication into Krish's makeyourmindup asset library
on Drive, sorted and explained: the brand kit, the channel art, and one folder
for each post with everything it needs.

Krish, 2026-10-06: "make sure the brand kit is always updated here [the
library's Drive folder]", then "I want every single asset in there, permanent
and for individual posts, categorized properly, clear what to use them for,
and every new post gets its own new folder with all assets including the
article HTML I can copy paste, video scripts, etc etc".

**This is Krish's instruction for one folder.** The architecture doc's rule
0a.5 says agents never write into his Drive. His words above override it for
the makeyourmindup library folder only, and the writing is done by his own
always-on Windows machine. Every other Drive folder keeps rule 0a.5, and the
Studio's Video Engine Inbox and Archive are never written. The recordings
upload (below) reads the Inbox and nothing more.

## Why it works this way

The pieces and their artwork are made in cloud agent sessions (Krish,
2026-10-05: "I would rather work in here and have the pieces and their artwork
produced in html and assets"). A cloud session cannot put an image, a page or
a video into Drive: the Drive connector only takes text typed into the call,
and the container holds no Drive credentials. Krish's Windows machines are
always on and mirror Drive. So:

1. The session builds the post's pack with `build.py`.
2. `send.py` sends each file to the engine's private library (a private
   storage bucket, on signed URLs, with the engine key).
3. The library sync on Krish's active runner machine (`scripts/library-sync.ps1`,
   a scheduled task) takes every file that is ready, checks it, and writes it
   into the library folder within about ten minutes. Google Drive for desktop
   does the rest.

## The library

```
makeyourmindup\
  READ ME FIRST.txt
  1 Brand kit (permanent)\      the unpacked brand kit: guidelines, logos, colours, tokens, fonts, photography, applications
  2 Channel art (permanent)\    YouTube banner, watermark and description; Substack welcome copy; profile images
  3 Posts\
    2026-10-05 Mon follow.the.money - Who gets paid\
      READ ME.txt               what every file is for and where it goes
      1 Article\                substack-copy.html (paste into Substack), web-page.html, text-that-passed-the-fact-check.md, email-pictures-off.html
      2 Covers and images\      substack-cover-3x2.png, the pictures in the post, share cards
      3 Video\                  the script, the YouTube and Substack words, the finished videos named by the archive rule
      4 Social\                 the LinkedIn post and its card
```

Its place on Drive is `runtime.library_root` in `config/studio.json`, beside
the Studio's Video Engine folder (`MINDMAKE_LIBRARY_ROOT` overrides it on a
machine). `READ ME FIRST.txt` is Krish's; nothing here writes it.

A post's folder is `YYYY-MM-DD <Day> <subchannel> - <Subject>`, with the day
the date fell on and the subchannel as the brand writes it, or
`YYYY-MM-DD Launch - <Subject>` for a launch post. The subject is made safe for
Windows and Drive by the archive rule (`scripts/quick-edit/archive.py`,
reused, never copied) and cut at a space so the name stays within 100
characters.

The engine takes a file only inside `1 Brand kit (permanent)/`,
`2 Channel art (permanent)/` or one post's folder, and inside a post folder
only in its four sections or as its `READ ME.txt`. A name with a character
Windows refuses, a `.` or `..` folder, a hidden name, a type the library does
not hold or a path over 180 characters is refused with the reason. The rule
is written once as cases in `config/library-paths.cases.json`; the engine
(`apps/control-plane/api/library/_library.ts`) and these tools (`library.py`)
are both tested against every case. Change a case there first, then both.

## Build a post's pack

```
python scripts/post-pack/build.py WORKDIR/post.json [--out DIR] [--replace]
```

It copies the files into `DIR/<post folder>/` (by default
`.cache/post-pack/`, which git ignores), sorted into the four sections, and
writes `READ ME.txt`: the post, where it is published, then every file with
what it is for, in plain words. It also writes `.pack.json`, the list
`send.py` reads. It stops before copying anything if a file is missing, two
files would share a name, a name breaks the library's rule, or a file has
nothing saying what it is for. It never writes over a pack: `--replace`
builds again over one it made before. `example-who-gets-paid.json` is the
first post's facts.

`post.json`:

| Field | What it does |
|---|---|
| `date` | The publish date, `2026-10-05`. The day in the folder name is the day this date fell on. |
| `day` | Optional. `Mon`, `Wed` or `Fri`; refused if it is not the date's own day. |
| `subchannel` | `follow.the.money`, `mind.the.gap` or `under.the.hood` (or the ids with underscores). |
| `launch` | `true` for a launch post, with no `subchannel`. |
| `subject` | The post's short title, as it should read in the folder name: `Who gets paid`. |
| `headline` | Optional. The headline, shown in `READ ME.txt`. |
| `links` | Where it is published: `{"Substack": "https://...", "YouTube": "https://..."}`. |
| `files` | Every file, each with a `kind` (below), or a `category` (`article`, `covers`, `video` or `social`) and a `purpose`. Paths are relative to `post.json`. `name` renames a file; `purpose` replaces the usual words. |

| `kind` | Goes to | Named | What it is |
|---|---|---|---|
| `substack-copy` | 1 Article | `substack-copy.html` | `scripts/pages`' `substack.html`: open it, press the Copy buttons, paste into Substack |
| `web-page` | 1 Article | `web-page.html` | `scripts/pages`' `page.html` |
| `fact-checked-text` | 1 Article | `text-that-passed-the-fact-check.md` | the body whose fact check passed (or `"text"`) |
| `email-pictures-off` | 1 Article | `email-pictures-off.html` | `scripts/pages`' email with pictures hidden |
| `cover` | 2 Covers and images | `substack-cover-3x2.png` | `scripts/pages --cover`'s `cover.png` |
| `cover-crops`, `phone-check` | 2 Covers and images | `cover-crops.png`, `phone-images.png` | the checks `scripts/pages` draws; never posted |
| `image`, `share-card` | 2 Covers and images | their own names | a picture in the post; a card for sharing it |
| `video-script` | 3 Video | `video-script.md` (or its own type) | the script to record from (or `"text"`) |
| `video-words` | 3 Video | `youtube-and-substack-words.txt` | the engine's `package` answer, saved with `scripts/engine.py ... --full`, as text to paste |
| `video` | 3 Video | by the archive rule | a finished video, with `"shape": "tall"` or `"wide"`; `post_to` and `tiktok` as in `archive.py`; `share` for its smaller copy, which goes in `3 Video/share/` |
| `captions` | 3 Video | its own name | captions for the video |
| `linkedin-post` | 4 Social | `linkedin-post.txt` | the LinkedIn post (or `"text"`) |
| `linkedin-card` | 4 Social | `linkedin-card` and its type | the picture for the LinkedIn post |

## The story check

A `video-script` is packed only if it passes `story_check.py` (Krish,
2026-10-06, walk log F75: "they need to actually make sense to humans", then
"happy with that idea" of the five-point story check). It refuses a script
that does not open on a question, one of a minute or more with no spoken
outro after the call (so it never ends on the number), one that speaks an
article heading or a REAL or THEATRE stamp aloud, and one with lines still
marked NOT YET FACT-CHECKED. Run it on any script before sending it to Krish:

```
python scripts/post-pack/story_check.py SCRIPT
```

Only Krish's own words, in the file's `"story_check_override"` (starting
"Krish"), let a failing script through. The rest of the story check (every
beat follows from the last, every takeaway from a beat already told) is the
house rule STORY_ARC, which every writer and judge reads; reading the script
aloud once is still the last check.

## Send it

```
python scripts/post-pack/send.py ".cache/post-pack/2026-10-05 Mon follow.the.money - Who gets paid"
python scripts/post-pack/send.py CHANNEL_ART_FOLDER --as "2 Channel art (permanent)" --purpose "..."
python scripts/post-pack/send.py --brand-kit KIT_FOLDER_OR_ZIP
```

`--dry-run` shows every path and what it is for, and sends nothing. A pack
knows its own place (`3 Posts/<post folder>`); any other folder needs `--as`
and a `--purpose`. `--brand-kit` takes the unpacked kit or its `.zip` and
sends it into `1 Brand kit (permanent)`, each file with what its part of the
kit is for. It checks every path first and sends nothing if one fails, skips
files the library already has, and prints what it sent. It authenticates as
`scripts/engine.py` does, with that file's own code, and records the sender
as `codex` inside Codex and `claude_code` elsewhere (`--client` changes it).

Sending a file again after a newer version makes it the newest again, and the
sync writes it back. A file is at most 500 MiB.

## The rule that keeps it complete

Every post's launch set is packed with `build.py` and sent with `send.py` the
same day it is made, and a brand kit change is sent with
`send.py --brand-kit` (`AGENTS.md`; `WORKBENCH.md`, "Pick up from any tool").

## On Krish's machine: the library sync

`scripts/library-sync.ps1` runs as the scheduled task "Mindmake Library Sync"
on the active runner machine, as Krish, in his own session (Google Drive for
desktop mounts the drive there). Every ten minutes it:

- asks the engine what this machine has still to write (`GET
  /api/library/pending`, on the runner's own bearer, read from Windows
  Credential Manager the way the runner reads it);
- downloads each file to a temporary file, checks its size and sha256, and
  copies it to `<library root>\<path>`, making the folders it needs;
- tells the engine what it wrote (`POST /api/library/written`);
- once an hour, checks the brand kit published at
  `brand-kit/makeyourmindup-brand-kit.zip` on `main` of
  krishanraja/makeyourmindup, and when its sha256 differs from the last one it
  unpacked, unpacks it into `1 Brand kit (permanent)\`, writing over the files
  that changed and leaving every other file there. The version it wrote is in
  `brand-kit.json` beside its log.

It never deletes or renames anything in Drive. A newer version of a file it
wrote replaces its own earlier copy in place. A file someone else put there,
or one Krish changed, is kept, and the new version goes beside it as
`name (2).ext`. The brand kit is kept in step in place, as he asked. It
refuses to run if the library root is the Video Engine folder or inside it,
and it writes only under the three top folders.

Its log and state are in `Documents\MindmakeVideoStudio\library-sync\`, beside
the runner's folders and outside them.

### Install it, once

On the active runner machine, in PowerShell. The sync runs from a copy of this
repository of its own, `library-source`, beside the runner's folders: never
the runner's `runner-source`, which stays pinned to the commit the runner
runs, and never a copy a session works in, which may be left on a branch
without the script. These three lines make that copy (or bring it up to date)
and install from it, from any folder:

```
$dir = "$env:USERPROFILE\Documents\MindmakeVideoStudio\library-source"
if (Test-Path "$dir\.git") { git -C $dir pull --ff-only } else { git clone https://github.com/krishanraja/content-engine.git $dir }
powershell -NoProfile -ExecutionPolicy Bypass -File "$dir\scripts\install-library-sync.ps1"
```

The first try on 2026-10-06 ran `-File scripts\install-library-sync.ps1` from
a folder with no such file (not a copy of this repository, or one without the
day's changes), and PowerShell said the file does not exist; the full path
above works from anywhere. To pick up a newer
sync later, run the same three lines again.

It first runs the sync with `-Check`, which writes nothing: the library folder
must be reachable, the runner key must be on the machine and the engine must
answer. If any of that fails it says why and installs nothing. Then it
registers the task and starts it. To look without writing at any time:
`scripts\library-sync.ps1 -Check`. To stop it:
`Disable-ScheduledTask -TaskName "Mindmake Library Sync"`. Install it on one
machine only; after a failover to the standby, install it there and disable it
on the old primary.

Before the first install, the engine's migration
(`supabase/migrations/20261006120000_content_library.sql`) must be applied and
the engine deployed: the check asks the engine for its library.

## Recordings: from the Inbox to a cloud session

**What.** Every recording Krish drops into the Video Engine Inbox
(`H:\My Drive\Ventures\Active\Mindmaker\04_Content\Video Engine\Inbox`,
`MINDMAKE_MEDIA_INBOX` on the runner machines) reaches the engine's private
storage within about ten minutes, and any cloud session fetches it with one
command.

**Why.** On 2026-10-06 a session told Krish it could not reach his file. His
answer: "figure out how to never make that error again". The Google Drive
connector caps a download at 10 MB, and a recording runs 100 to 500 MB, so a
session never takes a recording from Drive, and Krish never moves a file by
hand. Then: "How can you do this automatically in the future, and just use
whichever machine is online at the time? the runner exists on both".

**How it gets there.** `scripts/recordings-upload.ps1` runs as the scheduled
task "Mindmake Recordings Upload" on both runner machines, the primary and the
standby, every five minutes. Whichever is online does the work. For each
mp4, mov, m4a, wav, mp3, mkv or webm file up to 500 MiB that has stopped
changing (the same size and time on two passes, or untouched for two
minutes), it works out the sha256 and MD5, asks the engine for a signed upload
URL, puts the bytes and confirms. The engine keys a recording by its sha256,
so when both machines send the same file one finds it already there, or its
upload is refused as a duplicate and its confirm finds the other's bytes:
storage ends with one copy and nothing fails twice. A failure on one file
never stops the rest; a file over 500 MiB is logged once and skipped. It reads
the Inbox and never writes, moves, renames or deletes anything there.

It runs on both machines and the library sync on one because they differ:
two machines writing the same Drive library would leave "name (2)" copies,
and this writes nothing to Drive.

Its log and its state (`recordings.json`: what this machine has sent, by name,
size and time) are in `Documents\MindmakeVideoStudio\recordings-upload\`.
Before each pass it pulls its own copy of the repository, `recordings-source`,
and when the script has changed it ends so the task starts the new one: a fix
on `main` reaches both machines with nothing for Krish to do.

**How a session uses it.**

```
python scripts/post-pack/recording.py list
python scripts/post-pack/recording.py get "2026-10-06 take 1.mp4"
python scripts/post-pack/recording.py get "2026-10-06 take 1.mp4" --wait 15
python scripts/post-pack/recording.py get NAME --out DIR
```

`list` prints the recordings, the newest first. `get` downloads the newest
recording with that name (an exact match first, then ignoring case, then
without the extension) into `.cache/recordings/` (git ignores it) or `--out`,
and checks its size and sha256 before keeping it. `--wait MINUTES` polls until
it appears, for a file Krish has just dropped. It authenticates as
`scripts/engine.py` does. Then edit it with `scripts/quick-edit`.

If a recording is missing, say which step failed: it is not in the Inbox yet,
neither runner machine has sent it (each machine's `recordings-upload.log`
says why), or the download failed (`recording.py` says how). Never tell Krish
a recording cannot be reached.

**What Krish does, once.** Approve the merge of `claude/recordings-lane` to
`main` (the engine deploys from it). Then paste this block into PowerShell on
each runner machine, the primary and the standby:

```
$dir = "$env:USERPROFILE\Documents\MindmakeVideoStudio\recordings-source"
if (-not (Test-Path "$dir\.git")) { if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }; git clone https://github.com/krishanraja/content-engine.git $dir }
git -C $dir fetch origin main
git -C $dir checkout -B main origin/main
git -C $dir log --oneline -1
powershell -NoProfile -ExecutionPolicy Bypass -File "$dir\scripts\install-recordings-upload.ps1"
```

The first version of this block (2026-10-06) only pulled or cloned, and on
both of Krish's machines it left a copy without the installer, so PowerShell
said the `-File` argument does not exist. This one repairs a folder that is
not a clone, sets the copy to exactly `main` whatever state it was in, and
prints the commit it holds before installing, so a stale copy shows itself.

The installer pulls the copy, then runs the upload once with `-Check`, which
sends nothing: the Inbox must be reachable, the runner key must be on the
machine and the engine must accept it on the recordings route. If any of that
fails it says why and installs nothing. Then it registers the task and starts
it. To stop it on a machine:
`Disable-ScheduledTask -TaskName "Mindmake Recordings Upload"`.

An `.mkv` recording also needs the migration
`supabase/migrations/20261006180000_content_library_recordings.sql`, which
lets the bucket hold Matroska. Until it is applied an `.mkv` is refused with
`recording_type_not_enabled` and the log says so; every other type works
without it. The project's storage upload limit must be at least 500 MiB, as
for the library.

## Size and storage

The library's bucket is private, holds only the file types a post, the brand
kit and the channel art use, and takes files up to 500 MiB (a two-minute 1080p
master runs 35 to 75 MB). The migration sets that limit on the bucket; the
project's own storage upload limit must be at least as large, or a large video
is refused by storage with "too large". The bytes go straight to storage on
signed URLs and never pass through the engine's functions.

## Checks

```
python scripts/post-pack/build.py --self-test
python scripts/post-pack/send.py --self-test
python scripts/post-pack/recording.py --self-test
npx vitest run tests/control-plane/library-path.test.ts tests/control-plane/library-routes.test.ts tests/control-plane/library-recordings.test.ts tests/control-plane/post-pack.test.ts tests/library-sync.test.ts tests/recordings-upload.test.ts
```

## What stays out of the repository

The packs, the images, the videos and the pages are media and working files,
and media are never committed (`scripts/check-no-secrets.ts`). The tools, this
README and the example facts are committed; everything they make goes to a
working folder or to `.cache/`.
