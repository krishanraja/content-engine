# quick-edit

Turns one to-camera recording into a finished tall (9:16) and wide (16:9)
video in the makeyourmindup look: the intro sting first, stumbles and dead
air cut, graphics on the right lines, captions timed to the words, the
licensed music bed under it all, even loudness, the end card on the end.

It is the only path that makes both shapes, and the only one that carries
music and an opening sting (the Studio renders 9:16 only and refuses both).
By house rule TWO_CUTS each cut is its own recording: the long cut renders
with `--only 16x9`, the short cut with `--only 9x16`, each from its own config.

It is for videos that do not go through the Studio: a launch hello, a quick
take, or a piece whose Studio job is not set up yet. It made both launch
videos on 2026-10-05 (`editions/2026-10-launch/video-kit/`). A Studio piece
still goes through the Studio.

It never reads or writes the Studio's Inbox or job folders. Work on a copy
of the recording in a local folder. It writes into Drive only when you ask it
to file the finished videos in the archive (`--archive`, below), and then only
a new folder there; otherwise it never writes into Drive (architecture doc,
ruling 0d).

## Setup

Python 3.10 or later, `ffmpeg` and `ffprobe` on the PATH, and the pinned
faster-whisper for the transcript: `python -m pip install --require-hashes -r
requirements.lock.txt` from the repository root (on a home computer, `npm run
bootstrap:python` builds the pinned runtime). Never an unpinned `pip install
faster-whisper`: on 2026-10-12 that gave faster-whisper 1.2.1 with av 19.0.1,
a pair that imports and then fails on every take; the lock pins 1.2.0 with av
18.1.0, which work. The caption font, Archivo Black, is in `fonts/` under its
open licence (`fonts/OFL.txt`).

Check a machine before a video, the backup machine above all:

```
python make.py --doctor          # or --doctor --json
```

