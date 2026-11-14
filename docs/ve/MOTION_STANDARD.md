# The premium motion standard

Status: Signed by Krish, 3 Nov 2026 ("I signed the motion standards"), with the word caption build as the default for
face-with-proof (ve lint `captions.word_default`). The house standard from that day.

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
3. **No wordmark over vertical content; nothing touches it anywhere.** Ruling (Krish, 2026-11-11): "I don't think
   they're necessary and should be permanently removed from all templates", of the brand mark and badge on vertical
   videos, and "make sure animations never go above or on top of wordmarks". He then scoped it: "I don't have a no-word-mark rule for tall videos entirely. I just have a no-word-mark rule during the animated content, not the closing outro card." The 9:16 cut's animated content carries no mark tile,
   wordmark, series pill or opening logo in any route (ve, quick-edit, the style lab, the Studio routes); `ve qc`
   proves it (`brand.no_mark`) and `engine.test.ts` refuses chrome on any 9:16 beat. On the 16:9 cut a card's box
   never overlaps the mark tile or the wordmark; the lab's `check.mjs` fails any word drawn over or under them.
   The closing outro card keeps the wordmark.

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
| Word position, face shot | centre at 66% of the height, on the chest, under the chin | centre at y 1250, its box ending above y 1320 where Instagram's handle and caption start (11 Nov 2026), and never on the face |
| Held title | yellow, two lines, top at 19% of the height, about 44 px cap height of 718 | `brand.title`, top at y 290 (under every channel's top bar since 11 Nov 2026), 66 px |
| Loud word | a large upright serif in quotes ("SPEAK") over the chest in the jackroberts reel | the upright house serif (Fraunces, added to the kit 3 Nov 2026: "add the upright Fraunces to the kit") |

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
quick-edit holds a tall cut whose caption band strays and lists any word its OCR reads there.

**Use the whole safe screen (Krish, 11 Nov 2026).** "All vertical video templates should be adjusted to make maximum use
of the full screen, as opposed to the current situation where a third of the screen at the top is now cut off. Ensure
that we stay within the boundaries of all the social platforms so that elements and captions don't end up underneath
the social app UI features." So on the tall canvas:

| What | Where |
|---|---|
| Key content (every ve slot box, a lab style's type, a quick-edit picture) | starts by y 340, just under the top bar at 270; x 60 to 860; ends by y 1050 in ve |
| House caption | x 60 to 860, y 1090 to 1320 (`house/geometry.ts` `HOUSE.caption`, `config/ve/design-lock.json` `zones.caption`) |
| Word caption | centred at y 1250 on face beats, its box ending by 1320; on the seam on SPLIT beats |
| SPLIT house caption | on the seam, y 670 to 850 (`FWP_SPLIT_CAPTION_ZONE`) |
| Held title | from y 290 |
| quick-edit captions | x 60 to 860 at y 1060 (over the speaker) or 1014 (over a picture); its tall picture from y 270, x 60 to 860 |
| Footage, grounds, 3D, the end card | full bleed: only words and the point of a graphic keep to the safe area |

Checks: `engine.test.ts` ("uses the top of the tall screen"), `tests/channel_safe_test.py` (the real ve layouts, the
quick-edit bands and the tall panel clear every channel) and the lab's `check.mjs` ("the top of the tall screen is
empty" when the topmost word starts below y 340 on more than a quarter of frames).

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
icons). For the loud word that meant the house serif's own upright cut, now in the kit (`Fraunces-Upright-Variable`, from the
brand kit in Drive; Krish, 2026-11-03: "add the upright Fraunces to the kit"), not a borrowed face.

## Signed and approved (Krish, 3 Nov 2026)

