# Dark Keynote: style prompt

> A near-black stage under one spotlight. One giant number at a time, centred, rising out of a glossy floor; a slow
> band of light sweeps across its face as he lands it; a small label above, the credit below. Nothing else on stage.
> Grammar from the product-keynote reveal.

## 1. Essence, and what it is not

1. **One number, a lot of dark.** Each beat is a single figure, centred, with room around it.
2. **Light moves, slowly.** A band of light crosses the number as it lands; the beam breathes; motes drift.
3. **The floor reflects.** The number stands on a glossy floor and its reflection fades out with no edge.
4. **Change by dissolve.** A slide rises in and sinks out; never a wipe or a cut.

Not Swiss Kinetic (no grid, no counting). Not The Ladder (no object). Never two ideas on stage at once.

## 2. Materials and rendering

- Canvas 2D, frame by frame from t alone (`lab/styles/dark-keynote/scene.mjs`).
- Stage `#070C0A` (ink, pulled darker), a blurred spotlight cone from above, a floor pool, 46 motes, a vignette,
  the house grain.
- The number: a vertical gradient (lit at the top), a soft glow, the light sweep clipped to the glyphs on an offscreen
  layer, the reflection masked by a gradient.

## 3. Colour logic

| Use | Token |
|---|---|
| Stage | ink, darker |
| Numbers | cream into a warm grey; muted for the expected value |
| The answer (=, the branches, MORE?) | mint, with a mint glow |
| Label and credit | cream-soft, muted |
| Series name in the dress | the series colour |

**Skin record.** The keynote's white-light accent is cream; its answer colour is mint.

## 4. Type and captions (the brand skin's always-band)

- Anton 430 px for the number (shorter words at 62%); IBM Plex Mono 40 px for the label above and the credit below.
- Captions at A: directly under the number and its credit (`env.captionBase` 1236 on the tall canvas).

## 5. Motion quality

- 30 fps, house curves. A number rises over 0.7 s on the hero curve, holds, sinks over 0.45 s. The sweep crosses in
  1.6 s; on "watch the branches" it crosses again.

## 6. Shot and layout grammar

- One locked shot: the stage never moves; only the light and the numbers do.
- **Tall:** label at y 590, number on the floor at 1030, credit, caption; the lower stage stays dark on purpose.
- **Wide:** the same composition, centred.

## 7. Sound palette

A low swell under each reveal, a soft thump as it lands, one chime on the answer, long quiet between. His voice at
-12.5 LUFS.

## 8. Native moves

- **Light-sweep number** (`lab/moves/light-sweep-number`): rise, sweep, reflection, sink.
- **The breathing beam:** the spotlight widens and narrows slowly.
- **The second sweep:** the light crosses a held number again to point at it.

## 9. Fit

"Changed this week" and any piece built on one or two decisive numbers. Lengths: 15 s to 2 min. Not for a piece with
many facts or one that needs its source on screen.

## 10. Make it mine

- **Safe to change:** the label words, the sweep's timing, the beam's width.
- **Changes its character:** more than one number on stage; camera moves; a light background.
- **Cannot change:** one number at a time; slow light; the brand skin's always-band.

## 11. Proof

Style frames on the house test script (11 Nov) and the 9:16 demo film, ending on the house close card.

## 12. Verdict and scores

Krish, 11 Nov 2026, on the six style frames: "yes to all three, render the cuts". Ratings and scores from the full cut go here, word for word, with the date.
