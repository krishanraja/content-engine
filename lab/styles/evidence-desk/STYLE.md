# The Evidence Desk: style prompt

> The real source, on a lamp-lit desk. Every number is shown where it is printed, circled by hand in one pointer
> colour, lifted off the page whole, and pinned to one clock of when it was true. Grammar from the explainer's
> freeze, circle, magnify, and from Krish's Mon 9 Nov cut (real artefacts on ink).

## 1. Essence, and what it is not

1. **The source is the picture.** The captured page, never retyped or redrawn; the credit names its producer.
2. **Red only ever points.** A circle, an underline, the clock's playhead; nothing else is red.
3. **Freeze, then magnify.** The desk dims and the one line that matters lifts off the page, whole, at two to three
   times its size.
4. **One clock.** Every fact sits on a timeline of when it was true, and the playhead walks to the year being spoken.

Not The Ladder (no built object). Not a document scroll (the camera reads one line at a time). Never a source
recreated in our own type as if it were the original.

## 2. Materials and rendering

- Canvas 2D, frame by frame from t alone (`lab/styles/evidence-desk/scene.mjs`).
- Cards: the captured page multiplied onto near-white stock with the house paper at 22%, a deep soft shadow, a few
  degrees of tilt. Captures live with the render (`--assets`), never in the repository.
- Desk: ink under one warm lamp pool; a vignette; the house grain.
- Tall: the desk is a window below the clock (from y 906), so nothing on it sits behind the number, caption or clock.

## 3. Colour logic

| Use | Token |
|---|---|
| Desk, scrim | ink |
| Numbers, labels | cream, cream-soft, muted (the old or expected value) |
| The answer (teller jobs did not disappear; LEVEL; PEOPLE; the ask's circle; NOW) | mint |
| Pointer: circles, underlines, playhead, the strike on an old value | red `#FF5247`, the style's one kept accent |
| Series name in the dress | the series colour |

**Skin record.** The style's accent stays red, not mint: its job is to point, and mint already means the answer
while the series colour marks the channel only (brand skin, section 2a of the catalogue).

## 4. Type and captions (the brand skin's always-band)

- Anton for the number (190 px tall), IBM Plex Mono 40 px for the credit, the clock and the index card.
- Captions at A: directly under the number and its credit (`env.captionBase` 742 on the tall canvas).
- Source text is pixels of the page and is not checked as type; the strip makes the line large enough to read.

## 5. Motion quality

- 30 fps, house curves. The camera moves on the hero curve over 0.9 s and breathes between moves.
- A circle draws in 0.7 s and lands on the word it marks; the strip rises in 0.55 s; the desk dims to 60%.

## 6. Shot and layout grammar

- Shots: the desk whole (the source arriving), the 20 circled, the strip, the slip lifting, the 43 percent strip, the
  answer underlined in mint, the two marks joined, the index card for the ask.
- **Tall:** dress, credit, number, caption, clock, then the desk window.
- **Wide:** type and clock in the left column, the desk on the right.

## 7. Sound palette

His voice at -12.5 LUFS; a pen scratch as each circle draws; a whoosh as a line lifts and as the slip goes; one chime
on the answer; typing under the index card. The house bed is added on a home computer.

## 8. Native moves

- **Freeze, circle, magnify** (`lab/moves/freeze-circle-magnify`): circle or underline on the page, then the strip.
- **Source on the clock** (`lab/moves/source-on-clock`): pins drop on their year; the playhead walks.
- **Type is the picture** (`lab/moves/type-is-the-picture`): the number wipes up from its baseline, old values struck.
- **The slip:** a cream card hides the answer until he says it.
- **Two marks joined:** a dotted red line between the two facts that moved.

## 9. Fit

follow.the.money and "Changed this week": any piece resting on one or two published sources. Lengths: 30 s to 5 min.
Not for a piece with no checkable source.

## 10. Make it mine

- **Safe to change:** the cards' tilt, the desk's lamp, the pace, which lines are circled.
- **Changes its character:** retyping the source; more than one pointer colour; cutting between sources with no clock.
- **Cannot change:** the source is the real captured page with its credit; red only points; the brand skin's always-band.

## 11. Proof

Style frames on the house test script (11 Nov) and the 9:16 demo film, ending on the house close card filmed by
`scripts/quick-edit/kit.py`.

## 12. Verdict and scores

Krish, 11 Nov 2026, on the six style frames: "yes to all three, render the cuts". Ratings and scores from the full cut go here, word for word, with the date.
