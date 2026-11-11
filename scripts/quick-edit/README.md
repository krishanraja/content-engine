# quick-edit

Turns one to-camera recording into a finished tall (9:16) and wide (16:9)
video in the makeyourmindup look: the wide cut of a weekly series piece opening
on its series' intro sting and then the hook, the tall cut straight on the hook
in the brand's dress, stumbles and dead air cut, graphics on the right lines, captions timed
to the words, the licensed music bed under all of it, even loudness, the one
outro card on the end.

Video is now made with ve (`python scripts/ve.py`, `docs/ve/ENGINE.md`), and
quick-edit stays the fallback until ve passes Phase 3 (`AGENTS.md`, "Video
production"; `docs/ve/STATUS.md` says what ve can do today). Both make the
tall and the wide shape with the music bed; the Studio renders 9:16 only and
carries no music.
By house rule TWO_CUTS each cut is its own recording: the long cut renders
with `--only 16x9`, the short cut with `--only 9x16`, each from its own config.
From 26 October 2026 a piece's cut renders only from the creative direction
Krish signed (`kit.py`, below; `docs/CREATIVE_DIRECTION.md`).

It made both launch videos on 2026-10-05
(`editions/2026-10-launch/video-kit/`).

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
faster-whisper, Pillow, Playwright, node (for the story outro), the music folder
(`MINDMAKE_MUSIC_ROOT`, else `runtime.music_root`) and the archive folder
(`MINDMAKE_ARCHIVE_ROOT`, else on Windows `runtime.archive_root` in
`config/studio.json`), the music ledger, every approved track's file against
its sha256, and the opening (the 9:16 cut opens on the hook; the 16:9 cut of a weekly series piece opens on its
intro sting once `config/intro-sting.json` records Krish's approval, and the `intro sting` row says whether it does and
which clips are here). It exits 1 when
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
   what each cut will get: its opening (house rule HOOK_IS_THE_INTRO: on a series
   piece's 16x9 cut the sting, or the hook and why; on 9x16 the hook; and
   `opening_stop` when the cut may not render),
   the music track or why not, the main and end card lengths, and any warning (the short cut's
   speech over 90 seconds, for one, or a config with no cues whose post has
   pictures). It renders nothing. It exits with an error if a
   graphic's anchor words were not found, and stops if a cut's words were not
   found. Fix the config and plan again until it is clean.
2. **Render.** Without `--plan`, it renders into `OUTDIR`. Each shape takes a
   few minutes. Without `--only` it renders both shapes from one recording,
   which is for a quick take only: a piece's two cuts are two recordings.
3. **Look at it.** `OUTDIR` gets `preview-<shape>-NN.jpg`: one frame at the
   opening, one inside every graphic, and one on the end card (and
   `preview-<shape>-intro.jpg` only when a clip on Krish's words opens it). Check that every graphic sits on its line, the
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
| `replacements` | `[["theater", "theatre"], ["computing power group", "computing power grows"]]`: fixes what the transcriber mishears, and keeps British spelling. A phrase of several words is matched as a run and replaced as one caption word group. Every video also gets the fixes in `DEFAULT_FIXES` in `make.py` first, the names the transcriber has got wrong before ("Bike Dance" for ByteDance, Krish, 2026-10-07): when a video misspells a name, add it there so the next one cannot. Captions only; the audio is untouched. His own name is never a fix and never a caption (Krish, 2026-10-28: "Remember, no content refers to Krish, ever. I still see that popping up from time to time. Even articles written are not authored by Krish. My face only, for assets and the video format."): a caption that says "Krish", or a self-introduction under any hearing of it ("I'm Chris", "my name is Krish"), stops the run before anything renders, naming where it is in the cut and in the take, so it can be cut with `remove`. The transcriber's hint names the publication, never him. |
| `dress` | `{"9x16": "dress-9x16.png"}`, written by kit.py: the tall cut's dress, the brand's wordmark in the top left corner and the series tag in the top right, as the Friday 23 October tall cut has them, laid over the whole main from its first frame, over the pictures and under the captions, and off the end card (house rule HOOK_IS_THE_INTRO). The wide cut needs none: its frame carries the wordmark and the series beside him from the first frame. |
| `logo` | Only for a config kit.py did not dress: the makeyourmindup logo in the opening seconds of the tall video (Krish, 2026-10-07: "put the Make Your Mind Up logo in the first few seconds of the video somewhere on vertical video"). The masthead sits on an ink pill above the captions for 3 seconds and fades out. `{"png": ..., "seconds": 3}` uses another full-frame transparent image; `false` leaves it out. A cut with a clip in front leaves it out. |
| `intro` | Anything in front of the hook (house rule HOOK_IS_THE_INTRO). `"auto"` (the default) puts the series' house sting (`config/intro-sting.json`, `intro.py`) in front of the 16x9 cut of a weekly series piece, once Krish's approval is recorded there (Krish, 2026-11-05: "I think it should go at the start of the longer wide videos 100%,"); the 9x16 cut and an off-day piece (no weekly series, or dated on a Tuesday, Thursday or Saturday) get nothing and say nothing. While the sting is a `candidate` the 16x9 cut opens on the hook and the report says why; once it is approved, a 16x9 series cut that cannot have it (a clip missing from the library, or not the one he approved) stops before it renders. `false` is no intro, which on an approved 16x9 series cut also stops. `{"9x16": file, "16x9": file}` names a clip that goes in front only if it is the house sting or on Krish's own words for that piece in `intro_override`, so a different opening can be tried on his say; otherwise it is left out and the report says why. A clip's own sound is never used: silence is laid under it, in exact samples counted from its frames, with the bed over it. |
| `intro_override` | Krish's own words for this piece, starting "Krish", letting a clip open the cut, or letting an approved 16x9 series cut render without its sting. The report quotes them and records the clip as the cut's `opening`. Never written for him. |
| `series` | The piece's series (or `subchannel`), for the series colour: `follow_the_money`, `mind_the_gap` or `under_the_hood`, in any spelling. Without it, make.py reads the subchannel from the post the kit was made from, else uses follow.the.money's colour and says so. |
| `music` | The bed under the whole video, never dropping out (Krish, 2026-10-28: "Yes I think music should be audible throughout but just lower."). `"auto"` (the default) is `music.py`'s pick for this piece among the approved, licensed tracks; with none, the cut has voice only and the report says why. `false` is voice only. A track id uses that track, if it can be used. Both cuts of a piece ask for the same length: the long cut's recording as kit.py measured it (`kit.json`, `recording_seconds`) plus the most an opening clip and the end card add; only when the long cut's kit is not made yet do they ask for `PIECE_SECONDS` (400). A track that covers that plays straight; else one that runs a minute or more starts again from its intro cue under a two-second crossfade, on a picture turn where one is near (`music.restarts`), so the bed runs under the whole cut. |
| `music_seconds` | Optional. The length of music the piece needs, in place of the one read from `kit.json`. |
| `piece_id` | Optional. Ties both cuts of one piece to the same music (else `subject`, else `name`). |
| `script` | The script the recording was made from. Its names (ByteDance, Higgsfield, OpenAI) go to the transcriber as a hint after the publication's name (never his), so it spells them as written. |
| `cues` | The graphics. Each has an `id`, a `panel` image (`{aspect}` becomes `9x16` or `16x9`), and the `start` and `end` words it covers. The graphic comes in 0.15 seconds before `start` and leaves 0.35 seconds after `end` (`lead` and `tail` change that). Optional, but a config with no cues whose post has pictures is warned about in `--plan` and the report: it would go out as a bare talking head. |
| `frame16` | The wide shape's background: brand panels left and right of the speaker. |
| `strap` | Retired. It put his name on the tall cut, and no content refers to him (Krish, 2026-10-28), so make.py stops on a config that carries one, quoting his words; `"strap": false` is no matter. kit.py no longer draws one: the tall cut wears its `dress` instead. |
| `endcard` | `{"9x16": ..., "16x9": ...}`: a short clip, joined to the end. Its own sound is never used: silence is laid under it, as under an opening clip, with the bed over it, and the plan and the report say so when the clip had a sound of its own (only a track in the music ledger goes under a cut, house rule MUSIC_BED). kit.py's end cards are silent. |
| `fps` | The cut's frame rate. `"source"` (the default): the house rate (24, 25, 30, 50 or 60) nearest the take's own, so a teleprompter.com take at about 24 fps is cut at 24 and never shows a frame twice (the episode corpus: "Frame rate: Same as recorded source"; YouTube asks for the recorded rate too). Opening clips, end cards, story clips and pictures are conformed to it. A number from that list overrides it. Until 17 October every cut was made at 30. |
| `max_gap`, `pad_before`, `pad_after` | The pause rule: any silence over `max_gap` seconds (0.35) is cut, keeping `pad_before` (0.10) before the next word and `pad_after` (0.16) after the last one. |
| `subject` | For `--archive`: the piece's short title, as it should read in the archive, such as `"Who gets paid"`. `--archive` stops without it. |
| `date` | For `--archive`: the publish date, `YYYY-MM-DD`. Without it, the folder carries the day it was filed, London time. |
| `post_to` | For `--archive`: every place to post, in place of the usual ones, such as `["YouTube", "LinkedIn"]`. Each video keeps the places it suits. |
| `tiktok` | For `--archive`: `true` sends the tall video to TikTok as well. |
| `voice` | `"repair"`: the gentle dialogue chain before any level is set (rumble, a light tracking noise reduction, less mud, a little presence, softer s sounds, a slow 2.5:1 levelling; `episode.py`). On Wednesday's 3:18 take it lowered the noise floor 6 dB and the loudness range from 5.3 to 3.3 LU without moving his level. The report's `voice_repair` gives both. |
| `reframe` | `true`: each hidden cut sits under a change of framing, from the base to a slight push (90% of the frame, about his face) and back, held at least 1.5 s, so a jump reads as a cut. The tall cut's face band is never reframed. |
| `emphasis` | `[{"start": WORDS, "end": WORDS}]`: a closer framing (82%) for a pivotal line, back to the base after. |
| `captions` | `false`: no captions in the picture. The caption file `NAME-SHAPE.srt` is written for every cut either way, on the finished cut's clock (any opening clip included), lines of 42 characters or fewer, two at most. |
| `chapters` | `[{"title", "starts"}]` or a `.chapters.md` path: `NAME-SHAPE.chapters.txt` for the YouTube description, 00:00 first, ascending, each at least 10 s on. The dividers themselves are ordinary cues. |
| `end_screen_s` | `20`: warns when a picture runs into the last N seconds, kept for YouTube's end-screen tiles. |
| `music_mode` | `"episode_bed"`, for a long cut: the continuous bed Krish approved by ear on 19 October, about -31 LUFS under his voice the whole way, lifting to about -22 under each chapter card (a cue with `"chapter": true`), the track starting again inside a chapter card or, where a stretch outruns it, under a two-second crossfade (`music.continuous_episode_bed`); the bed's continuity is measured and the render stops if it drops out under his voice. `"episode"` is the same now: it used to play only in the open, the chapter turns and the close and drop out between them, and Krish, 2026-10-28: "Yes I think music should be audible throughout but just lower." A cut that asks for `"episode"` and has no chapter cards keeps the old lift instead, about 4 dB over the bed from 1.5 s before each spoken chapter turn to 4 s after it (Krish, 2026-10-16: "Feel free to raise the music slightly during the section dividers."; `music.ACCENT_LIFT_DB`). |
| `speed` | `{"factor": 1.2, "krish": "Krish, DATE: his words"}`: the take sped up, picture and sound, pitch kept, before anything else. Refused without his own words and over 1.35. |
| `heard_as` | `[{"said": "Claude", "heard": "clawed", "krish": "Krish, DATE: his words"}]`: a word the transcriber misheard in the finished file, cleared for the words gate (above) on his own words only. Refused without them, before anything renders. |

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
subchannel's look, the tall cut's dress, a panel per picture, the cut's script,
`<cut>.json` (music on auto, the same `piece_id` on both cuts, a
cue per picture the script brings in) and `kit.json`, which also keeps each
cut's `recording_seconds` (ffprobe) for the music. A config edited by hand is
never overwritten unless you give `--force`.

From 26 October 2026 kit.py draws no kit without the piece's signed creative
direction for those exact words (`creative-direction.json` beside `post.json`,
checked by `scripts/post-pack/creative_direction.py`). It records the file's
hash in the cut's config, and make.py refuses to render a piece's cut whose
config has no direction, or whose direction file changed since kit.py checked
it.

## The graphics

Every graphic is a PNG at its exact pixel size, so ffmpeg only places it and
never scales text. Render them from HTML at that size with a transparent
background (Playwright, `omitBackground: true`).

| Image | Size | Where it goes |
|---|---|---|
| Tall panel | 1080 x 1000 | The top of the frame. The speaker drops to a 920-pixel face band below it, on ink, and the captions move under the panel. |
| Wide panel | 1314 x 1080 | The right of the frame. The speaker slides to the left edge (606 wide) while it shows. |
| Wide frame (`frame16`) | 1920 x 1080 | Behind everything in the wide shape. The speaker's column is the middle 606 pixels (x 657 to 1263); put the brand on either side. |
| Dress (`dress-9x16.png`) | 1080 x 1920, transparent | Over the whole tall main from its first frame: the brand's wordmark top left and the series tag top right, clear of the captions (250 pixels down) and of the platforms' buttons down the right. The tall panel keeps its pill's room but hides the pill, since the tag is already in the corner. |
| End card | 1080 x 1920 and 1920 x 1080, about 4 seconds, silent audio | After the last word. |

Captions are Archivo Black, cream on an ink box, with numbers in mint: 70
pixels in the tall shape (top third, or under a panel), 48 in the wide shape
(bottom of the speaker's column).

## The opening: the sting on the wide cut, the hook on the tall

Krish, 2026-11-05, of the makeyourmindup intro sting: "I think it should go at
the start of the longer wide videos 100%," (house rule HOOK_IS_THE_INTRO).
So the wide (16x9) cut of a weekly series piece opens on that series' house
sting, the clip he saw on the Intro Sting page, byte for byte: 56 frames at
30 fps, about 1.9 seconds (45 frames at 24 fps, when the cut runs at the
take's rate), with the full MAKE YOUR MIND/UP wordmark plate near its end. It
has no sound of its own: make.py lays silence under it, in exact samples
counted from its frames, and the music bed over it at its loud open. His face
and the hook come in on the very next frame, in the wide cut's existing
branded frame for now (which look the wide cut should have is not yet put to
Krish). Asked whether each series' clip may keep flashing the other series'
colours on its way to its own, he picked "Keep it as I saw it": the one
written exception to the series-colour rule.

The tall (9x16) cut opens straight on his hook, in the brand's dress from the
first frame: the wordmark and the series tag in the top corners (`dress`,
above). That is his pick of 2026-10-29, option one, "The hook is the intro":
"I'd pick number one here but I think that we need to test and learn. We need
to figure out what the right tone is over time based on real engagement.
Let's go with number one for now." An off-day piece (no weekly series, or
dated on a Tuesday, Thursday or Saturday) wears no sting, and never another
series' colour, so both its cuts open on the hook.

Nothing else goes in front of the hook: no story card, no title card and no
second intro. The close is the one calm outro card (`endcard`; the story
outro, house rule STORY_INTRO_OUTRO), so a video has one opening and one close
(Krish, 2026-10-21: "why are there two separate intro sequences? that should
NEVER happen."; 2026-10-28: "we also don't need three separate outro
transitions and screens. Ever."). The sting followed straight by his face is
one opening.

The openings stay his choice to test: each report records the opening the cut
used (`opening`: `{"kind": "sting", ...}` with the clip's sha256, `{"kind":
"hook"}` with a `why` on a wide cut that opened on its hook, or `"clip"` when
one went in front on his words), so real engagement can settle it, and a
different opening is tried only on his own words for that piece (`intro`,
`intro_override`).

The design is six fixed clips, not source code: the Remotion source of the
clips he saw on 12 October was never committed and is lost.
`config/intro-sting.json` names each clip (its library path under "1 Brand kit
(permanent)/Intro sting", its sha256 and size) and says where the sting goes
(`shapes`: 16x9 only; the 9x16 clips are kept for the record). make.py fetches
a clip this machine lacks from the library, checked by size and sha256, and
`intro.py finish` makes the cut-ready sting from it, its picture copied as it
is. While the config says `candidate` the wide cut opens on its hook and the
report says why; `approve` records his approval in his own words, bound to
the clips' sha256 (`source_sha256`), and never for him.

What came before: the sting first ran from 2026-10-12 (INTRO_STING) with no
design approved (on 2026-10-12 he turned the first direction down: "it's ok,
it's a bit boring and colourless and vanilla - and just what Powerpoint would
do in 2008"), and his pick of 29 October retired it, so no cut opened on a
sting from 29 October to 5 November. The animated story card in front of each
cut (the intro half of STORY_INTRO_OUTRO) stays retired, in
`config/story-intro-outro.json`; its outro half stays.

```
python intro.py status [--json]                   # the approval, the source hash and which clips are here and verified
python intro.py fetch                             # any machine: every clip from the library, checked by size and sha256
python intro.py publish                           # a machine that has the clips: send them to the library (send.py)
python intro.py approve --words "Krish's exact words"
python intro.py finish [--shape 16x9] [--series SERIES] [--force]
```

## The music

Krish, 2026-10-12: "I am also going to get some licensed audio to put behind
my videos, so help me prepare to put it somewhere you and codex will always
know where that is, and use it correctly (high volume during the intro, low
whilst I am talking, higher during the outro)."

- **Where the audio lives.** Google Drive, makeyourmindup >
  1 Brand kit (permanent) > Music (Drive folder
  `1oHyJ9A5et5_uKW7QTq1VHX0NuGwwQVri`): on the runner machines
  `H:\My Drive\Ventures\Active Ventures\makeyourmindup\1 Brand kit (permanent)\Music`. The
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
  and LinkedIn), cleared for YouTube Content ID, and whose file matches its
  sha256. Nothing browses Drive for audio. A series piece (Monday, Wednesday,
  Friday) only ever gets a series track; a track marked `"for": "off-day"`
  (Goodie Bags since 2026-11-04) is kept for off-day posts.
- **One track for both cuts.** make.py renders one cut at a time and cannot
  know the other's length, so each cut asks for what the pair needs: a
  licence for all six places, and the long cut's length (else
  `PIECE_SECONDS`, 400). The piece's id sets where its rotation through the
  approved tracks starts, and both cuts take the first track in it that plays
  that long straight (or loops); when none does, the first that runs at least
  `RESTART_MIN_S` (a minute) from its intro cue, started again under a
  two-second crossfade as often as the cut needs, on a picture turn where one
  is near. So the bed never drops out for want of length (Krish, 2026-10-28:
  "Yes I think music should be audible throughout but just lower."). A track
  under a minute that does not loop is passed over: a bed that starts again
  every few seconds is no bed.

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
python music.py publish                                  # a home computer: send every ledger file to the engine's library
python music.py fetch [--out DIR]                        # any machine: get them back
```

`add` measures the file and writes it as `proposed`; only `approve`, with
Krish's own words, makes it usable. `pick --both-cuts` is what make.py's
`"auto"` does: the same piece gets the same track on both cuts, and
different pieces rotate through the approved ones.

**The levels** are in the ledger's `levels`, approved by Krish by ear: the
music at about -16 LUFS for the open, about -31 LUFS under his voice (about
17 LU under his -14), and about -18 LUFS over the end card.

**The one bed shape** (`config/music-bed.json`, `scripts/bed_shape.py`, the
same in ve). Krish, 2026-11-04: "It should just start loudly and then get a
little bit softer, so my voice is the main character, but with atmosphere in
the background, and then get louder at the end. It's pretty simple." The bed
opens at the intro level for 1.5 seconds, sting or none (with a longer sting
the open holds until 1.5 seconds before his first word), eases down over 1.5
seconds to the bed level, holds it under his voice with nothing keyed to the
voice, rises over 1 second from his last word to the outro level, and fades
over the last second. A long cut also lifts to the chapter level at each card.
A track with an outro cue has its ending crossfaded in over the rise. It is a
time envelope (`volume` with `eval=frame`), never sidechain compression, a
compander, a gate or a level chaser: `npm run check:music-bed` fails on any of
them anywhere in the code. Each stretch's gain comes from the track's own
loudness where it sits, measured before the mix.

**The bed-shape check.** Before the mix, make.py meters the bed stem alone and
stops unless it follows the shape: under his voice its short-term loudness
stays within 2 LU of its own level (p10 to p90), the whole bed turns at most
twice outside the chapter lifts (down after the open, up at the close, down in
the fade), and both the first second and the ending sit at least 6 LU over the
bed. A finished cut gets `<cut>.mp4.bed-shape.json`, bound to its sha256, and
no filing route (send.py, produce_day.py, making.py, ve file) takes a video
for 3 Posts without it. A cut made anywhere else, or changed after its bed was
checked, is refused.

**The mix.** His voice is set to -14 LUFS, the bed is laid under the whole
video, the two are summed (`amix` with `normalize=0`), limited at -2 dBTP,
and the final mix gets the two-pass loudness pass (`loudnorm`, linear, so it
is one gain), steered by the ebur128 meter. After the encode the file is
measured again: integrated -14 +-1 LU and true peak at most -1 dBTP, or the
report warns.

**Hit sounds: none yet.** quick-edit lays no sound effect, and there is no
system for one. When one is built, it follows what Krish picked on
2026-10-29: "Only the big moment". One sound goes under a piece's biggest
moment (a low thud as BANKRUPT slams in, say) and nothing anywhere else. The
sound comes from a small set that is played to him first, and nothing is used
before he approves it by ear. The Epidemic Sound subscription behind the music
probably covers sound effects; that is to be checked with the licence, never
assumed, and no spend is made without his yes.

## The report

`<name>.report.json` keeps what it always had and adds, per shape under
`shapes`, and at the top level when one shape was rendered (the house way):

- `opening`: what the cut opened on (`{"kind": "sting", "rule":
  "HOOK_IS_THE_INTRO", "series": ..., "clip_sha256": ...}` on a wide series
  cut with its sting, `{"kind": "hook", "rule": "HOOK_IS_THE_INTRO"}` with a
  `why` on a wide cut that opened on its hook, or the clip his words put in
  front), so real engagement can settle the choice;
- `intro_seconds` (0 on the hook, the sting's length with it), `main_seconds`, `outro_seconds` (the end
  card) and `total_seconds`, and `intro` (a clip in front, its sha256);
- `music`: the track id, title, sha256, the levels used, the gain on each
  stretch and how the track was laid (straight, looped, or to its outro
  cue, or `restarted at ...` where a track shorter than the cut starts again),
  or null;
- `loudness`: `integrated`, `true_peak`, `intro_short_term`,
  `voice_short_term` and `outro_short_term` (each stretch where its level
  holds), `bed_to_voice_lu` (from the voice and bed stems alone), and whether
  the final pass was a plain gain;
- `warnings`: a clip left out and why, no music and why, levels still proposed, the
  short cut's speech over 90 seconds, a config with no cues whose post has
  pictures, loudness out of range.

**The 90 second check.** House rule TWO_CUTS gives the short cut at most 90
seconds, and story_check holds its script to 195 words, so the finished cut
stays under 89 seconds (Reels over 90 seconds were cut off, 2026-10-14).
Krish has not yet ruled whether the 90 seconds include the
4 second end card, so the check reads one named figure,
`TALL_CAP` in `make.py`: today `main_seconds`, his speech alone. The warning
gives `total_seconds` beside it. If he rules that the 90 seconds is the whole
video, `TALL_CAP` measures `total_s` instead.

The stems and the mix are in `OUTDIR/audio-<shape>/` (`dialog.wav`,
`bed.wav`, `mix.wav`) for anyone who wants to listen to one alone.

## Tests

```
python make.py --self-test       # the cuts, the clock, the previews, the join order, the opening and the dress, the 90 second check,
                                 # numbers joined in the captions, the script's spellings, the end card's sound never mixed,
                                 # no name in a caption or a strap
python spelling.py --self-test   # British and US spellings of the same word, never a different word
python transcriber.py            # does faster-whisper decode a second of sound here (exit 1 and the pinned fix when not)
python music.py --self-test      # the ledger, the pick (one track for both cuts), a real bed measured against the levels,
                                 # and a track shorter than the cut started again with no gap
python intro.py --self-test      # synthetic clips through the finishing path, the source hash, where the sting goes for every shape,
                                 # status and series, fetch and publish on a fake engine, and the approval lane
python kit.py --self-test        # the kit, where it finds a piece's files, and a missing, uncued or unreadable picture as a CHECK
python mix_test.py               # real renders from synthetic media, measured (about 4 minutes)
```

`mix_test.py` builds a 20 second voice-like recording, a looping chord with
a stand-in licence and ledger, a stand-in dress, a synthetic opening clip, a
stand-in approved intro sting (synthetic clips, never Krish's) and the
graphics under `.cache/quick-edit/mix-test/`, renders a tall and a wide cut
of a piece with no series opening on the hook with the bed, a wide cut of a
series piece opening on the stand-in sting with his frame on the very next
frame, a tall and a wide cut with a clip in front on stand-in words, and a
tall cut with no approved track, and checks the opening, the dress, the bed
under the whole cut and the measured numbers against the levels. It
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
ledger, the intro sting's settings (its clips live in the library) and this tool are committed; the files they
point at live in a local working folder, the music folder in Drive, or
`.cache/`.


## The words gate

Krish, 24 Oct: "random small cuts and chopped words" in the published
Wednesday long video. Every finished cut now goes through `words_gate.py`
(blocking): a content word of the signed script (the config's `script`) that
he said in the take and that is missing from the finished file, beyond the
approved removals, holds the cut. make.py writes the approved removals (the
config's `remove` rows, with Krish's words when they carry them) as
`<name>.edl.json`, transcribes the finished file (faster-whisper, as it
already did for the `heard` check), writes the result into the cut's
`.validation.json` as `checks.words`, bound to the video's sha256 and to the
script, take words and EDL it read, and exits non-zero after writing
everything, naming each lost word, where it was and what the final has there.
`quality.delivery_problems` refuses a failed or stale words check wherever the
receipt travels (send.py, making.py video, the archive), one checked against
other take words than the cut was made from, and no words check at all for a
cut going to a post dated from 27 Oct 2026 (`words_gate.REQUIRED_FROM`, read
from the destination path, never from a mark in the receipt). Function-word
differences and lost ad-libs are listed, never blocking.

What counts as a word of the script: spelt numbers and ordinals fold ("two
hundred" is "200", "the twelfth" is "12th"), and a name split or joined
differently is one word ("open AI" for "OpenAI", "make your mind up" for
"makeyourmindup"), in the take as in the final.

Two rows need Krish's own words (a `krish` line starting "Krish"), and nothing
else will do:

- **A removal that cuts the only time he said a word of the script.** A false
  start he said again passes without them; a `remove` row that takes out the
  only "bankruptcy" fails, before anything renders, until it carries his words.
- **A mishearing of the finished file.** `heard_as` in the config:
  `[{"said": "Claude", "heard": "clawed", "krish": "Krish, DATE: his words"}]`.
  make.py refuses a row without his words before it renders, writes the rows
  into the EDL, and the receipt lists each word it cleared under
  `cleared_by_krish`. A receipt is never edited to clear a word.

Any cut can be checked by hand:

```
python3 words_gate.py --script SCRIPT.txt --take-words TAKE.words.json --final CUT.mp4 [--edl CUT.edl.json] [--no-receipt]
```

Only a run that transcribes the finished video itself writes `checks.words`,
and only into a receipt checked against the same signed script and take
words (or, for an older receipt, the take words it names). With a words json
as `--final` the report is printed and no receipt is written, so a pass
cannot be made from words copied by hand. To clear a mishearing without a
re-render, add the `heard_as` row with his words to the config and to the
cut's `<name>.edl.json`, then run the command above on the video.

It is not calibrated yet (config/failures.json, chopped-words-published stays
open): Monday 26's accepted cuts must pass and Wednesday 21's published long
cut and Friday's 17 Oct words cut must fail. The finished files live on the
home computer that made them and in the Drive archive, not in this
repository, so the run is a home-computer step, each with `--no-receipt`;
Monday 26's long cut, for one:

```
python3 scripts/quick-edit/words_gate.py --no-receipt \
  --script docs/plans/2026-10-26-draft-script.md \
  --take-words docs/plans/2026-10-26-monday/takes/long.words.json \
  --final .cache/produce/2026-10-26-b358e788/long/disney-google-and-character-ai-long-16x9.mp4
```

If the music bed runs under all of his speech, calibrate on a cut with the bed
at that level. The take is transcribed with the script as a hint and the
finished file without one; that difference is a suspected (not measured)
cause of misheard names, which the calibration run will show. The only real
evidence so far is two transcribers on Friday 9 Oct's 90-second cut (the take
on small.en, the finished file on medium.en): 3 words held, among them
"Claude" heard as "clawed". A clipped tail the transcriber still hears whole
is caught only by the joins-in-gaps check (Wave 2).

Beside it, `advisory_qc.py` runs the ve measures that can run on a quick-edit
cut (joins, captions, brand mark, composition) and writes them under
`advisory` in the receipt, each marked `"advisory": true, "blocking": false`.
In Wave 1 none of them blocks; a measure that cannot run here (no tesseract,
no house mark on this machine, a 16:9 cut the 9:16 lock does not cover) says
why. Tests: `tests/quick_edit_words_gate_test.py`.

### The calibrated gates (Wave 2, W2.4)

`scripts/cutgates` holds the gates quick-edit and ve share; their thresholds
are in `config/gates.json` and nowhere else. On every finished cut make.py
now writes, beside `checks.words`:

- `checks.words` from `words_gate.check_aligners`: a content word lost on
  every aligner's pass fails; one lost on one pass only is listed.
- `checks.joins` (`cutgates/gaps.py`, `joins_in_gaps`): every join in a gap
  every aligner agrees on, at least 80 ms wide, 30 ms clear of the word on
  each side; a failure names the join's time and the words around it.
- `checks.captions_clock` and `checks.captions_render` (`cutgates/captions.py`):
  each caption page's first frame against the first word as the aligner that
  did not draw the captions heard it (tolerance a placeholder until measured
  on Monday 26), and each page found as a pixel change in the caption zone and
  read by tesseract within 3 frames of its start (exact text, score 0.98).
- `<cut>.joins-reel.m4a` and `.joins-reel.json`, for his ear;
  `python3 scripts/cutgates/joins_reel.py board` turns the filed reels into a
  `--materials` file for week_board.py.

Each check names its machine and the video's sha256. A review check this run
did not make is listed under `missing` with what makes it, never written as a
placeholder status. For a post dated from `required_from` (16 Nov 2026) a
missing, failed or stale joins or captions check holds the cut, at render and
wherever the receipt travels; before then they are measured and listed only.
There is no paid second aligner (Krish, 2026-10-29: "do not use eleven labs
for this"): ElevenLabs Scribe was removed, the gates run on faster-whisper and
every receipt says "single aligner". A second local pass (another
faster-whisper model) can be handed to the gates by name.

Calibration: `python3 scripts/cutgates/calibrate.py` on his computer runs every
gate on the five cuts in `config/gate-calibration.json` and prints expected
against actual; `--synthetic` is what CI runs. Tests: `tests/cutgates_test.py`.

## Evidence-backed caption repairs

When independent recognition or human listening finds a spoken word missing from
captions, preserve the original transcript. An optional `caption_repairs` JSON
and its required `caption_repairs_sha256` can restore timed caption words without
altering the sound or picture. Each repair binds the original source provenance,
the exact edited intermediate hash and the original caption-token digest. Its
clock is explicitly `edited`; speed and edit mapping must never be applied again.
Every replacement range carries its original words, new timed words, reason and
evidence reference. Stale identities, overlapping ranges, absent evidence or
out-of-order/out-of-duration times fail closed. The final receipt retains these
word changes separately from the script comparison. This does not certify the
speech: post-render comparison and whole-video review are still required.

Video cards have no eyebrow labels or source-credit overlays (Krish, 19 October
2026). Attribution and source evidence accompany the video as separate records.