It names the machine (and on Windows whether it is the Studio's active or
standby runner; quick-edit renders on either), then checks ffmpeg and
ffprobe and every filter the edit and the mix use, the caption font,
faster-whisper, Pillow, Playwright, node (for the sting), the music folder
(`MINDMAKE_MUSIC_ROOT`, else `runtime.music_root`) and the archive folder
(`MINDMAKE_ARCHIVE_ROOT`, else on Windows `runtime.archive_root` in
`config/studio.json`), the music ledger, every approved track's file against
its sha256, and the intro sting for every shape and series. It exits 1 when
anything a render needs is missing, and a faster-whisper that is missing or
cannot decode a second of sound is one of those (`transcriber.py` decodes a
tone, as the matcher's `--check-transcriber` does): the matcher and the
transcript both need it, so a FAIL there stops the run before any take is
touched, and its line names the pinned install.

## Run it

```
python make.py long.json --out OUTDIR-long --only 16x9 --plan
python make.py long.json --out OUTDIR-long --only 16x9 --share-mib 29
python make.py short.json --out OUTDIR-short --only 9x16 --plan
python make.py short.json --out OUTDIR-short --only 9x16 --share-mib 29
```

1. **Plan first.** `--plan` transcribes (the first run takes a minute or two
   on a laptop), then prints every cut with its words, every graphic's start
   and end in the edited video, and the caption count. Under `shapes` it says
   what each cut will get: the sting or why not, the music track or why not,
   the sting, main and end card lengths, and any warning (the short cut's
   speech over 90 seconds, for one, or a config with no cues whose post has
   pictures). It renders nothing. It exits with an error if a
   graphic's anchor words were not found, and stops if a cut's words were not
   found. Fix the config and plan again until it is clean.
2. **Render.** Without `--plan`, it renders into `OUTDIR`. Each shape takes a
   few minutes. Without `--only` it renders both shapes from one recording,
   which is for a quick take only: a piece's two cuts are two recordings.
3. **Look at it.** `OUTDIR` gets `preview-<shape>-intro.jpg` (a frame in the
   sting, when there is one) and `preview-<shape>-NN.jpg`: one frame at the
   opening, one inside every graphic, and one on the end card, all moved on
   by the sting's length. Check that every graphic sits on its line, the
   captions read, and in the tall shape the face crop keeps the eyes in
   frame. `<name>.cut.txt` is the full caption text after the cuts: proofread
   it for misheard names and for US spellings (house rule BRITISH_SPELLING).
   A heard word that is the script's word spelt the US way ("check" for the
   script's "cheque", "neighbor", "license" for the noun) is captioned as the
   script spells it, and the plan and the report list each under
   `spellings`; a US spelling no script word covers (an ad-lib) is a warning
   that names it: add a `replacements` entry, unless it is a name or a
   quotation. A number the transcriber split at its punctuation ("$150" and
   ",000", "$5" and ".4", "70" and "%") is one caption word again.
   `<name>.report.json` has the numbers (below): read its `warnings` before
   the video goes anywhere.
4. **Share.** `--share-mib 29` also writes `OUTDIR/share/` copies under 29 MiB,
   because chat uploads stop at 30 MiB and a two-minute 1080p master runs 35
   to 75 MB. Every platform re-compresses on upload, so the share copy looks
   the same on screen. `share.py` does the same for any single file:
   `python share.py in.mp4 out.mp4 --cap-mib 29`.
5. **File it.** `--archive` copies the finished videos, and their share
   copies, into the archive in a folder that says when, what and where to
   post (below). `--plan --archive` shows the folder and file names first.
   With two cuts rendered in two runs, file them together once both are
   done, with `archive.py --tall ... --wide ...`, so they share one folder.

The transcript is cached as `OUTDIR/<name>.words.json`, and the cut is cached
until the cuts or the pause rule change, so a re-render after a graphics or
caption fix skips both.

## The config

One JSON file per video. Paths are relative to the config file.

| Field | What it does |
|---|---|
| `name` | Prefix for every output file. |
| `source` | The recording. |
| `crop` | `[w, h, x, y]` of the real picture inside the frame. A phone recording shown in a 1280x720 frame is `[404, 720, 438, 0]`. `"auto"` finds it with ffmpeg's cropdetect and narrows a wider picture to a centred 9:16 window. |
| `face` | Optional. `[y, h]` inside the crop: the band shown under a graphic in the tall shape. Keep the eyes and the top of the head in it. `[100, 450]` worked for the launch videos, so without it the band is 100 to 550 of every 720 pixels down. |
| `remove` | The words to cut, as said: `{"say": "So, you know,", "after": "is coming"}`. `after` is the words just before, so the right instance is cut. `{"restart_near": "3:02"}` cuts a restarted sentence from the time alone: it finds the words said again near that point in the raw recording and cuts from the first time they were said up to the clean retake (Krish, 2026-10-06: "I messed up and restarted my sentence at 3m02s"). `--plan` prints the words it cut; check them. An index pair `[first, last]` into the words file also works, but only for that exact transcript. |
| `replacements` | `[["Chris", "Krish"], ["theater", "theatre"], ["computing power group", "computing power grows"]]`: fixes what the transcriber mishears, and keeps British spelling. A phrase of several words is matched as a run and replaced as one caption word group. Every video also gets the fixes in `DEFAULT_FIXES` in `make.py` first, the names the transcriber has got wrong before ("Bike Dance" for ByteDance, Krish, 2026-10-07): when a video misspells a name, add it there so the next one cannot. Captions only; the audio is untouched. |
| `logo` | The makeyourmindup logo in the opening seconds of the tall video, on by default (Krish, 2026-10-07: "put the Make Your Mind Up logo in the first few seconds of the video somewhere on vertical video"). Without the field, the masthead sits on an ink pill above the captions for 3 seconds and fades out. `{"png": ..., "seconds": 3}` uses another full-frame transparent image; `false` leaves it out. It is laid on the main before the sting is joined in front, so with a sting it starts as his face comes in, never over the sting. |
| `intro` | The sting before his face. `"auto"` (the default) is the house sting once Krish has approved it (`config/intro-sting.json`, below), in the colour of the piece's series; until then the cut has no intro and the report says so. `false` leaves it out. `{"9x16": file, "16x9": file}` names clips (1 to 2 seconds each), used only when a clip is the approved house render for that shape and series (the same sha256), or when the config carries Krish's own words in `intro_override`; otherwise the cut has no intro and the report says why. A clip's own sound is never used: silence is laid under it. A sting problem never stops a render. |
| `intro_override` | Krish's own words, starting "Krish", letting a clip that is not the approved sting open the cut. The report quotes them. Never written for him. |
| `series` | The piece's series (or `subchannel`), for the sting's colour: `follow_the_money`, `mind_the_gap` or `under_the_hood`, in any spelling. Without it, make.py reads the subchannel from the post the kit was made from, else uses follow.the.money's colour and says so. |
| `music` | The bed under the whole video. `"auto"` (the default) is `music.py`'s pick for this piece among the approved, licensed tracks; with none, the cut has voice only and the report says why. `false` is voice only. A track id uses that track, if it can be used. Both cuts of a piece ask for the same length: the long cut's recording as kit.py measured it (`kit.json`, `recording_seconds`) plus the most a sting and the end card add, so a licensed track that covers the long cut goes under both; only when the long cut's kit is not made yet do they ask for 240 seconds. |
| `music_seconds` | Optional. The length of music the piece needs, in place of the one read from `kit.json`. |
| `piece_id` | Optional. Ties both cuts of one piece to the same music (else `subject`, else `name`). |
| `script` | The script the recording was made from. Its names (ByteDance, Higgsfield, OpenAI) go to the transcriber as a hint, so it spells them as written. |
| `cues` | The graphics. Each has an `id`, a `panel` image (`{aspect}` becomes `9x16` or `16x9`), and the `start` and `end` words it covers. The graphic comes in 0.15 seconds before `start` and leaves 0.35 seconds after `end` (`lead` and `tail` change that). Optional, but a config with no cues whose post has pictures is warned about in `--plan` and the report: it would go out as a bare talking head. |
| `frame16` | The wide shape's background: brand panels left and right of the speaker. |
| `strap` | The name strap in the tall shape: a `png`, the words it follows (`after`) and how long it stays (`seconds`). |
| `endcard` | `{"9x16": ..., "16x9": ...}`: a short clip, joined to the end. Its own sound is never used: silence is laid under it, as under the sting, with the bed over it, and the plan and the report say so when the clip had a sound of its own (only a track in the music ledger goes under a cut, house rule MUSIC_BED). kit.py's end cards are silent. |
| `max_gap`, `pad_before`, `pad_after` | The pause rule: any silence over `max_gap` seconds (0.35) is cut, keeping `pad_before` (0.10) before the next word and `pad_after` (0.16) after the last one. |
| `subject` | For `--archive`: the piece's short title, as it should read in the archive, such as `"Who gets paid"`. `--archive` stops without it. |
| `date` | For `--archive`: the publish date, `YYYY-MM-DD`. Without it, the folder carries the day it was filed, London time. |
| `post_to` | For `--archive`: every place to post, in place of the usual ones, such as `["YouTube", "LinkedIn"]`. Each video keeps the places it suits. |
| `tiktok` | For `--archive`: `true` sends the tall video to TikTok as well. |

## The kit: a piece's graphics and starter config

A piece made through `make-piece` needs no graphics script of its own:
`kit.py` draws everything make.py needs for one cut from the piece's
`post.json`, and writes a starter config.

From the repository root:

```
python scripts/post-pack/plan_files.py docs/plans/PLAN/post.json [--files DIR]   # where its files are, first
python scripts/quick-edit/kit.py docs/plans/PLAN/post.json --cut long --recording LONG_TAKE --out WORK/kit [--files DIR]
python scripts/quick-edit/kit.py docs/plans/PLAN/post.json --cut short --recording SHORT_TAKE --out WORK/kit [--files DIR]
```

It finds the piece's scripts and pictures the way every tool does
(`scripts/post-pack/plan_files.py`): beside `post.json`; the scripts in the
dated drafts the repository keeps beside the plan
(`docs/plans/DATE-draft-script.md` and `-draft-script-90s.md`), so they need
no `--files`; the pack staged on this machine; each `--files` folder; then
the library on this machine. So `--files` is needed only for the pictures,
and only until the pack is sent: once `send.py` has sent it, a home computer
finds the post's library folder by itself (`runtime.library_root`). In a
cloud session, give the working folder the piece was made in.

- **Exit 2**: stop and fix the input (a script that is nowhere, with every
  place it looked; a `--files` path that is not a folder; an `--out` folder
  that belongs to another piece). Nothing is written.
- **Exit 1**: a `CHECK` line for each problem. Each one means the cut would
  go out without a picture's evidence, so fix it and run kit.py again:
  - a picture that is nowhere on this machine: give its folder with `--files`;
  - a picture no line of the script brings in: add its cue to `<cut>.json` by
    hand (`id`, `panel`, and the words he says over it as `start` and `end`).
    A config edited by hand is kept, and a picture cued there counts as cued.
    A picture named only where his face is by design (the opening line or the
    call to action) is a note, never a CHECK;
  - a cued picture whose words come out under the size a viewer can read in
    this cut's own shape (39 pixels tall, 21 wide, from house rule
    SUBSTACK_FIT): draw a version of the picture for video, with fewer and
    bigger words, and give its folder with `--files`; or take the cue out by
    hand and ask Krish.
  Only Krish's own words turn a CHECK into a note: `--allow-missing "Krish,
  YYYY-MM-DD: his words"` for a picture the cut goes without, `--allow-small
  "Krish, YYYY-MM-DD: his words"` for a panel that goes out small. Anything
  that does not start with "Krish" is refused. His words are kept in
  `kit.json` and in the cut's config (its `kit` block) beside the pictures
  they let through, so make.py quotes them instead of warning.
- **Exit 0**: clean. The first line says where each script came from.

It writes the house end cards for both shapes, the wide frame in the
subchannel's look, the tall strap, a panel per picture, the cut's script,
`<cut>.json` (intro and music on auto, the same `piece_id` on both cuts, a
cue per picture the script brings in) and `kit.json`, which also keeps each
cut's `recording_seconds` (ffprobe) for the music. A config edited by hand is
never overwritten.

## The graphics

Every graphic is a PNG at its exact pixel size, so ffmpeg only places it and
never scales text. Render them from HTML at that size with a transparent
background (Playwright, `omitBackground: true`).

| Image | Size | Where it goes |
|---|---|---|
| Tall panel | 1080 x 1000 | The top of the frame. The speaker drops to a 920-pixel face band below it, on ink, and the captions move under the panel. |
| Wide panel | 1314 x 1080 | The right of the frame. The speaker slides to the left edge (606 wide) while it shows. |
| Wide frame (`frame16`) | 1920 x 1080 | Behind everything in the wide shape. The speaker's column is the middle 606 pixels (x 657 to 1263); put the brand on either side. |
| Strap | 1080 x 1920, transparent | Over the whole tall frame. Keep the pills clear of the captions at the top. |
| End card | 1080 x 1920 and 1920 x 1080, about 4 seconds, silent audio | After the last word. |

Captions are Archivo Black, cream on an ink box, with numbers in mint: 70
pixels in the tall shape (top third, or under a panel), 48 in the wide shape
(bottom of the speaker's column).

## The intro sting

Krish, 2026-10-12: "I also want the video to have a 1-2 sec animated make
your mind up intro visual before my face comes in". It is a clip per shape,
1.5 seconds (1 to 2 allowed), joined in front of the captioned main, so no
word, caption or graphic moves. The music is high over it.

The design is two Remotion compositions in `apps/renderer`, named in
`config/intro-sting.json`, one per shape. Each takes the piece's series as a
prop (`{"series": "follow_the_money"}`, `"mind_the_gap"` or
`"under_the_hood"`) and draws that series' colour; a piece with none gets
follow.the.money's.

**No design is approved yet.** On 2026-10-12 Krish turned down the first one
he was shown: "it's ok, it's a bit boring and colourless and vanilla - and
just what Powerpoint would do in 2008" (`last_decision` in the config). Until
he approves another, every cut goes without a sting.

```
python intro.py status [--json]                   # approval, his last word, source hash, what is rendered here
python intro.py render --preview                  # every shape and series, to show Krish
python intro.py approve --words "his exact words" # records them and the hash of the previews he saw
python intro.py render                            # the approved sting, on each machine that renders
```

**The source hash** binds an approval to exactly what he saw. It covers the
files the sting is built from (every file under `apps/renderer/src` with
"sting" in its path, the sting modules the registering file imports, and
every file those import in turn, relative imports followed to the end, so a
shared house component counts too), the `<Composition>` elements that
register the sting's ids, and its seconds, composition names and series.
Only files git tracks are hashed, each text file with CRLF turned to LF
first, so a Windows checkout and a Linux one give the same hash
(`.gitattributes` also keeps `apps/renderer` LF). A sting file git ignores
(any PNG), one git does not track yet, or an asset reached through
`staticFile()` is refused by name, because no other machine would have it.
An approval with no 64-character hash is no approval.

While `status` is `candidate`, `render` without `--preview` refuses and
make.py renders without an intro. Renders go to
`.cache/quick-edit/intro/<hash>-<shape>-<series>.mp4` (previews
`preview-<hash>-<shape>-<series>.mp4`; 30 fps, square pixels, yuv420p, a
silent 48 kHz stereo track), cached by the source's hash. A sting whose
source changes after approval is not used until he approves it again.
make.py (and `--plan`, so a problem shows early) renders an approved sting
itself, once, if the machine has none yet.

## The music

Krish, 2026-10-12: "I am also going to get some licensed audio to put behind
my videos, so help me prepare to put it somewhere you and codex will always
know where that is, and use it correctly (high volume during the intro, low
whilst I am talking, higher during the outro)."

- **Where the audio lives.** Google Drive, makeyourmindup >
  00_Brand-Assets > 07_Music (Drive folder
  `1pmPWx8vTOZuUXkp-WjhLlCTvof8MrRxK`): on the runner machines
  `H:\My Drive\Ventures\Active\makeyourmindup\00_Brand-Assets\07_Music`. The
  folder is `MINDMAKE_MUSIC_ROOT`, else `runtime.music_root` in
  `config/studio.json`. On a computer without that H: drive (a Mac, say),
  set `MINDMAKE_MUSIC_ROOT` to where Google Drive puts the same folder. Keep
  each licence certificate beside its track, in the same folder. Audio is
  never committed.
- **The ledger** is `config/music-library.json`, committed. Each track
  records who made it and where it came from, the licence (id, type,
  licensee, certificate, start and end, which platforms, monetisation,
  YouTube Content ID clearance, attribution, restrictions), the file
  (relative to the music folder, sha256, bytes, length, sample rate), its
  measured loudness and true peak, its intro and outro cue points, its mood,
  and Krish's approval in his words. `"loopable": true` marks a track that
  loops cleanly from its intro cue.
- **What is ever used.** Only a track in the ledger, approved by Krish, whose
  licence is in date and covers every place either cut of the piece goes
  (the wide cut: YouTube and Substack; the tall cut: Shorts, Reels, TikTok
  and LinkedIn), cleared for YouTube Content ID, long enough for the piece
  or loopable, and whose file matches its sha256. Nothing browses Drive for
  audio.
- **One track for both cuts.** make.py renders one cut at a time and cannot
  know the other's length, so each cut asks for what the pair needs: a
  licence for all six places, and at least `PIECE_SECONDS` (240, four
  minutes) of music from the intro cue, or a loopable track. The piece's id
  sets where its rotation through the approved tracks starts, and both cuts
  take the first track in it that fits. A track shorter than four minutes is
  picked only if it is marked loopable.

```
python music.py list
python music.py check                                    # the ledger, and the files where the folder is reachable
python music.py add "<music folder>/track.wav" --provider NAME --licence-id ID --licence-file "<music folder>/track certificate.pdf" \
    --title .. --artist .. --platforms youtube,substack,shorts,tiktok,reels,linkedin --content-id-cleared yes \
    --acquired-on YYYY-MM-DD [--expires-on ..] [--intro-cue S] [--outro-cue S] [--loopable]
