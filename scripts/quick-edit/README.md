# quick-edit

Turns one to-camera recording into a finished tall (9:16) and wide (16:9)
video in the makeyourmindup look: stumbles and dead air cut, graphics on the
right lines, captions timed to the words, even loudness, the end card on the
end.

It is for videos that do not go through the Studio: a launch hello, a quick
take, or a piece whose Studio job is not set up yet. It made both launch
videos on 2026-10-05 (`editions/2026-10-launch/video-kit/`). A Studio piece
still goes through the Studio.

It never reads or writes the Studio's Inbox or job folders, and it never
writes into Drive (architecture doc, ruling 0d). Work on a copy of the
recording in a local folder.

## Setup

Python 3.10 or later, `ffmpeg` and `ffprobe` on the PATH, and
`pip install faster-whisper` for the transcript. The caption font,
Archivo Black, is in `fonts/` under its open licence (`fonts/OFL.txt`).

## Run it

```
python make.py path/to/video.json --out OUTDIR --plan
python make.py path/to/video.json --out OUTDIR --share-mib 29
```

1. **Plan first.** `--plan` transcribes (the first run takes a minute or two
   on a laptop), then prints every cut with its words, every graphic's start
   and end in the edited video, and the caption count. It renders nothing. It
   exits with an error if a graphic's anchor words were not found, and stops
   if a cut's words were not found. Fix the config and plan again until it is
   clean.
2. **Render.** Without `--plan`, it renders both shapes into `OUTDIR`. Each
   shape takes a few minutes. `--only 9x16` or `--only 16x9` renders one.
3. **Look at it.** `OUTDIR` gets `preview-<shape>-NN.jpg`: one frame at the
   opening, one inside every graphic, and one on the end card. Check that
   every graphic sits on its line, the captions read, and in the tall shape
   the face crop keeps the eyes in frame. `<name>.cut.txt` is the full caption
   text after the cuts: proofread it for misheard names.
4. **Share.** `--share-mib 29` also writes `OUTDIR/share/` copies under 29 MiB,
   because chat uploads stop at 30 MiB and a two-minute 1080p master runs 35
   to 75 MB. Every platform re-compresses on upload, so the share copy looks
   the same on screen. `share.py` does the same for any single file:
   `python share.py in.mp4 out.mp4 --cap-mib 29`.

The transcript is cached as `OUTDIR/<name>.words.json`, and the cut is cached
until the cuts or the pause rule change, so a re-render after a graphics or
caption fix skips both.

## The config

One JSON file per video. Paths are relative to the config file.

| Field | What it does |
|---|---|
| `name` | Prefix for every output file. |
| `source` | The recording. |
| `crop` | `[w, h, x, y]` of the real picture inside the frame. A phone recording shown in a 1280x720 frame is `[404, 720, 438, 0]`. |
| `face` | `[y, h]` inside the crop: the band shown under a graphic in the tall shape. Keep the eyes and the top of the head in it. `[100, 450]` worked for the launch videos. |
| `remove` | The words to cut, as said: `{"say": "So, you know,", "after": "is coming"}`. `after` is the words just before, so the right instance is cut. An index pair `[first, last]` into the words file also works, but only for that exact transcript. |
| `replacements` | `[["Chris", "Krish"], ["theater", "theatre"]]`: fixes what the transcriber mishears, and keeps British spelling. Captions only; the audio is untouched. |
| `cues` | The graphics. Each has an `id`, a `panel` image (`{aspect}` becomes `9x16` or `16x9`), and the `start` and `end` words it covers. The graphic comes in 0.15 seconds before `start` and leaves 0.35 seconds after `end` (`lead` and `tail` change that). |
| `frame16` | The wide shape's background: brand panels left and right of the speaker. |
| `strap` | The name strap in the tall shape: a `png`, the words it follows (`after`) and how long it stays (`seconds`). |
| `endcard` | `{"9x16": ..., "16x9": ...}`: a short clip with an audio track, joined to the end. |
| `max_gap`, `pad_before`, `pad_after` | The pause rule: any silence over `max_gap` seconds (0.35) is cut, keeping `pad_before` (0.10) before the next word and `pad_after` (0.16) after the last one. |

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

## What stays out of the repository

Recordings, graphics and finished videos are media, and media are never
committed (`scripts/check-no-secrets.ts`). The configs and this tool are
committed; the files they point at live in a local working folder.
