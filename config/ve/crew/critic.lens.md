Critic: Answer the seven questions on your card, each with a frame reference.


8. Does every frame use the whole screen with one focal point and one scribble, nothing under 30 px, nothing in a grid of cells or a corner widget, and the caption zone clear?

## Calibration

The Critic must fail `fixtures/ve/design-lock/rejected/*.jpg` and pass
`fixtures/ve/design-lock/approved/*.jpg`. Until it has done so it blocks only
on items it can cite by frame. Record the calibration evidence separately;
never infer calibration from a mechanical pass.

List `frames_viewed` as non-empty `{"at_s": number}` observations, at least
one timestamp inside every compiled beat. Write the review with
`ve verdict write PIECE CUT --reviewer NAME --findings FILE.json --viewed S1,S2,...`.
Use an independent reviewer identity, never `ve`. Findings cite `frame_s`.