python music.py approve TRACK_ID --words "his exact words"
python music.py approve-levels --words "his exact words"
python music.py pick --piece PIECE_ID --both-cuts [--seconds LONG_CUT]   # the one track both cuts get, and why the others were passed over
python music.py pick --seconds 190 --piece PIECE_ID --shape 16x9    # one cut alone
```

`add` measures the file and writes it as `proposed`; only `approve`, with
Krish's own words, makes it usable. `pick --both-cuts` is what make.py's
`"auto"` does: the same piece gets the same track on both cuts, and
different pieces rotate through the approved ones.

**The levels** are in the ledger's `levels`, proposed until Krish approves
them by ear: the music at about -16 LUFS over the sting, about -31 LUFS under
his voice (about 17 LU under his -14), and about -18 LUFS over the end card.
It ramps down over 0.5 seconds as his face comes in, so it is at the bed
level by his first word, and up over 0.8 seconds from his last word. A track
with an outro cue has its ending crossfaded in there. It is a time envelope
(`volume` with `eval=frame`), not sidechain compression: the cut is already
tight, so a sidechain would only pump. Each stretch's gain comes from the
track's own loudness where it sits, measured before the mix.

**The mix.** His voice is set to -14 LUFS, the bed is laid under the whole
video, the two are summed (`amix` with `normalize=0`), limited at -2 dBTP,
and the final mix gets the two-pass loudness pass (`loudnorm`, linear, so it
is one gain), steered by the ebur128 meter. After the encode the file is
measured again: integrated -14 +-1 LU and true peak at most -1 dBTP, or the
report warns.

## The report

`<name>.report.json` keeps what it always had and adds, per shape under
`shapes`, and at the top level when one shape was rendered (the house way):

- `intro_seconds`, `main_seconds`, `outro_seconds` (the end card) and
  `total_seconds`, and `intro` (which sting, its sha256);
- `music`: the track id, title, sha256, the levels used, the gain on each
  stretch and how the track was laid (straight, looped, or to its outro
  cue), or null;
- `loudness`: `integrated`, `true_peak`, `intro_short_term`,
  `voice_short_term` and `outro_short_term` (each stretch where its level
  holds), `bed_to_voice_lu` (from the voice and bed stems alone), and whether
  the final pass was a plain gain;
- `warnings`: no sting and why, no music and why, levels still proposed, the
  short cut's speech over 90 seconds, a config with no cues whose post has
  pictures, loudness out of range.

**The 90 second check.** House rule TWO_CUTS gives the short cut at most 90
seconds, and story_check holds its script to 225 words, 90 seconds at 150
words a minute. Krish has not yet ruled whether the 90 seconds include the
sting and the 4 second end card, so the check reads one named figure,
`TALL_CAP` in `make.py`: today `main_seconds`, his speech alone. The warning
gives `total_seconds` beside it. If he rules that the 90 seconds is the whole
video, `TALL_CAP` measures `total_s` instead.

The stems and the mix are in `OUTDIR/audio-<shape>/` (`dialog.wav`,
`bed.wav`, `mix.wav`) for anyone who wants to listen to one alone.

## Tests

```
python make.py --self-test       # the cuts, the clock, the previews, the join order, the intro gate, the 90 second check,
                                 # numbers joined in the captions, the script's spellings, the end card's sound never mixed
