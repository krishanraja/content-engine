# The Ladder: style prompt

> One object carries the whole piece, and every number is drawn on, beside or instead of a part of it, so the viewer
> always knows what a number is about. Built in real 3D, lit, with mass.
> Krish's references: Mon 2 Nov "Who trains your 2030 seniors" ("one of the strongest in terms of the animation
> style of the job badges", production 8) and Mon 9 Nov "Disney, Google and Character.AI" ("pretty good overall in
> terms of production quality"). Grammar only.

## 1. Essence, and what it is not

1. **One object.** The piece picks one real thing its numbers live on (a bank branch, a career ladder, a receipt). It
   is on screen for most of the piece and changes as the numbers change.
2. **A number is a change to the object.** Twenty lit windows are twenty tellers. Seven go dark: that is the drop.
   Three branches drop into the street: that is +43%. The type confirms; the object shows.
3. **Mass and light.** Things have weight, shadows and materials (stucco, paper, glass that glows). Nothing is a flat
   icon on a flat ground.
4. **The camera never rests.** It cranes and pushes between acts and drifts slowly within one.

Not a chart style (the bars are objects, not axes). Not the Living Screen (no interface). Never thin line art on flat
ink: that was the first draft, and Krish asked for "significantly more premium".

## 2. Materials and rendering

- three.js, rendered frame by frame from t alone (`lab/styles/ladder/scene.mjs`). Soft shadow maps (PCF, 2048),
  ACES filmic tone mapping, a bloom pass so lit glass glows.
- Stucco and slabs carry the house paper texture (`assets/plates/two-passports/paper.jpg`, the Mon 2 Nov badges).
- The floor is ink-soft and takes every shadow; fog sends the distance to ink.
- Over the 3D: an ink scrim behind the type zone, then a lit vignette, then the house grain.

## 3. Colour logic

| Use | Token (never a copied hex) |
|---|---|
| Ground, fog, scrim, vignette | ink |
| Stucco, stone, slabs | cream, cream-soft, under paper |
| A lit window (a person working) | the series colour, emissive |
| The answer (jobs held level; "watch the branches"; the task's copies) | mint |
| The changed number's block (+43%) | the series colour, with ink type on it |

## 4. Type and captions (the brand skin's always-band)

- **Numbers:** Anton, 240 px on the tall canvas. The old value stands beside the new, struck through, in muted.
- **Labels and credits:** IBM Plex Mono, 40 px or more on the tall canvas (F44). Every number carries its producer
  (IMF · BESSEN 2015).
- **Captions:** the house caption (Archivo 900, cream on an ink plate with a hard offset shadow in the series
  colour), built word by word.
- **Dress:** the masthead wordmark top left, the series name top right in its colour.
- On-screen words never repeat the caption (F42; `check.mjs`).

## 5. Motion quality

- 30 fps, on the house curves (enter, exit, hero, utility from `config/ve/brand-tokens.json`).
- Counts run in about 0.6 s and land on the spoken number.
- A camera move takes 1.1 s on the hero curve; the drift is ±0.25 units.

## 6. Shot and layout grammar

- **Tall (1080 x 1920):** the type owns the top third (y 280 to 760, under the dress). The object sits in the lower
  two thirds; the camera's look-at is lifted so it lands there. Captions sit near y 1262, clear of every channel's
  handle zone.
- **Wide (1920 x 1080):** the type sits top left; the object sits centre right.
- Acts: hero branch (hook to "disappear"); the street (the 43%, the level line); back to the branch; the two
  towers; the ask. One set on stage at a time.

## 7. Sound palette

- His voice set to -12.5 LUFS, so the whole cut with its silent close measures near -14 (`render.mjs`).
- Synthesised foley only (nothing licensed in the lab): a tick per teller lighting up, a count on the drop, three
  soft thumps as the new branches land, one chime on the answer, whooshes on the camera moves.
- The house bed is added on a home computer (`MINDMAKE_MUSIC_ROOT`), never in the lab.

## 8. Native moves

- **The count on a part:** windows light one by one to the spoken number, then the leavers go dark in 0.07 s steps.
- **The street drop:** three copies of the object fall into the street on the spoken percentage.
- **The level line:** a mint bar draws across the ground under the street on "stayed".
- **Two towers:** stacks of slabs, one falling away under gravity, one growing; "watch" turns one mint.
- **The task copies itself:** one slab lifts off, turns mint, and makes four.

## 9. Fit

follow.the.money above all; any piece built on two to four sourced numbers about one real thing. Lengths: 60 s,
90 s, 5 min. Not for a piece with no object, or more than about six numbers.

## 10. Make it mine

- **Safe to change:** the object, the palette within the house tokens, the pace, the foley.
- **Changes its character:** flat rendering, removing the camera's movement, more than one object at once.
- **Cannot change:** one object; numbers drawn on it; the brand skin's always-band.

## 11. Proof

Demo films on the house test script (`docs/plans/2026-11-10-video-style-system/house-test-script.txt`), tall and
wide, ending on the house close card filmed by `scripts/quick-edit/kit.py` (`docs/production/CLOSING.md`).

## 12. Verdict and scores

Untested. Krish's ratings and scores go here, word for word, with the date.
