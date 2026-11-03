# The premium motion standard

Status: Proposed for Krish's sign-off, 3 Nov 2026. The checks named below already run; the numbers become the
house standard when he signs it.

Krish, 3 Nov 2026: "This video is a literal 1/10", "No, its the georgia subtitles build, and the motion and graphics of
the other one", "The graphics in your previous car are honestly fucking embarrassing. I'm not publishing that."

Every number here was measured on 3 Nov 2026 from the two reels he put on his inspiration board, read from Drive
(never copied into this repository): `instagram_DeZuQ7-lATg` (jackroberts___, 720x1280, 29.97 fps, 33.9 s) for look
and motion, and `instagram_DePHDr_jRed` (georgia_la, 404x718 upscaled, 69.3 s) for the caption build. Positions are
given on our 1080x1920 canvas (the reel's numbers x1.5). How each was measured is at the end.

## Look: the cards

| What | Measured | Our canvas |
|---|---|---|
| A product UI card on a full-screen graphic beat | 40 to 680 px of 720, **89% of the width** | 960 px wide, 60 px margins |
| A portrait media card (a picture) | 54% of the width, 464 px tall of 1280 | 580 px wide |
| Card top on a split beat | 200 px of 1280 (16%) | 300 px |
| Graphic half on a split beat | the top 50% (0 to 640) | 0 to 960; face below |
| Card finish | rounded corners, a soft outer glow in the card's accent (blue on dark UI), real UI content (waveform, prompt text, buttons) | the house glass card, glow on |
| Background behind cards | a pale gradient wash, never flat white or black | the theme's light wash |

Rules that follow:

1. **A SPLIT card draws at full width.** A device on the graphic half spans 80 to 90% of the canvas width. Shrinking
   the whole stage by `FWP_STAGE_SCALE` (0.76) into a corner is the look he rejected. Codex card
   `ve-motion-1-split-full-width`.
2. **Stamps are labels, never hero type.** The stamp draws fixed 30 px mono text. It may tag a hero card; it never
   carries a beat alone and is never the piece's hero device. `ve lint` refuses both (`motion.stamp_not_hero`).
   Headline type on a graphic beat is at least 96 px (the reel's "Gemini 3.8 Flash TTS" title is 64 px of 1280, which
   is 96 px here).
3. **Nothing collides with the mark tile.** A card's box never overlaps the mark tile's box. Codex card
   `ve-motion-2-mark-clearance` adds the check to `ve qc` composition and the fix to the layouts.

## Motion

| What | Measured | Standard |
|---|---|---|
| Cuts | 40.7 a minute (23 in 33.9 s) | 30 or more a minute on a graphics-led short |
| Shot length | median 1.54 s, longest 3.28 s | no graphic held more than 3.5 s without a change |
| An entrance settles | median 4 frames (0.13 s), 90th percentile 7 frames (0.23 s) | 4 to 7 frames, ease-out (fast start, soft land) |
| Picture changing | 100% of seconds; longest still 0 s | `motion.change_density` 1.0, `motion.longest_still` 1 s |
| Repeating loops | none | `motion.periodicity` none |
| Kinds of beat | full-screen graphic, split (graphic over face), face alone, a logo with animated rings, waveforms that move with the voice, notifications popping in, a quoted word in large upright serif over the chest | at least three kinds in any 15 s |

An entrance is one move that lands and holds while the voice explains it: a card rises 40 to 60 px and fades in over 4
to 7 frames; a ring or waveform keeps moving underneath. A move that restarts on no cue is decoration (failure F05).

## Captions: the georgia build

| What | Measured | Our canvas |
|---|---|---|
| Words a page | one | one (`brand.captions: "word"`) |
| Word colour and weight | white, heavy sans, soft shadow, no box | white Archivo bold, shadow |
| Word position, face shot | centre at 66% of the height, on the chest, under the chin | centre at about y 1270 to 1440, and never on the face |
| Held title | yellow, two lines, top at 19% of the height, about 44 px cap height of 718 | `brand.title`, top at y 250, 66 px |
| Loud word | a large upright serif in quotes ("SPEAK") over the chest in the jackroberts reel | the house serif (Fraunces); see "The brand may evolve" below |

**Never on the face.** `ve qc` fails any caption page whose box overlaps the face found in that frame, grown by 10%
(`captions.off_face`, `scripts/velib/qc_faces.py`). On a SPLIT beat his face is in the lower half, so a word at chest
height (y 1440) can land on it: the word sits on the seam there, as the jackroberts reel does. Codex card
`ve-motion-3-word-on-the-seam`.

## Channels: nothing under their buttons

Krish, 3 Nov 2026, on Monday's Reel: "It looks cramped. It looks like you almost didn't design this thoughtfully for the
format or the channel." Measured on his phone (`config/channel-safe-zones.json`): Instagram's back arrow and camera to
y 126, its like rail x 895 to 1080 from y 548 to 1671, its handle and caption from y 1373, and its comment bar hides
everything below y 1747. A tall cut's words, headline and the point of every graphic sit between y 200 and 1320, and
inside x 60 to 860 below y 520. `ve qc` fails a box that strays (`channel.safe_zones`); `python3
scripts/channel_safe.py FILE` reads the words in any finished video, cover or card and fails one under a button;
quick-edit lists both on every tall cut. Codex card `ve-motion-4-channel-safe-tall` moves the layouts.

## The reference gate

A spec names the board cards it is held to (`brand.references`: card, for look, motion or captions, the Drive id and
a takeaway in words). `ve lint` refuses a spec publishing after 5 Nov without one each for look, motion and captions.
`ve refs <piece> <cut>` puts the cut's frames above each reference's frames at the same points of their length; the
Critic scores the cut 0 to 10 against each card, and below 8 the cut is not ready (`scripts/velib/refgate.py`).

## The brand may evolve, never into an AI cliché

Krish, 2026-11-03: "no, instrument serif is over used in AI production, stick to BRAND", then "evolve my brand if you
need, but do not use bog standard AI cliches". So a look the references need is first sought inside the brand kit. When
the kit has nothing that does the job, the brand may grow, as a proposal to Krish naming what it adds that the kit
cannot. A face, colour or device that is everywhere in AI-made content is never proposed (Instrument Serif and the
other fashionable free display serifs, purple-to-blue gradients, glowing neural meshes, robots and brains, sparkle
icons). For the loud word that means the house serif: the kit carries Fraunces italic only, and the upright cut of the
same family is the evolution to propose, not a borrowed face.

## Waiting on Krish

- Sign this standard, and word mode as the default caption build for face-with-proof.
- Whether the loud word gets the upright Fraunces cut added to the kit, or stays italic.
- Spend for the four Codex cards above (each is written, none dispatched).

## How it was measured

Shot lengths and cuts: `python scripts/ve.py study <reel>` (ffmpeg scene detection). Settle time: frames after each
cut until the mean frame-to-frame change falls under 1.2 grey levels, at 30 fps on a 90x160 grey copy. Sizes and
positions: full frames at 3, 12, 13, 17 and 33 s read on a 128 px grid. Face boxes: OpenCV 4's frontal face cascade on
frames 600 and 990 of each reel.