python spelling.py --self-test   # British and US spellings of the same word, never a different word
python transcriber.py            # does faster-whisper decode a second of sound here (exit 1 and the pinned fix when not)
python music.py --self-test      # the ledger, the pick (one track for both cuts), and a real bed measured against the levels
python intro.py --self-test      # a synthetic sting through the finishing path, the source hash and the approval gate
python kit.py --self-test        # the kit, where it finds a piece's files, and a missing, uncued or unreadable picture as a CHECK
python mix_test.py               # real renders from synthetic media, measured (about 4 minutes)
```

`mix_test.py` builds a 20 second voice-like recording, a looping chord with
a stand-in licence and ledger, a synthetic sting and the graphics under
`.cache/quick-edit/mix-test/`, renders a tall and a wide cut with the sting
and the bed and a tall cut as things stand today (no approved sting, no
approved track), and checks the measured numbers against the levels. It
points make.py at its stand-in ledger with `MINDMAKE_MUSIC_LEDGER`; a real
render never sets it, and a report made with any ledger but
`config/music-library.json` says so in its warnings.
`tests/quick-edit-mix.test.ts` runs all four in CI.

## The archive

Krish, 2026-10-06: "Can you ensure all videos are always archived properly
in folder with date/subject/where I can post it in the folder name?" Before
that, the Studio filed a package under its job id and quick-edit filed
nothing, so nobody could tell from the archive what a folder held or where it
was meant to go. Now every finished video is filed like this:

```
2026-10-05 Who gets paid (post to YouTube, Substack, Shorts, Reels, LinkedIn)
    Who gets paid - wide 16x9 - YouTube, Substack.mp4
    Who gets paid - tall 9x16 - Shorts, Reels, LinkedIn.mp4
    share/              the share copies, under the same names
    where-to-post.txt   each file and where it goes, with the words to post
