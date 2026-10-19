# Spotify: makeyourmindup as a show

Krish, 2026-10-14: "I think we should create a Spotify strategy ASAP. To be
honest I think you should help me to create scripts for everything. Make your
mind up: what is published thus far, and then, moving forward, add it to the
publish board, knowing that you need to treat it as a media channel and create
the assets for it as well (in the sizes it requires and whatnot)."

Specs, sources and reasoning: `docs/research/2026-10-14-spotify.md`.

## Where it lives

A new show on **Spotify for Creators**, uploaded there directly. Never
connect the Substack podcast feed: it is blocked today and would make a second,
duplicate show. Substack is not a Spotify video partner, so video sent
through it can't earn.

## What an episode is

1. **Now:** the 16:9 long cut (about 5 minutes) as a video episode, with the
   90-second tall cut as its Spotify clip. The four long cuts already made
   (5, 7, 12 and 14 October) go up first, so the show opens with four
   episodes, past Spotify's three-episode bar.
2. **From 16 October: the week's deep cut** (house rule DEEP_CUT,
   `config/deep-cuts.json`). One piece a week, picked by its breakout score,
   records 8 to 12 minutes in place of its 5-minute cut. That deep cut is
   the week's Spotify video episode and the YouTube long-form video. The
   first is Friday 16 October. The other pieces' long cuts can still go up
   as shorter episodes. The audio edition below is the same script.
3. **The audio edition** (as planned before the deep cut). Krish reads the
   article, rewritten for the ear (1,200 to 1,700 words, about 8 to 12
   minutes), on the teleprompter in the same sitting as the two cuts. It goes
   up as a 16:9 video episode. `story_check.py --cut audio` checks the script.
   Scripts for everything already published are in `docs/plans/spotify/`.
4. **Not yet:** a conversational show. It costs the most to make, and nothing
   in the engine supports it.

Cadence: Monday, Wednesday and Friday, the same day as the Substack post.

## The assets, every episode

| Asset | Size | From |
|---|---|---|
| Video episode | MP4, 1920x1080, H.264, AAC stereo 192 kbps | the long cut, or the recorded audio edition |
| Thumbnail | 1920x1080 (16:9) | the wide thumbnail (draw at 1920x1080 for Spotify) |
| Clip | 1080x1920, 15 to 90 seconds | the 90-second tall cut (already under 89 s) |
| Chapters | at least 3, first at 00:00, 30 s apart, titles under 40 characters | the script's sidecar `<script>.chapters.md` (titles and where each part starts); times set after recording |
| Description | the first 250 characters show before "more" | the episode's words in `words.json` (`spotify_description`) |
| Episode art | none: the show art is used (once set, it cannot be removed) | |

Once, for the show: **show art, 3000x3000 square JPEG under 1 MB**, and the
show name, description and category (Technology, or News > Tech News).

## On the publish board

Every day page has a Spotify step after LinkedIn (`publish_kit.py`),
and the board has a Spotify tick (`week_board.py`, step `spotify`). It is
optional, so it does not count towards 100%, until the show exists. Then it
joins the standing channels. `making.py <piece> posted spotify [url]` records
it.

## Waiting on Krish

1. **The show's name: picked.** "Make Your Mind Up" (Krish, 2026-10-14:
   "Spotify is just S1"), recorded in `config/title-verdicts.json` (surface
   `spotify-show`). Show art at `docs/plans/spotify/show-art.jpg` (3000x3000
   sRGB JPEG, under 1 MB), drawn by `docs/plans/spotify/show-art.py` in the
   house look; the JPEG is git-ignored, so the script redraws it. Waiting on
   Krish's look at the art before it goes up.
2. **Create the show** in Spotify for Creators (creators.spotify.com), signed
   in as himself. Only the account owner can do this.
3. **Confirm the music bed's licence covers Spotify** before the first upload.
