# Swiss Kinetic Type: style prompt

> The type is the picture. A cream field on a strict, visible grid; one word or number at a time, set huge and flush
> left, wiped in on the beat it is said; facts in Plex Mono on the grid lines; one mint block for the answer; plain
> squares under the caption count what the words say. Grammar from the International Typographic Style, moving.

## 1. Essence, and what it is not

1. **One idea per frame, set as type.** The word or number is the whole picture.
2. **The grid is visible and strict.** Twelve columns and a 60 px baseline; everything snaps to it.
3. **One accent block.** Mint marks the answer; everything else is ink on cream.
4. **Counting is literal.** Squares below the caption are the tellers, the branches, the copies of the task.

Not Dark Keynote (no stage, no light). Not a slide deck (it moves on the beat, never on a click). Never a sentence on
screen: the caption carries the words, the type carries the one idea.

## 2. Materials and rendering

- Canvas 2D, frame by frame from t alone (`lab/styles/swiss-kinetic/scene.mjs`).
- Cream field with the house paper at 18%; grid hairlines in ink at 7% (columns) and 4% (baseline), drawn on in the
  first second.
- On the wide frame an ink masthead band carries the dress. The tall frame has no band and no dress (Ruling, Krish, 2026-11-11).

## 3. Colour logic

| Use | Token |
|---|---|
| Field | cream |
| Type, squares, rules | ink; muted for an old or expected value |
| The answer (+43% branches, the level bars, MORE?) | mint block with ink type on it |
| Masthead band | ink; series name in the series colour |

**Skin record.** The Swiss red accent became mint, because its job here is the answer (brand skin, section 2a).

## 4. Type and captions (the brand skin's always-band)

- Anton from 170 to 600 px for the idea; IBM Plex Mono 40 px for the facts on the grid lines and the section count.
- Captions at A: directly under the type block (`env.captionBase` 1008 on the tall canvas).
- No on-screen pair of words repeats the caption (F42).

## 5. Motion quality

- 30 fps, house curves. Type enters by a mask wiping up from its baseline or in from the left edge over 0.45 s, and
  leaves the same way over 0.35 s. A strike draws in 0.35 s. Nothing drifts.

## 6. Shot and layout grammar

- One frame per beat; the section number (01 / 10) counts them.
- **Tall:** credit and count at y 300 just under every channel's top bar, the type block (350 to 930), caption, then the squares from y 1160, ten across ending by x 844 (moved up 11 Nov 2026: Krish, "make maximum use of the full screen"); no band and no wordmark.
- **Wide:** type only, on the same grid; no squares.

## 7. Sound palette

Dry and percussive: one tick as each word lands, a low thump under each mint block, keys while the squares light,
one chime on the answer. His voice at -12.5 LUFS.

## 8. Native moves

- **Type is the picture** (`lab/moves/type-is-the-picture`): wipe in, hold, push out; optional strike and block.
- **The expected value in outline:** a dashed outline numeral for what never happened.
- **Counting squares:** twenty light, seven fall away; branches gain roofs and three mint ones drop in.
- **The equals sign:** two ink bars on a mint block.

## 9. Fit

Resource drops, shorts, and any piece with one strong number per beat. Lengths: 15 s to 3 min. Not for a piece that
needs a source shown or a person on screen.

## 10. Make it mine

- **Safe to change:** the grid's column count, the type sizes, the pace.
- **Changes its character:** more than one accent; type that floats free of the grid; full sentences on screen.
- **Cannot change:** one idea per frame; the visible grid; the brand skin's always-band.

## 11. Proof

Style frames on the house test script (11 Nov) and the 9:16 demo film, ending on the house close card.

## 12. Verdict and scores

Krish, 11 Nov 2026, on the six style frames: "yes to all three, render the cuts". Ratings and scores from the full cut go here, word for word, with the date.