```

- **Where it goes.** `--archive ROOT`, or `--archive` on its own for
  `MINDMAKE_ARCHIVE_ROOT`, the archive the Studio uses, else on Windows
  `runtime.archive_root` in `config/studio.json` (as the music folder falls
  back to `runtime.music_root`). With none of them, or with no `subject` in
  the config, it stops before transcribing or rendering. `archive.py` finds
  the root the same way.
- **The date** is the config's `date`, the day the piece is published. Without
  one it is the day the video was filed, London time.
- **Where to post.** The tall 9:16 video is for Shorts (YouTube Shorts),
  Reels (Instagram Reels) and LinkedIn, and TikTok too with `"tiktok": true`.
  The wide 16:9 video is for YouTube and Substack. The folder lists every
  place its videos are for, always in the order YouTube, Substack, Shorts,
  Reels, TikTok, LinkedIn.
- **The words.** `where-to-post.txt` lists each file and where it goes. Give
  `--package FILE` with the engine's answer from its package step (saved from
  `python3 scripts/engine.py POST /api/content-ideas/<id>/package @body.json
  --full`) and it adds the YouTube title, other titles and description, and
  the Substack title and subtitle.
- **Safe names.** Windows and Drive refuse some characters, so
  `< > : " / \ | ? *` are taken out of the subject, line breaks and odd
  spaces become one space, and nothing ends in a dot or a space. A folder
  name stays within 150 characters. When it would run longer, the subject is
  cut short at a space; the date and the places always stay whole.
