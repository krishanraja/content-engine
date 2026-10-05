# The launch hello video: the edit

Krish recorded a short hello for the makeyourmindup launch post on Substack
(2026-10-05). It is not a Studio job: it has no article, no production brief
and no dated call, so it is edited directly with ffmpeg on the runner PC and
uploaded by hand into the launch post's video block. The Who gets paid video
does go through the Studio.

## Input

`makeyourminduplaunch.mp4` in the Studio's Drive Inbox
(`My Drive › Ventures › Active › Mindmaker › 04_Content › Video Engine › Inbox`).
Copy it to a working folder first. Never move or rename the Inbox original:
discovery never moves media, and the Studio's scans expect the Inbox untouched.

## Steps

1. Probe it: `ffprobe -v error -show_streams -show_format <file>`. Note the
   width, height, rotation, frame rate and audio sample rate.
2. Find the trim points. Run
   `ffmpeg -i <file> -af silencedetect=noise=-35dB:d=0.4 -f null -` and take
   the first speech start less 0.3 seconds as the in point, and the last speech
   end plus 0.6 seconds as the out point. Show Krish both times before
   rendering, and use his times if he gives different ones.
3. Even the loudness: two-pass `loudnorm` to `I=-14:TP=-1.0:LRA=11`, 48 kHz.
4. Add the end card. Use `endcard-9x16.mp4` if the picture is taller than it is
   wide, otherwise `endcard-16x9.mp4`. Scale and pad it to the recording's
   exact size and frame rate (`scale=W:H:force_original_aspect_ratio=decrease,
   pad=W:H:(ow-iw)/2:(oh-ih)/2:color=0x0C1512`), then join the two with the
   `concat` filter, re-encoding: H.264 High, CRF 18, `yuv420p`, AAC 192 kb/s
   at 48 kHz, `-movflags +faststart`.
5. Save it as `makeyourmindup-hello-v1.mp4` on Krish's Desktop. Do not write it
   into Drive. Give him the length and file size, and ask him to watch it
   before he uploads it to Substack.

## What is in this folder

| File | What it is |
|---|---|
| `endcard-16x9.png`, `endcard-16x9.mp4` | 1920 by 1080 end card, 4 seconds with a short fade in and silent audio |
| `endcard-9x16.png`, `endcard-9x16.mp4` | 1080 by 1920 end card, the same |

The end card shows the makeyourmindup masthead, the line "A free publication
on how AI really works. You make your mind up.", the three days (Monday
follow.the.money, Wednesday under.the.hood, Friday mind.the.gap), "Subscribe
free" and makeyourmindup.ai.
