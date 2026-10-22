# Wednesday stabilisation review

Every recording now needs a motion assessment before final composition. Apply
treatment when needed, or record measured and visual evidence for leaving it
untreated. Missing, inconclusive or stale motion evidence blocks delivery.
The production skills and native delivery guard enforce this.

Both Wednesday camera tracks needed treatment. Static brick-wall features
were tracked above the speaker, excluding his face and gestures. Camera
footage was corrected before cards, captions and logos were composited.
Accepted sound and the speech/caption clock remain unchanged.

| Camera track | Distributed continuous samples | Before RMS motion | After RMS motion | Reduction |
| --- | --- | --- | --- | --- |
| Long | Five ten-second windows, from start through end | 6.91 px | 2.23 px | 67.7% |
| Short | Three ten-second windows, from start through end | 9.10 px | 4.41 px | 51.5% |

These are camera-motion measurements on static background features, not
scores for natural head movement. Long samples are matched by sequential
decoded-frame index, avoiding the intermediate container's unreliable rate
metadata. A seek-based attempt that missed the last window was rejected.

The correction uses rigid transforms and one constant crop per recording.
All 7,969 long-camera and 2,145 short-camera transforms pass border/geometry checks. Each finished export passes six calibrated sync windows, with no offset exceeding 40 ms. The short also passes all 89 sampled face-centre checks. All 342 long and 99 short one-second frames, plus 38 quarter-second bookend frames per cut, have been visually inspected.

Final continuous phone playback acceptance remains open for both stabilised replacements. Sampled inspection does not certify continuous playback.
Original recordings and the earlier accepted exports remain preserved.
