# post-pack

**Publish boards:** follow `docs/PUBLISH_BOARDS.md` and `config/boards.json.web_cutover`. After verified active cutover, both weeks live at content.krishraja.com and all new board interactions use the authenticated web API. Older Claude board instructions in this document are preserved compatibility/history, not directions to synchronize artifacts.


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
      0 Publish\                publish.html: start here, every channel in order with Copy buttons (docs/AMPLIFICATION.md)
      1 Article\                substack-copy.html (paste into Substack), web-page.html, text-that-passed-the-fact-check.md, email-pictures-off.html
      2 Covers and images\      a cover for every place (below), the pictures in the post, share cards
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
| `piece_id` | The piece's `content_ideas` id. With it, `build.py` and `send.py` record the pack and the visual gate on the piece's board row (`making.py`), so Control Center shows them within a second. |
| `files` | Every file, each with a `kind` (below), or a `category` (`article`, `covers`, `video` or `social`) and a `purpose`. Paths are relative to `post.json`. `name` renames a file; `purpose` replaces the usual words. |

| `kind` | Goes to | Named | What it is |
|---|---|---|---|
| `publish-kit` | 0 Publish | `publish.html` | `publish_kit.py`'s page: every channel in order, the file for each, and Copy buttons (docs/AMPLIFICATION.md) |
| `publish-manager` | 0 Publish | `publish-manager.html` | `publish_manager.py`'s self-contained page: the article with its pictures, every picture, every channel's words and the scripts, each with a Copy button |
| `substack-copy` | 1 Article | `substack-copy.html` | `scripts/pages`' `substack.html`: open it, press the Copy buttons, paste into Substack |
| `web-page` | 1 Article | `web-page.html` | `scripts/pages`' `page.html` |
| `fact-checked-text` | 1 Article | `text-that-passed-the-fact-check.md` | the body whose fact check passed (or `"text"`) |
| `email-pictures-off` | 1 Article | `email-pictures-off.html` | `scripts/pages`' email with pictures hidden |
| `cover` | 2 Covers and images | `substack-feed-1200x800.png` | `scripts/pages --cover`'s `cover.png`, the 3:2 cover. Never uploaded to Substack, whose upload box crops it |
| `substack-cover` | 2 Covers and images | `substack-cover-1200x630.png` | `cover-1200x630.png`: upload it in Substack's post settings |
| `share-card-cover` | 2 Covers and images | `share-card-1200x675.png` | `cover-1200x675.png`: LinkedIn and link previews |
| `square-cover` | 2 Covers and images | `square-1080x1080.png` | `cover-1080x1080.png`: the Instagram feed and the archive |
| `vertical-cover` | 2 Covers and images | `vertical-cover-1080x1920-shorts-tiktok-reels.png` | `cover-1080x1920.png`: the cover on Shorts, TikTok and Reels |

