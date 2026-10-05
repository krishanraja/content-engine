# The launch videos: the edit settings

The settings that made both launch videos on 2026-10-05 with
`scripts/quick-edit`: the hello for the launch post, and Who gets paid for
follow.the.money's first piece. Krish recorded both; the edit, graphics and
captions were done in the agent session the same day, and he has the finished
files.

| File | Video |
|---|---|
| `hello.json` | The hello: what makeyourmindup is, the three days (Monday follow.the.money, Wednesday under.the.hood, Friday mind.the.gap), and the scoreboard. 2 minutes 12 with the end card. |
| `who-gets-paid.json` | Who gets paid: Amazon blocked Meta's Muse, Shopify welcomed it, and where the money goes. 2 minutes 32 with the end card. |

To make either again, put the recording at `recording/<name>.mp4` beside the
config and the graphics in `gfx/` (the file names are in each config's
`cues`, `frame16` and `strap`; the sizes are in `scripts/quick-edit/README.md`).
The end cards come from `../hello/`. None of those files are committed: media
stay out of the repository.

```
python scripts/quick-edit/make.py editions/2026-10-launch/video-kit/hello.json --out out/hello --plan
```

What the edit did, so a re-record can match it:

- Cut the stumbles listed in each config's `remove`, and every pause over
  0.35 seconds. The hello went from 2:26 to 2:08 before the end card; Who
  gets paid went from 2:52 to 2:28.
- Fixed "Chris" to "Krish" in the captions, and "theater" to "theatre".
- Showed the face band from 100 to 550 pixels down the picture under each
  tall graphic, after the first try cut off Krish's eyes.
- Set captions at 70 pixels tall and 48 wide, after the first try read small.