- The standard, and word captions as the default for face-with-proof: "I signed the motion standards".
- Spend for the four Codex cards above: "I approved the spend". They were queued to the home computer's Codex lane;
  card 1 (`ve-motion-1-split-full-width`) was built and merged on 3 Nov (#367), and cards 2 to 4 are not merged yet.
- The Instagram zones in `config/studio.json` brought up to the measured ones: "I approve updating the Instagram
  button zones".

## Widened to admit his own cuts (Ruling, Krish, 13 Nov 2026)

Asked whether the floor should widen to admit two of his own cuts, Krish answered: "yes it should".
- The AI music cut (11 Nov) slams things about 500 px with about 12% overshoot over 10 frames.
- The Character.ai cut (26 Oct) moves its type 0 px: it fades or blurs in only.

So an entrance now settles in 4 to 10 frames, travels 0 to 500 px and overshoots at most 12%. The 4 to 7 frame,
40 to 60 px figures above stay the measured default for the house look. `kit/motionProfiles.ts` (`FLOOR`), `kit.test.ts`
and `clock.test.ts` hold the widened floor.

## How it was measured

Shot lengths and cuts: `python scripts/ve.py study <reel>` (ffmpeg scene detection). Settle time: frames after each
cut until the mean frame-to-frame change falls under 1.2 grey levels, at 30 fps on a 90x160 grey copy. Sizes and
positions: full frames at 3, 12, 13, 17 and 33 s read on a 128 px grid. Face boxes: OpenCV 4's frontal face cascade on
frames 600 and 990 of each reel.

## Engine notes (not part of the signed text; audit, 3 Nov 2026)

- **Where the per-piece style comes from.** This standard is the floor every cut holds. Each piece also names one
  motion style from the bank, the `motion` layer of `config/style-references.json` (17 styles), as `style.motion`
  `{module, reason}` in its spec. ve lint refuses a spec without it from `creative_direction.MOTION_FROM` (9 Nov 2026,
  `motion.required`), and a Codex card written for that piece carries the style as its own `## Motion style` section
  (`scripts/velib/cards.py`). The format's own motion notes (`docs/ve/design/formats/*-motion.md`) hold its frame;
  the style works inside them, and this standard wins where they differ. ve lint also refuses a style the renderer
  cannot draw yet (`motion.not_drawable`, from 14 Nov 2026: one listed under `needs_device` in
  `apps/renderer/src/engine/kit/motion-profiles.json`), which would otherwise render in the house motion without a
  word; the board's style choices never recommend one either, even when a week plan names it.
- **Channel safe zones count (since 11 Nov 2026).** The tall layouts, the house caption, the word caption and the held
  title sit inside every channel's safe area (card `ve-motion-4-channel-safe-tall`, done that day), so
  `scripts/velib/qc_channel.py` has `ADVISORY = False` and `ve qc` fails a box under a channel's buttons.
- **Proved moving before scaled (4 Nov 2026, F04, F13).** From 9 Nov a whole cut renders only after Krish approves its
  hardest beat moving on his own take (`ve proof`, `scripts/velib/proof.py`), in the style he picked from mocks on that
  take (`ve styles`). The Critic scores the cut against that approved proof clip as well as the board cards, with the
  same 8/10 bar (`scripts/velib/refgate.py`, card `proof`). The standard above is what the proof is judged by; the
  proof is what the whole cut is judged against.
- **How the renderer holds a style to this floor (4 Nov 2026).** Each drawable style is a profile in
  `apps/renderer/src/engine/kit/motion-profiles.json` (entrance 4 to 10 frames, travel 0 to 500 px, overshoot at most 12% since the 13 Nov ruling,
  drift above 0, timed moves under 3.5 s, grounds from brand roles); `kit.test.ts` and `clock.test.ts` fail any that
  breaks it, and FormatMaster clamps a hand-edited profile inside it. Where a style asks for more than the floor allows
  (dark-keynote's long holds) the floor wins. A cut with no style keeps the house motion it had before, which is
  older than this standard (entrances 12 frames, a 24 px rise); a style is how a cut meets the entrance numbers.
- **How the camera and typing keep to it (4 Nov 2026).** Typing runs at the style's readable rate (25 to 40 characters
  a second, `kit/reveal.ts` `typedText`) and never so slowly that a line is still typing when its span ends. The
  living-ui zoom (at most 1.5x, inside the 1 to 3 band) keeps the line it zooms to inside the channel safe area
  (`config/channel-safe-zones.json`) and off his face (above the SPLIT seam, inside the layout's slots over a take);
  the follow-the-pen camera never shows past the canvas; a crossfade lasts 6 to 10 frames. `kit/strongStyles.test.ts`
  fails any that does not. `ve styles` offers only options that look different from the house and from each other
  (`config/ve/style-distinct.json`).

