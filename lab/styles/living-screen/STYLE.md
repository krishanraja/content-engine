# The Living Screen: style prompt

> A real-looking product interface, rebuilt in code so it performs on cue, shown as a lit screen floating in 3D
> space with neon light streaks drawing round it. The camera locks to the part being spoken about.
> Krish's references: the Mon 9 Nov "Disney, Google and Character.AI" cut ("pretty good overall in terms of
> production quality": a real artefact on ink, tilted, with neon streaks and glow) and The Ladder v2 he approved on
> 10 Nov ("much better, go"). Grammar only.

## 1. Essence, and what it is not

1. **The interface is the evidence.** Numbers live in the cards of a working screen; the chart draws itself as he
   says what moved. Nothing floats free of the interface.
2. **The camera reads for the viewer.** It locks onto the card or chart being spoken about, close enough to read,
   then pulls back. A cursor does what a person would do: it clicks the tab, hovers the number.
3. **Light, not flatness.** The screen sits in a dark room lit by neon streaks in the series colour and mint, with
   bloom on the streaks only. The screen itself stays crisp.

Not The Ladder (no physical object). Not a screen recording (everything is rebuilt, so it can act on cue). Never a
flat UI on flat ink (the first draft).

## 2. Materials and rendering

- three.js, frame by frame from t alone (`lab/styles/living-screen/scene.mjs`). The interface is drawn into its own
  2400 x 1600 canvas each frame and mapped onto the screen.
- The screen is an unlit material held under the bloom threshold, so text stays sharp; a metal bezel and a soft
  reflective floor give it a place to stand.
- Streaks are tubes along curves, drawn on over 1.6 s, glowing through a half-resolution bloom pass.
- Over the 3D: an ink scrim behind the dress and credit, a vignette, the house grain.

## 3. Colour logic

| Use | Token |
|---|---|
| Room, floor, interface ground | ink, ink-soft |
| Interface text | cream, cream-soft, muted |
| The changed number's block (+43%); the selected tab's marker; two of the streaks | the series colour |
| The answer (jobs level; "watch the branches"; the task's copies); one streak | mint |

## 4. Type and captions (the brand skin's always-band)

- Inside the interface: Anton for the numbers (the old value struck), IBM Plex Mono for labels, Archivo for the tabs.
- Over it: the house caption build, the dress, the producer credit (IMF · BESSEN 2015) in the type zone.
- Interface text only counts as read when the camera brings it to at least 40 px on the tall canvas (F44); the hook
  and the ask frame the screen close enough for that.

## 5. Motion quality

- 30 fps, house curves. A camera move takes 1.0 s on the hero curve; the camera drifts slowly between moves.
- Counts run in 0.6 s and land on the spoken number. A click shows a mint ring for 0.45 s.

## 6. Shot and layout grammar

- Shots: the hook (screen three-quarter, streaks drawing), each card in turn, the chart, the Customers tab, the
  chart again for the two lines, then the ask.
- **Tall:** the dress and credit own the top; the screen's focus point sits just above the caption band.
- **Wide:** the screen fills the frame at a slight angle; the type sits top left.

## 7. Sound palette

His voice (-12.5 LUFS); synthesised keys while the count runs, ticks on clicks, whooshes on camera moves, one chime
on the answer. The house bed is added on a home computer.

## 8. Native moves

- **Locked zoom:** the camera arrives on the part being spoken about and holds it readable.
- **The count in the card:** the number runs and lands on the spoken word; the old value appears struck beside it.
- **The live chart:** a dashed "expected" line dives, then the two real lines draw, one turning mint on "watch".
- **The tab click:** the cursor clicks a tab and the panel changes to answer the next sentence.
- **The task copies itself:** a row ticks done; four new slots open.

## 9. Fit

under.the.hood and follow.the.money pieces about a product, a dashboard, a test or a market's numbers. Lengths:
30 s to 5 min. Not for a piece with no data or no product.

## 10. Make it mine

- **Safe to change:** the interface's content and layout, the streak colours within the house tokens, the pace.
- **Changes its character:** a real screen recording instead of a rebuild; no camera moves; flat 2D.
- **Cannot change:** the camera reads for the viewer; the interface stays crisp; the brand skin's always-band.

## 11. Proof

Demo films on the house test script, tall and wide, ending on the house close card filmed by
`scripts/quick-edit/kit.py`.

## 12. Verdict and scores

Untested. Krish's ratings and scores go here, word for word, with the date.
