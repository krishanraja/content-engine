# Style trial: the Jack Roberts edit, as modules

`style_trial.py` renders a short tall (9:16) test clip from one take in a
style from the bank (`config/style-references.json`), so Krish can see a style
on his own face before anything in it reaches `make.py`. It is a trial
renderer: it does not touch `make.py`, `episode.py`, the Studio, Drive or any
publish path, and it writes only where `--out` points (for the trials,
`.cache/style-trial/`). Nothing it makes is published or sent anywhere.

The first style on trial is from Jack Roberts' Instagram Story ad (frames in
`.cache/style-references/2026-10-17-jack-roberts/`). Krish, 17 Oct: "Also want
us to experiment with edit styles like this, with even better subtitles and
cuts and images ... I think we need to upgrade everything. And like before,
have a bank of styles that we can draw from." Then: "These words all bounce in
and there's a lot more movement on the screen. The background of the person
has also been treated when he's talking so it doesn't look too amateur."

## The modules it can mix (`--recipe`)

Ids are the bank's. `--recipe all` turns on every one Krish has not marked
"not for us" in the bank; otherwise give a comma list, and a module left out is
simply not applied. Naming a module he marked "not for us" stops the trial.

| module | what the renderer does |
| --- | --- |
| `full-face-vertical` | Crops in on the face (mediapipe finds it on every frame) so he fills the tall frame: 118% (close), 134% (closer) and 150% (the punch-in on a payoff). No split screen. Where a caption would sit on his chin the face is lifted as far as the frame allows, and where the source's bottom edge stops that, the shot goes up to 0.10 closer (a closer framing is what lifts the chin when the window sits on the bottom edge). |
| `treated-background` | Not for us (Krish, 28 Oct 2026, "Yes remove those.", after the background blur he called "some sort of green fire"); kept only so the trial can say so. Cut him from the room and turned the room into a set (below). |
| `kinetic-serif-captions` | Two to four words at a time, low over the chest, inside the safe area: every group sits on one bottom line just above the platform UI and a payoff's lead-in line stacks above it. A light geometric sans for most words, the word that carries the meaning in bold, the payoff phrase in a large italic serif with a peach-to-cream gradient and a soft warm glow. Never a subtitle bar. Groups break at phrase boundaries (never ending on "the", "of", "about"; never splitting before "of"; a pause or comma is a good break), never across a sentence end, a real pause or a cut. |
| `word-bounce-in` | Each word arrives on the frame it is said, scaling from ~5% to 108% and settling at 100% over 180 ms while it fades in and rises 14 px. The group holds, drifts up a few pixels, then clears (80 ms) before a pause, or swaps on the frame the next group starts (no blank frame between them). |
| `dark-object-card` | A full-screen cutaway: charcoal-to-slate gradient, live film grain, two words at the top (light then bold, each arriving when he says it), one to three real logos in the middle with a warm glow, each arriving when he names it. The card settles in (106% to 100%), then pushes in 5% and drifts up while it holds. |
| `constant-motion` | A cut about every two seconds (`--shot-every`): on a payoff line as it arrives (always a push in, one step tighter), else in a pause before a word (measured in his voice), else as a new caption group comes in. Shots alternate close and closer, and every cut changes the framing by at least 12%. Inside every shot a slow push from 100% to 105%, and the frame follows him sideways (his face position smoothed over about a third of a second). Cards settle, push and drift. |

### How the background is treated (trial B: the clean plate)

The phone does not move during a take, so the room behind him can be known
exactly. Trial A guessed the room's colour from the pixels around his edge;
trial B builds a clean plate of the room and works against it.

1. Mediapipe selfie segmentation (`--mask-model 0`, the general model; the
   landscape model 1 gives blockier edges) runs on a 288x512 copy of every
   frame, and the masks are smoothed over five frames where the picture did
   not change.
2. **The plate.** Every sixth frame at half size, the pixels the model calls
   room (kept 28 px clear of him) are matched for exposure (the phone changes
   it as he leans in) and the median of each pixel over those frames is the
   room. Where he never moves away, the plate is filled smoothly from what is
   around it. The report gives the camera-stillness check (the room's residual
   against the plate; trial B: 1.0 on a 0-255 scale) and how much of the frame
   the plate saw (59%). If the camera moved (residual over 6) the renderer falls
   back to trial A's cut-out by itself; `--no-plate` forces it.