Every pack with a `cover` carries all four of the others (Krish, 2026-10-12:
"the cover crops need to be all individual images, a vertical cover thumbnail
for the shorts/tiktok etc as well, every post moving forward"). Each is added
by itself from beside `cover.png`, where `scripts/pages --cover` draws it;
a pack missing any, or holding one of the wrong size, is refused, and the
visual gate holds each to its own receipt (`cover-WxH.json`).

| `kind` | Goes to | Named | What it is |
|---|---|---|---|
| `cover-crops`, `phone-check` | 2 Covers and images | `cover-crops.png`, `phone-images.png` | the checks `scripts/pages` draws; never posted |
| `image`, `share-card` | 2 Covers and images | their own names | a picture in the post; a card for sharing it |
| `video-script` | 3 Video | `video-script.md` (or its own type) | the script to record from (or `"text"`) |
| `video-words` | 3 Video | `youtube-and-substack-words.txt` | the engine's `package` answer, saved with `scripts/engine.py ... --full`, as text to paste |
| `video` | 3 Video | by the archive rule | a finished video, with `"shape": "tall"` or `"wide"`; `post_to` and `tiktok` as in `archive.py`; `share` for its smaller copy, which goes in `3 Video/share/` |
| `captions` | 3 Video | its own name | captions for the video |
| `linkedin-post` | 4 Social | `linkedin-post.txt` | the LinkedIn post (or `"text"`) |
| `linkedin-card` | 4 Social | `linkedin-card` and its type | the picture for the LinkedIn post |

## The edge check

Krish, 2026-10-07, of the Higgsfield picture "Who keeps what", whose source
line was cut off at the bottom: "stuff like this can't happen - why do we not
check basic things like this?" "What's inside Higgsfield" had the same fault,
its dark card running off the bottom. Both had passed the phone check, which
measured how big the words were and never whether they fitted.

`build.py` now runs `edge_check.py` on every picture packed as an `image`:
anything other than the background along an edge (words, a card, a bar) means
the picture is cut off, and it is not packed. A solid frame or accent bar
painted along an edge is allowed. Only Krish's own words in
`"edge_check_override"` let a cut picture through. `scripts/pages/card.py`
checks the same thing before a picture becomes a PNG, from the page itself: it
refuses any word that the card's edge, or a box hiding what spills out of it,
cuts through.

    python scripts/post-pack/edge_check.py IMAGE [IMAGE ...]
    python scripts/post-pack/edge_check.py --self-test

## The publish manager

Krish, 2026-10-10: "there should just be a copy button. Same for pictures."
`publish_manager.py manager.json --out DIR` writes `publish-manager.html`,
one self-contained page with every picture embedded, a Copy button on every
word and every picture, Copy article (headings and pictures in place, as
Substack takes it), and Download on each picture. Pack it as
`publish-manager`.

    python scripts/post-pack/publish_manager.py WORKDIR/manager.json --out DIR
    python scripts/post-pack/publish_manager.py --self-test

## The publish page

Krish, 2026-10-09: "Build a durable amplification strategy that looks cohesive
and is really easy for me to take from Drive to Publish." The plan is
`docs/AMPLIFICATION.md`: one Substack Video post (the 5-minute long cut on
top, the article under it), then YouTube, then Shorts, TikTok and Instagram
with the 90-second short cut; LinkedIn, WhatsApp and Notes are optional.
`publish_kit.py publish.json --out DIR`
writes `publish.html` for one post; pack it as `publish-kit`.

    python scripts/post-pack/publish_kit.py WORKDIR/publish.json --out DIR
    python scripts/post-pack/publish_kit.py --self-test

## The week's publish board

Krish, 2026-10-12: "just give me one ... Publish Manager for the ... whole
week with 3 tabs on it for Mon / Weds / Fri, which we need to get to 100%.
Give me a tick box next to each one so I can tick as I go and you can
durably record that completion where it needs to be recorded. That Publish
Manager is what you create every Sunday and let me iterate inside until
we're done, and then I check off the list what I have done as I do it."

`week_board.py` builds that one page (its template is `week_board/`). Each
tab is a made piece's whole publish page (`publish_manager.py`'s, given with
`--day`), or a designed "not made yet" or "not picked" state. A made tab
opens with Record (each cut's script in Teleprompter by its title, and its
folder, from the making record's teleprompter field or a small JSON of ids,
and how the take comes back: dropped at the top of the Video Engine Inbox),
the two scripts to copy and the checklist; a tick also sits by each
channel's heading. Seven ticks make a day 100% (both cuts recorded, then
Substack, YouTube, Shorts, TikTok, Instagram); LinkedIn, WhatsApp and Notes
are optional. A day's piece comes from `--piece`, or from the week's picks
(`--options`, a saved `GET /api/week/options` answer, or `--live`, which
only reads): the piece of the day's series scheduled for its date in any
picked state, published included (the options' `scheduled` list), since
the publish watcher marks a piece published once its Substack post is live
and Krish still posts the rest from its tab.

    python scripts/post-pack/week_board.py --week 2026-10-12 --day mon=monday-publish.html --day fri=friday-publish.html \
        --piece mon=<uuid> --piece fri=<uuid> [--teleprompter mon=record.json] --live --previous <the board it replaces> --out week-board.html
    python scripts/post-pack/week_board.py --show <a board page or week-board.json> [--json]
    python scripts/post-pack/week_board.py --self-test
    npx vitest run tests/control-plane/week-board.test.ts

A rebuild never loses a day. `--previous` is the board being replaced (its
`week-board.json`, or its page as `Artifact read` saved it): a day it holds
as made or picked that the rebuild would show as not picked is refused, and
so is a made day with no publish page in the rebuild; `--unpick DAY` says a
day really has no piece now. With `--live`, a picked piece whose making
record has a publish page must come with it (`--day`). `--show` prints the
days a board holds, each day's state and piece: the piece a tick on that
day belongs to.

Every tick saves at once in the page's own store: `ticks/<day>-<step>`
(`done, at, day, piece_id, step, channel, label`) and `links/<day>`
(`article, youtube, at`). Publish it as an artifact with title "This Week's
Publish Board", icon `calendar` and capabilities `{"db": {}, "downloads":
true}`; the call is in `week-board.json`, written beside the page with the
week, each day's state and piece, and every tick id. A rebuilt board
republished to the same page keeps every tick, because the store stays with
the page and the ids depend only on the day and the step
(`fixtures/week-board/published-2026-10-12.json` holds the published
board's tick ids and steps, and the test runs the page's own script against
a stand-in store); make a new page each Sunday, with its own board item,
`week-publish-board-<Monday>`. A session copies each channel tick onto the
piece with `making.py <piece> posted <channel> [url]`; Record is done from
the takes on the record, never from a tick.

## The visual gate

Krish, 2026-10-10, of Friday's first cover and pictures: "we need to add all
the logos of the businesses that are related to what we are talking about ...
an article like this should screenshot as many live articles of model
releases ... it should pile up on top of one another visually ... The cover
and email thumbnail is really boring and losing it's personality ... it needs
to be a literal gate that stuff like this cannot be produced, whether in
static asset form or video."

`build.py` runs `visual_gate.py` on every pack and refuses it when:

- a company the fact-checked body names (`config/logo-registry.json`) has its
  real logo on no picture, not on the cover, or not declared on a video
  (`"logos": ["OpenAI", "Anthropic"]` on each `image`, `cover` and `video`
  entry: the companies whose real logos, from Brandfetch, it shows);
- the body is about volume ("so many", "every few months", a count of
  releases) and no picture is built from real pages: an `image` entry with
  `"evidence": {"pages": [{"url", "date", "shot"}, ...]}` of at least six
  real, dated pages, screenshotted and piled up;
- the cover did not come from `scripts/pages/build.py --cover` (its
  `cover.json` receipt must match the PNG), has no portrait, or has no logo
  rows when the piece names companies.

Only Krish's own words in the post file's `"visual_gate_override"` let a pack
through without. `python scripts/post-pack/visual_gate.py post.json` explains
what would pass or fail before packing.

## The story check

A `video-script` is packed only if it passes `story_check.py` (Krish,
2026-10-06, walk log F75: "they need to actually make sense to humans", then
"happy with that idea" of the five-point story check). It refuses a script
that holds anything but the words Krish says (stage directions, labels,
timings, headings, joke options: house rule SCRIPT_ONLY), one whose outro
never sends people to the article (HOOK_AND_CTA), one that does not open on a question, one of a minute or more with no spoken
outro after the call (so it never ends on the number), one that speaks an
article heading or a REAL or THEATRE stamp aloud, and one with lines still
marked NOT YET FACT-CHECKED. Run it on any script before sending it to Krish:

```
python scripts/post-pack/story_check.py --cut long SCRIPT    # or --cut short
```

Every piece has two scripts, one per cut, each with its own hook and outro
(house rule TWO_CUTS, Krish, 2026-10-11): the 5-minute long cut (3 minutes until Krish, 2026-10-19: "let's make the
3-minute scripts into 5-minute scripts and videos"), 675 to 825
spoken words, and the 90-second short cut, 160 to 225. Give each
`video-script` entry its `"cut": "long"` or `"cut": "short"` so the length is
checked; a file name that says `long`, `5min`, `short` or `90` does the same.
An entry that says neither is packed with a warning that its length was
checked against neither cut. `making.py <piece id> scripts long.md short.md`
checks both and records them on the piece, the long cut first; one script
alone never passes. A piece Krish called a 15-minute feature for
(`config/features.json`, house rule FEATURE) takes the feature third,
`scripts long.md short.md feature.md`, checked with `story_check.py --cut
feature` (its entry's `"cut": "feature"`); three scripts for any other piece
are refused. It records each script's hash and when each cut's words
last changed, and when a cut's words change while a take of it is on the
piece, it asks Krish on the board whether to use that take (one item,
`take-<sha12>`, never reopened once answered). The story check also warns
about a line saying the script was made with AI (house rule
NO_AI_DISCLOSURE_LINE, Krish, 2026-10-12: "Eliminate the "I made this with
AI" entirely - no need, it's like verbal diahorrea").

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

## Where a piece's files are

```
python scripts/post-pack/plan_files.py docs/plans/PLAN/post.json [--files DIR ...] [--json]
python scripts/post-pack/plan_files.py --self-test
```

A piece's `post.json` names each script and picture as it was called in the
working folder it was made in, which is usually on another machine.
`plan_files.py` finds the same files wherever they are on this machine, in
one order every tool shares (`scripts/quick-edit/kit.py` asks it): beside
`post.json`; for a script, the dated draft the repository keeps beside the
plan (`docs/plans/<date>-draft-script.md` and `-draft-script-90s.md`); the
pack staged here (`.cache/post-pack/<pack folder>`); each `--files` folder
(the working folder, or the post's library folder by packed names); then the
library on this machine (`MINDMAKE_LIBRARY_ROOT`, and on Windows
`runtime.library_root`). It only reads. Exit 0 when every script and picture
is found, 1 when any is not (each listed with every place it looked), 2 when
`post.json` cannot be read. So a piece's scripts are found anywhere the
repository is, and its pictures once the pack is sent, or with `--files`
until then.

## Recordings: from the Inbox to a cloud session

**What.** Every recording Krish drops into the Video Engine Inbox (Drive
folder `1H-PWmcwLkKCPHShBL6SYzsLzEbpa6795`, on H: at
`H:\My Drive\Ventures\Active Ventures\makeyourmindup\Video Engine\Inbox`)
reaches the engine's private storage within about ten minutes, and any cloud
session fetches it with one command.

**By its ID, from Google (since 2026-10-24).** Krish: "Surely, the whole point
of having a Google Drive is that there's a specific ID for a specific folder",
then "A." The engine's `recordings_drive_inbox` job
(`apps/control-plane/api/library/recordings/drive-inbox.ts`, every ten minutes)
lists the Inbox by its folder ID as the engine's Google service account,
read-only, and streams each new recording into the same store under its
sha256, with the manifest `confirm` writes. No home computer is needed, and a
rename or move of the folder changes nothing. It reads the Inbox through the
"anyone with the link" sharing on `makeyourmindup` (2026-10-24); if that is
turned off, share the Inbox with the service account as Viewer first. A failure (folder unshared
or gone, a copy that did not check, or a home computer reporting a problem)
fails the job, and Control Center shows it. The home computers' upload below
stays as the fallback until the job has carried a real take end to end; both
key by sha256, so they never make two copies.

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
python scripts/post-pack/recording.py get "recordings/<sha256>.mp4"     # a take already on a piece, by the path its record holds
python scripts/post-pack/recording.py get --sha256 <sha256>
```