- **Nothing is overwritten.** If the folder exists, the new one gets ` (2)`,
  then ` (3)`. It copies; the files in `OUTDIR` stay where they are.

To file videos you already have, such as the two launch videos of
2026-10-05, run `archive.py` on them. It picks up a share copy from a `share`
folder beside each video (`--no-share` leaves them out):

```
python archive.py --subject "Who gets paid" --date 2026-10-05 --tall out/who-gets-paid/who-gets-paid-9x16.mp4 --wide out/who-gets-paid/who-gets-paid-16x9.mp4 --package who-gets-paid-package.json
python archive.py --subject "Launch hello" --date 2026-10-05 --tall out/hello/hello-9x16.mp4 --wide out/hello/hello-16x9.mp4
```

The Studio files its approved packages by the same rule
(`studio v2 package archive`, `docs/STUDIO.md`). The rule is written once as
cases in `config/archive-naming.cases.json`, and both the Studio's tests and
`python archive.py --self-test` check every case, so the two cannot drift.
Change a case there first, then both programs.

## What stays out of the repository

Recordings, graphics, music and finished videos are media, and media are
never committed (`scripts/check-no-secrets.ts`). The configs, the music
ledger, the sting's settings and this tool are committed; the files they
point at live in a local working folder, the music folder in Drive, or
`.cache/`.
