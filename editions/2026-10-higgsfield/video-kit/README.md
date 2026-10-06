# Higgsfield, taken apart: the edit settings

The settings that made the under.the.hood video for Wednesday 7 October 2026
with `scripts/quick-edit`. Krish recorded it from script v4 (3:38 raw, upright
1080x1920); the finished cut is 3:04 plus the 4-second end card, in the post's
`3 Video` folder in the library, with the YouTube words that match it.

| File | What it is |
|---|---|
| `higgsfield.json` | The edit: `crop: "auto"`, the restart at 3:02 (`restart_near`), caption fixes for what the transcriber misheard, the six graphics and the strap. |
| `make_gfx.py` | Draws the graphics (`gfx/`) and the end cards in the under.the.hood look, from HTML with Playwright. |

What the edit did:

- Cut Krish's restart at 3:02, "How do you keep your biggest, how do you,
  sorry, lose your biggest supplier?", keeping the clean retake. The first
  restart finder cut the middle of that double stumble; it now goes back to the
  first start (`make.py --self-test` holds the case).
- Cut every pause over 0.35 seconds: 3:38 to 3:04.
- Fixed captions: "had cost a billion" to "had crossed a billion", "computing
  power group" to "grows", "nobody is back to full" to "nobody has banked a
  full", "influencer during" to "doing".
- The first render was killed for running out of memory on this long upright
  recording; stage 1 now cuts each window on its own and joins them.

The recording reached the cloud session through `send.py` run on Krish's
machine. From the recordings lane on, a session fetches it itself with
`scripts/post-pack/recording.py get higgsfield.mp4`. Media are not committed.
