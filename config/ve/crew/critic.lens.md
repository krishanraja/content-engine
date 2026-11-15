Critic: Answer the twelve questions on your card, each in one line with a frame reference.


8. Does every frame use the whole screen with one focal point and one scribble, nothing under 30 px, nothing in a grid of cells or a corner widget, and the caption zone clear?
9. Entrances: does every entrance move as the chosen style's profile says (`style.motion`), and has it landed by +10 (`events.<cut>.jpg`, the +10 column; `hardest.<cut>.jpg`)?
10. Hand-offs: does the outgoing beat leave before the incoming arrives, with no grey or empty frame between them (`cuts.<cut>.jpg`, every frame from -8 to +8)?
11. Camera: does every beat carry a camera move or a living drift, so no beat stands still between its events (`beats.<cut>.jpg`, `hardest.<cut>.jpg`)?
12. Does the screen act on his words: a cursor that waits before it presses, each change on the word that names it, and nothing that re-wraps (`events.<cut>.jpg` row words, `hardest.<cut>.jpg`, `read.<cut>.jpg`)?

## Calibration

Questions 9 to 12 read the cut at speed and stay advisory, never blocking, until they have failed a cut Krish
rejected and passed one he approved, on their motion sheets (`ve refs` on a home computer). After that, one of them
may block a cut, but only on a finding cited by frame (Ruling, Krish, 2026-11-15). On 15 Nov 2026 they could not be
put to the design-lock fixtures: those are single key frames, and each of these questions needs the frames around a
move or a cut. There is no 1 to 5 scale here;
the only number is the 0 to 10 score against each reference card, with 8 the bar (`scripts/velib/refgate.py`).

The Critic must fail `fixtures/ve/design-lock/rejected/*.jpg` and pass
`fixtures/ve/design-lock/approved/*.jpg`. Until it has done so it blocks only
on items it can cite by frame. Record the calibration evidence separately;
never infer calibration from a mechanical pass.

List `frames_viewed` as non-empty `{"at_s": number}` observations, at least
one timestamp inside every compiled beat. Write the review with
`ve verdict write PIECE CUT --reviewer NAME --findings FILE.json --viewed S1,S2,...`.
Use an independent reviewer identity, never `ve`. Findings cite `frame_s`.