`list` prints the recordings, the newest first. `get` downloads the newest
recording with that name (an exact match first, then ignoring case, then
without the extension) into `.cache/recordings/` (git ignores it) or `--out`,
and checks its size and sha256 before keeping it. A piece's making record
names each take by the engine's copy, `recordings/<sha256>.<ext>`
(`python scripts/engine.py GET /api/content-ideas/<id>/making --full` lists
them), so a session that picks up a piece whose takes are already recorded
fetches them by that path or by `--sha256`, with no file name. `--wait MINUTES` polls until
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

## The content watcher, kept by the recordings pass

Each recordings pass (`scripts/recordings-upload.ps1`, `Invoke-WatchKeeper`) also looks after
krishanraja/content-watcher on the same machine, found from its scheduled task `Mindmake Content
Watcher`: it pulls the watcher's clone (installed editable, so new code runs at once) and installs its
dependencies again when `pyproject.toml` changed; turns the task back on and caps a run at 30 minutes;
starts a run when the watcher has logged nothing for 6 minutes and no run is under way (its
`watch.heartbeat` names the stage); stops a run that has not moved for 25 minutes; and sends the
watcher's last log line (counts and class names only), every run of the last 6 hours summed by the
same keys (`recent`), stage, task state and last result with the pass's own report. When the task cannot start (its folder is gone, or Windows answers 0x8007010B,
"The directory name is invalid"), it finds the watcher's clone where it is now (beside where the task
pointed, beside this clone, or in `%USERPROFILE%\dev` and each folder in it, as `content-watcher` or
`video-compression`), clones the public repository there if there is none, and runs the watcher's own
`scripts\install-content-watch.ps1` from it, which installs the package from there and registers the
task again; at most once an hour. Both machines answered 0x8007010B on 28 October 2026, silent since
25 and 26 October (suspected: the local folder was renamed with the repository on 24 October). Problems
it cannot fix become lane problems (`watch_not_installed`, `watch_cannot_reach_engine`,
`watch_key_problem`, `watch_run_failed`, `watch_not_running`, `watch_update_failed`,
`watch_task_broken`), which the Inbox job names in Control Center. A session reads every machine's
last report with `GET /api/library/recordings/lane` on the engine key, and never asks Krish to open a
log (Krish, 2026-10-28: "i should never really need to copy and paste log files to you like this,
ever, this is ridiculous").

## Placing takes on the runners

**What.** Each take Krish drops in the Inbox is placed on its piece and cut by
the home computers themselves, within about fifteen minutes, with nothing
for him or a session to do. Krish, 2026-10-12: each recording "goes to the
right place when recorded".

**How.** At the end of every pass, on either machine, the recordings upload
(`scripts/recordings-upload.ps1`, above) lists the engine's takes and, when
one is held by no piece and is not in the answered book, runs with the pinned
Python (`%USERPROFILE%\Documents\MindmakeVideoStudio\runtime\python\Scripts\python.exe`,
built by `npm run bootstrap:python`):

```
python scripts/post-pack/recording_match.py --record --board --by "Recordings lane" --json
```

`recording_match.py` finds the pieces waiting for a recording this week and
next (Scripts done, Record not), hears the first 45 seconds of each new take
(faster-whisper; the words are cached by sha256), and decides the piece by
its words and the cut by its words or its length:

- **Sure**: it records the take on its piece and cut (`making.py recorded`),
  stamped with `script_sha256`, the hash of the script it was read from
  (the piece's current words for that cut). Record is done when both cuts
  have a take of their current words.
- **Unsure**: one board item, `take-<first 12 of its sha256>`, held in
  progress for a session and never on Krish's list: nothing he can press
  answers which take it is, so a session works it out, or asks him in its
  reply. When the piece is known the item names it (`idea_id`). It says
  `closes_on` `take_placed`, and the lane closes nothing: Control Center's
  done-check sweep closes it once the take is on a piece, lets it go once
  the lane notes that no waiting piece can be it (`"close_ref":
  {"no_piece": true}`, `making.py` `board_note`), and lets go of one no
  session has touched for a week. One the old lane put on him is moved off
  his list when it is asked again.
  It is asked once for each question (its status, its piece, older words or
  not), never again because a score or the closest piece shifted. The board
  is read first and an item is never reopened: one Krish answered, or a
  session closed, stays closed on both machines.
- **Old**: a take that arrived before any waiting piece's record began is
  none of their takes, and is left alone without being heard. It is not
  booked for good: the upload looks at it again six hours later.
- **Failed**: a take that cannot be heard (a transcriber that cannot decode,
  a file ffmpeg cannot read) is one `failed` line, naming the pinned install,
  never a stop for the others.

**The time rule, cut by cut.** `making.py scripts` keeps when each cut's
words last changed (`script_check.changed_at`), which moves only when that
cut's words change; a record from before the hashes counts as changed. A take
recorded after its own cut's time is a take of the current words and can be
placed, so a change to the long script never makes a short take of unchanged
words look old. When a take was recorded is the time its file says it was
made (its `creation_time`), when that falls after the piece's record began and
no later than it reached the engine; otherwise when it reached the engine. A
take recorded after the piece's record began (`started_at`, written once on
the record's first write and never moved) but before its cut's words last
changed is heard too: if it matches, it is unsure, "recorded before the
script last changed", and Krish says whether to use it. A take already on a
piece whose script's words changed after it no longer counts: `making.py
show` says so, Record shows "recorded from an older script", and it is asked
about the same way. `making.py recorded` refuses to stamp such a take as
current without his words (`--krish-words "Krish, DATE: ..."`), which it keeps
on the take.

**What it keeps.** The matcher keeps `.cache/recordings/answered.json` in the
recordings-source copy: every take it asked about, or left alone for a newer
take of the same cut, so it is never asked twice. A take it downloads only to
hear its opening is deleted once heard (the words stay cached by sha256), so
the runners' disks do not fill; a session that fetches a take on purpose
(`recording.py get`) keeps it. The upload keeps `placing.json` beside its log:
the takes a piece holds (learnt from the matcher's own answer) and when to
look again at a take no piece was waiting for (an hour), one that failed (a
quarter of an hour) or one older than every waiting piece (six hours). Both
runners may place the same take: recordings merge by path and the board
item's id is fixed, so nothing is doubled. Each machine's log says what it
placed and asked (`match:` lines).

**What it needs.** On each runner: the engine key in Credential Manager
(`scripts/engine-key.ps1`, once), the pinned Python with a faster_whisper
that decodes sound (`recording_match.py --check-transcriber`), and ffmpeg.
`install-recordings-upload.ps1` runs the upload with `-Check`. A problem with
sending (the Inbox, the runner key, the engine) stops the install, naming
it. A problem only with placing is the check's exit 3: it names it and
installs anyway, so that machine still sends recordings while the other
places them (`-RequirePlacing` makes it a stop).

It never writes to the Inbox, never sends anything outside the engine, and
never produces a video: that is `.agents/skills/produce-video`.

**On GitHub's machine (Wave 2, W2.3).** `.github/workflows/place-takes.yml`
places the takes too, with no schedule (Ruling, Krish, 2026-10-29: "zero Claude
routines"): the engine's Inbox job sends a `take-copied` repository_dispatch
whenever it copies a take or names new bytes (`api/library/_placeTakes.ts`,
on `PLACE_TAKES_DISPATCH_TOKEN`; without that token it sends nothing and says
`place_takes: not_configured`), and Run workflow starts it by hand. On ubuntu,
with the pinned transcriber and the faster-whisper model cached by its name,
it runs

```
python scripts/post-pack/recording_match.py --record --board --clock --by "Place takes" --json
```

`--clock` builds each placed take's word clock before the take is recorded:
the whole take heard as quick-edit hears it (`make.transcribe`, small.en, the
script's names as the hint), stamped with its provenance
(`quality.transcript_identity`), in `.cache/recordings/<sha256>.words.json`.
A take whose clock cannot be built is not recorded, so the next run tries it
again. The job keeps the report and the clocks as its `place-takes` artifact
(14 days), and only the two books (`answered.json`, `inbox-used.json`) in its
cache, never words or media. An unsure take leaves the job green (asked on the
board); a failure turns it red.

**The Inbox's used/ convention.** A take placed on its piece belongs in the
Inbox's `used/` folder: the run says `belongs in used/` for it, and
`.cache/recordings/inbox-used.json` books it as moved there (`"moved":
false`). A duplicate is reported and kept, never placed, asked about or
deleted: the same bytes under a second name (the engine keeps every name a
take was copied under; on a home computer, a second file), or the same take
again under other bytes (`same_take`: every word heard at the same moment and
the same length, which two reads of one script never share). Nothing is moved
in Drive: the engine reads the Inbox with a read-only key, so the move to
`used/` is by hand until Krish gives a route the right to write there. The
upload lane never reads a subfolder, so a take in `used/` is never sent again.

**The home computers stay the fallback** until one real take has gone end to
end through the job: their pass above keeps running unchanged. Both write a
take by its path and the board item's id is fixed, so a take placed by both
is held once.

## The scripts: the close, reading age 12 and the read-back

`story_check.py --cut long|short --series <lane_slot> SCRIPT` refuses a
script of a minute or more that does not close the way Krish ruled on
2026-10-31 (house rule SCRIPT_CLOSE): "the last paragraph of all my scripts
still sounds a bit bossy and preachy", then "Yes, replace it". So the beat
before the last line says the one thing he would do, in his first person, in
at most three sentences with at most one order, and never the retired
"Here's what I'd do with this info if I were you" (his 2026-10-21 lead-in);
the last sentence is still exactly "The full deep dive is at
makeyourmindup.ai." with nothing after it. It also refuses a script holding
more figures or names than a listener keeps heard once (house rule
LISTENING, "Yes, a hard rule", 2026-10-31; the numbers are LISTENING in
`apps/control-plane/api/_houseRules.ts`). The series
line is retired the same day (house rule SERIES_OPENER; "we need to cut that
opening line from every content piece moving forward and just launch
straight in to "I put GrokBot and Muse head to head" etc."): nothing asks
for it or for "I'm Krish", and `--series` is still accepted and ignored so
older callers work. It also refuses one a 12-year-old could not follow
heard once (house rule R7; Krish, 2026-10-12: "Every single script should
be understandable by a 12-year-old. I can't even understand what I'm
reading off the teleprompter. I thought we had hard gates for this?"): a
spoken sentence over 20 words, more than 12 words a sentence on average, a
reading grade over 6, a quotation over four words, or a word on its list
(licensing, settlement, revenue, model and the rest) its sentence does not
explain. The gate's numbers are read from
`apps/control-plane/api/_houseRules.ts` (`SCRIPT_READING`), the one place
they live; the old series lines stay beside them (`SERIES_OPENERS`) for the
records made under them. `making.py scripts` runs it with the piece's
series, and `build.py` with the post's subchannel. Then two fresh readers,
each an ordinary 12-year-old hearing the script once, must find nothing that
loses them (their prompts are in `.agents/skills/make-piece/SKILL.md`, "The
Scripts step"); `making.py PIECE read-back CUT --readers ...` records it on
the script check, tied to the words they heard.

    python scripts/post-pack/story_check.py --cut long --series follow_the_money docs/plans/2026-10-12-draft-script.md
    python scripts/post-pack/making.py PIECE read-back long --readers "reader A, a fresh subagent" "reader B, a fresh subagent"

## Scripts into Teleprompter

Krish, 2026-10-12: "Also note that Descript is permanently gone,
teleprompter.com is permanently in, connected via MCP here", on the terms:
"One script per cut, in a folder per piece (e.g. "Mon 12 Oct
follow.the.money"). When the words change, the same script is updated in
place. Nothing is ever deleted." On 2026-10-28 his standing yes of that day
("Yes, automatic, Monday now") was replaced by "Once I approve, the two
scripts will go to teleprompter", and "Server sends directly". His words,
the tools allowed, where his approval is read and the server's key's name
are in `config/teleprompter.json`.

The server sends first. His Approve scripts press on a day's Drafts step
writes `picks/<day>-scripts` (read as the `approvals` view), and the board's
server (`apps/control-plane/api/board/_presses.ts`) first reads the piece's
making record and holds any words the scripts' check did not pass or no two
fresh readers read back, his saved edits included (`send.status: "held"`):
the same gate `plan` holds a session to, below. Otherwise it calls
`sendApprovedScripts` (`apps/control-plane/api/_teleprompter.ts`) with the
document he wrote and records its answer in it as `send`. It checks that approval itself before any request (his
document, this piece, not withdrawn, each cut's exact hash), holds the tools
it may call in code, finds or makes the piece's folder, creates or updates
one script per cut and reads each back. A send that read back is written to
the piece's making record (its `teleprompter` field), so `pending` sees it;
when that write fails, `send.recorded` is false and a session runs `record`
with the ids in `send`. Until Krish places his key
(`TELEPROMPTER_API_KEY`) it makes no request and answers `no_key`. Until
both are in place, a session sends instead, as below. The board names the
folder and the scripts with this file's `folder_name` and `script_title`, on
the piece's post.json when there is one, so both routes find the same folder.

`teleprompter_send.py` makes no Teleprompter call. `plan` reads the piece's
making record, refuses unless the scripts' check passed, each file holds the
words it passed, each cut to send was read back, and Krish approved those
exact words on the week's publish board (a document he wrote himself, read
from the board's `approvals` view, naming the piece and each cut's hash; `--week`
names the board week), and prints the calls the
session makes with the Teleprompter connector, in order: `list_folders` and
`create_folder` only when the record holds no folder for the piece ("Mon 12
Oct follow.the.money - Who gets paid for AI songs"); for each cut never
sent, `list_scripts_in_folder` and `create_script` with its title ("Mon 12
Oct - 5-minute - Who gets paid for AI songs"), its spoken words (markdown
stripped, a blank line between paragraphs) and its duration (its words at
150 a minute, in whole seconds); for a cut whose words changed,
`update_script` of the same script with only its text and duration; then the
`record` line, which writes the folder, the cut's script, its title and the
hash of the words sent onto `meta.making.teleprompter` (`making.py
teleprompter` is the same). Ids are uppercase UUIDs. His font size, speed,
alignment and timed speed are never sent, and nothing is ever deleted,
moved or renamed. A failed send is recorded with what Teleprompter said and
when (`record --error`, with `--folder` once `create_folder` gave one, so no
second folder is made). `pending` lists every cut in flight this week and
next whose current words Teleprompter lacks or holds older, with its plan
line; a cut sent by hand that the record does not hold yet gets its
`WORKBENCH.md` record line instead, and a cut whose send failed less than
six hours ago is held back until its words change or `--retry`.

    python scripts/post-pack/teleprompter_send.py pending [--week YYYY-MM-DD] [--retry]
    python scripts/post-pack/teleprompter_send.py plan PIECE long.md short.md [--post post.json] [--week YYYY-MM-DD]
    python scripts/post-pack/teleprompter_send.py plan PIECE long.md short.md feature.md   # a 15-minute feature piece: a third script, same folder
    python scripts/post-pack/teleprompter_send.py record PIECE CUT --folder ID --script ID --sha SHA256 [--title T] | --error "what Teleprompter said"
    python scripts/post-pack/teleprompter_send.py --self-test

Teleprompter holds scripts only. A take comes back one way: Krish drops it
at the top of the Video Engine Inbox and the runners place it, as above.

Descript was retired on 12 October, the day its lane was built (Krish:
"Descript is permanently gone"); `descript_send.py` and `descript_take.py`
were removed with it, and the recordings upload's single-file send that
only they used.

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
python scripts/post-pack/recording_match.py --self-test
python scripts/post-pack/making.py --self-test
python scripts/post-pack/plan_files.py --self-test
python scripts/post-pack/story_check.py --self-test
python scripts/post-pack/teleprompter_send.py --self-test
python scripts/post-pack/week_board.py --self-test
npx vitest run tests/control-plane/library-path.test.ts tests/control-plane/library-routes.test.ts tests/control-plane/library-recordings.test.ts tests/control-plane/post-pack.test.ts tests/control-plane/making.test.ts tests/control-plane/recording-match.test.ts tests/library-sync.test.ts tests/recordings-upload.test.ts
npx vitest run tests/control-plane/teleprompter-send.test.ts tests/control-plane/week-board.test.ts tests/control-plane/week-options.test.ts tests/control-plane/house-rules.test.ts
```

## What stays out of the repository

The packs, the images, the videos and the pages are media and working files,
and media are never committed (`scripts/check-no-secrets.ts`). The tools, this
README and the example facts are committed; everything they make goes to a
working folder or to `.cache/`.

## Working files: a session's saved work, from Drive to any session

A session's drawn work (screenshots, cards, panels, charts, story clips) lives in its own container until it is
saved. Save it into the post's folder on Drive as `<part>/working <date>/` (for example
`3 Video/working 17 Oct/`). Every pass of `recordings-upload.ps1` runs `working.py publish`, which sends those
folders to the library at the same path, with a `.working.json` list. A cloud session gets them back with
`python3 scripts/post-pack/working.py fetch "<post folder>"`, sha256 checked, without the Drive connector.
