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

Ids are the bank's. `--recipe all` turns every one on; otherwise give a comma
list, and a module left out is simply not applied.

| module | what the renderer does |
| --- | --- |
| `full-face-vertical` | Crops in on the face (mediapipe finds it on every frame) so he fills the tall frame: 118% (close), 134% (closer) and 146% (the punch-in on a payoff). No split screen. Where a caption would sit on his chin the face is lifted as far as the frame allows. |
| `treated-background` | Cuts him from the room and turns the room into a set (below). |
| `kinetic-serif-captions` | Two to four words at a time, centred low over the chest, inside the safe area: a light geometric sans for most words, the word that carries the meaning in bold, the payoff phrase in a large italic serif with a peach-to-cream gradient and a soft warm glow. Never a subtitle bar. |
| `word-bounce-in` | Each word arrives on the frame it is said, scaling from ~5% to 108% and settling at 100% over 180 ms while it fades in and rises 14 px. The group holds, drifts up a few pixels, then clears (80 ms) for the next. |
| `dark-object-card` | A full-screen cutaway: charcoal-to-slate gradient, live film grain, two words at the top (light then bold, each arriving when he says it), one to three real logos in the middle with a warm glow, each arriving when he names it. The card settles in (106% to 100%), then pushes in 5% and drifts up while it holds. |
| `constant-motion` | A cut about every three seconds: in a pause before a sentence (the silence is measured in his voice, not taken from whisper), or on a payoff line as it arrives, which is always a push in. Shots alternate close and closer; inside every shot a slow push from 100% to 105%. Cards settle, push and drift. |

### How the background is treated

1. Mediapipe selfie segmentation (`--mask-model 0`, the general model; the
   landscape model 1 was tried on the same frames and gives blockier edges)
   runs on a 288x512 copy of every frame.
2. The masks are smoothed over five frames, but only where the picture did not
   change (a joint temporal filter), so a still edge stops flickering and a
   moving hand keeps its own mask. The report gives the flicker before and
   after.
3. The model's mask is ~20 px loose round the ears and hair. It is used only to
   find the edge: a band either side of it. Inside the band each pixel's alpha
   comes from its colour, placed between the person's colour just inside and
   the room's colour just outside, in Lab with lightness turned down (so the
   wall in an ear's shadow is still wall). The room's light is then taken back
   out of the edge pixels, and no edge pixel may be brighter than the person
   just inside it. That is what stops the light rim (halo) round the ears and
   hair.
4. Where the picture has not changed since the last frame, the edge keeps
   60% of the last frame's alpha, so hair and ears do not shimmer; where he
   moves, the alpha is all new (no ghosting on a gesture).
5. The room is filled out with its own colour where he stands (a normalised
   blur, so no skin or shirt bleeds into it), softened, desaturated, darkened
   and tinted to the ink's green-black (#0C1512), with a soft warm set light
   behind his head and a vignette. A little grain over the whole frame keeps
   the dark gradient from banding.

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
  --bold "scored,Muse,price,privacy,tie,best,jobs" \
  --payoff "43 out of 60;opposite reasons;your stuff private" \
  --out .cache/style-trial/trial-a.mp4 --sheet .cache/style-trial/trial-a-sheet.jpg \
  --stills 0.7,2.45,3.4,4.3,9.6,11.4,15.0,16.8,18.0,20.8 --sync-plot
```

- `--cutaway START-END|logos|two words` (repeatable). Logos are file names in
  `--logo-dir` (default `docs/plans/2026-10-14-wednesday/logos/`); `file@Word`
  makes that logo arrive when he says the word. The two words arrive when he
  says them, if he does inside the card.
- `--bold` words are set bold wherever they are said; a group with no bold word
  and no payoff gets its longest content word in bold.
- `--payoff` phrases (semicolon-separated) are set in the italic serif on their
  own line, with up to three lead-in words above them.
- `--cuts` replaces the automatic punch-in cut points (take clock).
- `--lead` (default 0.04 s) is how far before its onset a word arrives.

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
or a little after the voice begins. A word that follows a real pause is moved
to where the voice rises (the report says which and by how much); words inside
running speech keep whisper's time.

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