3. **The edge.** The model's mask only says where the edge is (a band 24 px
   either side). In the band, each pixel's alpha is how far its colour is from
   the room behind it, towards his colour just inside (Lab, lightness turned
   down): a pixel the plate explains is room, whatever else it looks like. A
   coloured pixel the model is sure is him and that is neither room nor a mix
   of room and his edge colour (the shadowed neck under the jaw) is him, which
   removed the green see-through strip trial A had at the jaw (16.8 s).
4. **The light.** Wherever the alpha is partial, the room's light is
   subtracted and the set's put in its place (out = I - (1-a) room + (1-a)
   set), and an edge pixel is never lighter than him just inside it. That is
   what removed the pale rim trial A still had round his ears and hair (12.75
   s, 13.75 s).
5. **The hands.** A fast, blurred hand the model misses is held by its
   difference from the plate (in 95 of trial B's 456 speaker frames), so it stays
   soft and whole against the set instead of turning to grey wisps (trial A,
   12.75 s and 13.75 s, by his right shoulder).
6. **Steady edges.** Each frame is finished one frame late: where the picture
   has not changed across the last, this and the next frame, an edge pixel's
   alpha is the median of the three, keeps 80% of the last output frame's
   value when that is close (within 0.25), and is softened by 1 px without
   spreading into the set. Where anything moves, or the plate says room or
   surely him, it takes this frame's value, so nothing trails.
7. **The set** is made once from the plate, not from each frame, so nothing
   from the frame (a passing hand's blur, his shadow) can leak into it:
   softened, desaturated, darkened and tinted to the ink's green-black
   (#0C1512), with a soft warm set light behind his head and a vignette. A
   little grain over the whole frame keeps the dark gradient from banding.

Trial A's cut-out (colour band only, the room taken from the frame) is still
in the renderer as the fallback.

## Type on trial (not approved)

Krish asked to upgrade the typography, so the trial uses two open-licence (SIL
OFL 1.1) faces close to the reference. They are **on trial, not approved**:
the brand faces are still Anton, Archivo and IBM Plex Mono (`fonts/`), and
Krish decides whether these join them.

- `fonts-trial/outfit/Outfit[wght].ttf` (light 300, bold 700) with its `OFL.txt`
- `fonts-trial/playfairdisplay/PlayfairDisplay-Italic[wght].ttf` (600) with its `OFL.txt`

Both came from the google/fonts repository
(`raw.githubusercontent.com/google/fonts/main/ofl/outfit/` and
`.../ofl/playfairdisplay/`) on 17 Oct 2026. The renderer refuses to run if a
face is missing, and refuses any caption with a character the faces cannot
draw (Pillow would draw a box rather than fall back), so a font can never
silently fall back.

## Run it

Use the Python with mediapipe and cv2 (`.cache/py312/bin/python`); it also
needs ffmpeg and a headless Chromium (the logos are SVGs, rasterised
unaltered; in the cloud container it finds Playwright's in `/opt/pw-browsers`).

Every time is on the take's own clock (the clock of the words file).

```
.cache/py312/bin/python scripts/quick-edit/style_trial.py \
  --take ".cache/episode-test/takes/Wed 14 Oct - 3-minute - Three kinds of AI.mp4" \
  --words .cache/episode-test/out-long-24/wed-episode-test.words.json \
  --start 81.7 --end 103.2 --recipe all \
  --cutaway "84.12-86.62|meta-cream.svg,apple-cream.svg@Siri|its rival" \
  --bold "scored,Muse#1,Six,price,privacy,10,tie,best,Muse#3,jobs,Siri#3" \
  --payoff "43 out of 60;opposite reasons;your stuff private" \
  --out .cache/style-trial/trial-b.mp4 --sheet .cache/style-trial/trial-b-sheet.jpg \
  --stills 0.7,2.45,3.4,4.3,5.9,7.4,9.6,11.4,12.4,13.75,14.5,15.0,16.8,18.0,19.25,20.8 --sync-plot
```

(Trial A's command was the same with `--bold "scored,Muse,price,privacy,tie,best,jobs"`
and the trial A renderer.)

- `--cutaway START-END|logos|two words` (repeatable). Logos are file names in
  `--logo-dir` (default `docs/plans/2026-10-14-wednesday/logos/`); `file@Word`
  makes that logo arrive when he says the word. The two words arrive when he
  says them, if he does inside the card.
- `--bold` words are set bold wherever they are said, or `word#n` only the nth
  time he says it in the clip (so "Muse and Siri" can stay light while "Muse
  does more" and "and Siri keeps" carry the contrast). A group with no bold
  word and no payoff gets a number in bold if it has one ("out of 10 each"),
  else its longest content word of five letters or more; a group of little
  words stays light ("But the"), as in the reference ("is what I").
  `--no-auto-bold` turns that off.
- `--payoff` phrases (semicolon-separated) are set in the italic serif on their
  own line, with up to three lead-in words above them.
- `--cuts` replaces the automatic punch-in cut points (take clock).
- `--lead` (default 0.04 s) is how far before its onset a word arrives.
- `--shot-every` (default 2.0 s) is how often to aim for a cut.
- `--no-plate` uses trial A's cut-out; `--plan-only` plans the captions, shots
  and framing, prints them and renders nothing (fast, for trying cut points).

## What it writes

Next to `--out`:

- the clip: 1080x1920, 24 fps, H.264 High yuv420p (BT.709), AAC 48 kHz stereo
  of his own sound, nothing else in the mix;
- `--sheet`: a contact sheet of a frame every 0.5 s with the 12% and 82% safe
  lines ticked on each frame;
- `<name>.report.json`: the recipe, every word's whisper start against the
  onset it was snapped to, the caption groups and arrival times, the shots and
  zooms, the edge flicker (the model's mask before and after smoothing, and the
  final cut-out before and after steadying), and the caption checks (inside the
  safe area; frames where a caption's ink reaches the mouth or the chin, the
  closest it comes, and when);
- `<name>-stills/`: the single frames asked for with `--stills`;
- `<name>-sync.png` (with `--sync-plot`): his voice's loudness with a tick
  where each word arrives; the ticks should sit on the rises.

Word timing: faster-whisper often starts a word inside the silence before it,
or a little after the voice begins. Every place his voice comes in after at
least 60 ms of quiet belongs to one word: the word whisper has running there
if whisper started that word inside the quiet (its start was early, as with
"price" at 5.77 s, a p after a closure), otherwise the next word (whisper
stretched the word before over the pause, as with "of" at 7.10 s). A word
that starts with a hiss (f, th, s, h) starts at the hiss, not at the voice
after it ("43" at 10.09 s, "thing" at 13.55 s). Words inside running speech
keep whisper's time; at the places checked against a spectrogram (the t of
"10" at 7.36 s, the s of "Siri" at 9.00 s) it was right. Each word's end is where his voice stops after it, not whisper's end,
so pauses show (whisper had stretched "the" over the second's pause before
"best").

## Trial A (17 Oct 2026)

`.cache/style-trial/trial-a.mp4`: Wednesday's take, 81.7 s to 103.2 s on the
take's clock ("So I scored Muse against its real rival, Siri" to "Siri keeps
your stuff private"), every module on, one card (Meta, then Apple as he says
"Siri"; "its rival") from 84.12 s to 86.62 s. 21.5 s, 516 frames, rendered in
about two and a half minutes on four cores (0.2 s a frame).

What the report and the frames showed:

- Captions inside the safe area (ink between 1297 px and 1550 px of 1920; the
  UI lines are 230 px and 1574 px). Never on his mouth: the closest is 319 px
  below it. The lead-in line of a two-line payoff touches the bottom of his
  beard by up to 49 px in 29 frames (18.7 s to 21.4 s), where he leans in.
- Words: 14 of the 54 words moved to where his voice starts (whisper had "So"
  420 ms early, in the silence, and "Siri", "Six", "Muse" 90 to 180 ms late).
  In the sync plot every word after a pause lands on the rise of his voice;
  inside running speech the times are whisper's, checked only by eye.
- Edges: no light rim round the ears or hair at full size. Final edge flicker
  11.3 (0-255, mean frame-to-frame alpha change where the picture is still),
  down from 16.9 before steadying.
- Fonts: the trial faces load by path and every caption character is in both;
  nothing falls back.
- The card is never still: it settles from 106%, pushes 5% and drifts 22 px up
  while the grain moves; each logo and word bounces in on its spoken cue.

Still weak, for the next trial:

- The cut-out is a phone-camera segmentation. A shadow between his jaw and
  neck can go part see-through (a small green tint there, 16.8 s), and the
  room shows bright through the edge of his glasses lens where it sits against
  the wall.
- A fast, blurred hand is held by the mask only partly; its blurred edge goes
  soft against the set.
- Grouping is automatic; a pause can leave two words alone for a second ("But
  the", then "best" after his pause).
- The payoff and bold words are chosen by hand (`--payoff`, `--bold`); the
  engine does not yet pick them from the script.
- `numbered-level-chapters` and `negative-film-illustration` are in the bank
  but not built here.

## Trial B (17 Oct 2026)

`.cache/style-trial/trial-b.mp4`: the same stretch (81.7 s to 103.2 s), the
same card, after a frame-by-frame review of trial A against the reference
(a frame every 0.25 s, full-size crops of every edge, a spectrogram of his
voice under the word timings). 21.5 s, 516 frames at 24/1 fps, H.264 High
yuv420p BT.709, AAC 48 kHz stereo of his own sound (cross-correlated with the
take: it starts exactly at 81.7 s). About five minutes to render on four
cores. Sheet: `.cache/style-trial/trial-b-sheet.jpg`.

What trial A got wrong, and what changed (times on the clip clock):

- **Grey wisps behind his hand** (12.75 s, 13.75 s, by his right shoulder) and
  **a pale rim round his ears** (12.75 s, 13.75 s): the room was taken from each
  frame, so a hand's blur went into the set. Now the clean plate (above): no
  wisps, no rim at full size in any crop checked (0.5, 12.75, 13.75, 14.5,
  15.0, 16.8, 20.8 s).
- **Green see-through strip at the jaw** (16.8 s): gone (the off-line colour
  rule).
- **Fast hands** (12.5-15.0 s): held whole and soft.
- **"and" shown 0.3 s before he says "price"** (5.74 s; it was pinned to the
  start of "price"): every voice onset now goes to one word. "price" now
  arrives at its p (5.77 s), "43", "thing", "completely" and "private" at
  their first sound.
- **Weak bold choices**: "each" was bold in "out of 10 each", "things" in "Six
  things like", "thing" after "best", and "Muse" alone in "Muse and Siri".
  Now "10", "Six", "best", and the contrast "Muse does more" / "and Siri keeps".
- **Groups split mid-phrase**: "But the best" hung on screen through his
  second's pause. Now "But the" (clears at 12.63 s) then "best thing about
  this"; "out of 10 each" never splits before "of".
- **A blank frame between back-to-back groups** (the 80 ms fade-out ran into
  the next group, e.g. 5.92 s): groups now swap on the frame.
- **Captions on his beard** (29 frames, 18.7-21.4 s): one-line groups now sit
  on the bottom line (about 70 px lower), and a tight shot goes a little closer
  where the chin would reach them. 0 frames over the chin or mouth; ink between
  1297 and 1563 px (safe area 230-1574).
- **Pace**: shots ran 4.25 s; now nine shots, about 2 s each (0, 4.92, 7.0, 9.17,
  11.67, 13.08, 14.79, 17.33, 19.13 s), alternating 118% and 134% with
  punch-ins to 140%, 150% and 144% on the three payoff lines. Trial A cut from
  134% to 146% and back (9% steps, which read more as a glitch than a cut);
  every cut now changes the framing by at least 12%.
- **Head cut off at the side in tight shots** (19.25 s): the frame now follows
  him sideways. At 19.25 s he leans to the very edge of the source, so it
  stays tight there.

Still weak:

- **Edge shimmer** is about the same as trial A, not better: on the same frames
  trial A's cut-out measured 7.6-15.4 and trial B's 8.5-15.1 (mean frame-to-
  frame alpha change at still edges, 0-255; the clip's report gives 13.3 for
  trial B). The shoulder line at the left edge of the frame shows small dark
  nicks in a few frames. Checked on numbers and still frames only; nobody has
  watched it play.
- **"and" at 5.92 s** still arrives about 0.15 s early (whisper put it on the s
  of "price"; there is no pause there to find it by).
- **Glasses**: the green reflection in his lenses is in the footage; the
  treatment does not touch it.
- **The card** is unchanged: two cream logos, no 3D object, plainer than the
  reference. The green-black set has not been seen by Krish.
- Payoff and bold words are still chosen by hand on the command line.
- `numbered-level-chapters` and `negative-film-illustration` are not built.

