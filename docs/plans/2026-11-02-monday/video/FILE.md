# Monday 2 November: filing both cuts, once Krish has watched them

Run nothing here until Krish has played both cuts through at full size and said so in his own words, and the
independent reviewer has passed them against the direction's `acceptance` (REVIEW.md, "Status"). From the repository
root, with `MAKING_BY="Claude Code"` and the pinned ffmpeg on PATH
(`.cache/tools/ffmpeg-n8.1.2-53-g1005b294ff-linux64-gpl-8.1/bin`).

W = `.cache/produce/2026-11-02-9a0c97af`

1. Record his acceptance and the review evidence in each cut's receipt (`<video>.validation.json`: full_review with his
   exact words, motion from `W/motion/long-stabilised.json` and `short-stabilised.json`, visual_clarity, sync if a
   SyncNet run is made on a home computer). The 5-minute cut's words check is held on transcriber hearing
   (REVIEW.md): only his words, after listening at the four places named there, carry it.

2. Archive (Drive, through the archive root on a home computer, or MINDMAKE_ARCHIVE_ROOT):

```bash
python3 scripts/quick-edit/archive.py --subject "Who trains your 2030 seniors" --date 2026-11-02 --wide .cache/produce/2026-11-02-9a0c97af/long/who-trains-your-2030-seniors-long-16x9.mp4 --tall .cache/produce/2026-11-02-9a0c97af/short/who-trains-your-2030-seniors-short-9x16.mp4
```

3. Send the archive folder to the post's video section, dry run first. POST FOLDER is the pack folder `making.py show`
   names once the piece's pack exists (its Pack step is still to do):

```bash
python3 scripts/post-pack/send.py "ARCHIVE FOLDER" --as "3 Posts/POST FOLDER/3 Video" --purpose "The finished videos and their thumbnails: wide 16:9 for YouTube and Substack, tall 9:16 for Shorts, Reels, TikTok and LinkedIn" --dry-run
```

4. Put both cuts on the record:

```bash
python3 scripts/post-pack/making.py 9a0c97af-f0d6-4d12-a7ce-773c622d4b67 video long "Long cut, 16:9" "3 Video/Who trains your 2030 seniors - wide 16x9 - YouTube, Substack.mp4" --seconds 283 --thumb "3 Video/Who trains your 2030 seniors - wide 16x9 - thumbnail.jpg" --thumb-file .cache/produce/2026-11-02-9a0c97af/thumbs/thumb-16x9.jpg --music no-curves-instrumental
```

```bash
python3 scripts/post-pack/making.py 9a0c97af-f0d6-4d12-a7ce-773c622d4b67 video short "Short cut, 9:16" "3 Video/Who trains your 2030 seniors - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4" --seconds 67 --thumb "3 Video/Who trains your 2030 seniors - tall 9x16 - thumbnail.jpg" --thumb-file .cache/produce/2026-11-02-9a0c97af/thumbs/thumb-9x16.jpg --music no-curves-instrumental
```

```bash
python3 scripts/post-pack/making.py 9a0c97af-f0d6-4d12-a7ce-773c622d4b67 show
```

Remaking either cut: `python3 docs/plans/2026-11-02-monday/video/panels.py render`, `configure`, then
`python3 scripts/quick-edit/make.py .cache/produce/2026-11-02-9a0c97af/kit/<cut>.json --out .cache/produce/2026-11-02-9a0c97af/<cut> --only <16x9|9x16> --share-mib 29`
(the long share copy's audio then needs the limiter again: REVIEW.md, loudness). Thumbnails:
`python3 docs/plans/2026-11-02-monday/video/thumbnails.py --words "CLAUDE IS EATING ITS OWN JOBS"`.
