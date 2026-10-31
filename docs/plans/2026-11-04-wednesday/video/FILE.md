# Wednesday 4 November, Claude Duet: filing, after Krish has watched both cuts

Nothing here has run. The cuts are not filed and the piece's record has no Video assets yet: filing waits for Krish's
full playback of both cuts (`REVIEW.md`). Run on a home computer (the archive is Drive), from the repository root, with
`MAKING_BY="Claude Code"`. WORK is `.cache/produce/2026-11-04-b63d2507`.

## 0. Before filing

- Krish's words on both cuts, exactly as he typed them, go into each cut's `.validation.json` `full_review`.
- The lip-sync check needs SyncNet (`MINDMAKE_SYNCNET_ROOT`, `MINDMAKE_SYNCNET_MODEL`): this cloud session has none, so
  `sync` is missing in both receipts. Run `scripts/quick-edit/sync_check.py` on SURFACE for both files and record it.
- The receipts' `heard`, `visuals`, `motion` and `visual_clarity` blocks are built after his acceptance, as Monday 26's
  `video/CODEX_FINISH.md` step 4 describes.

## 1. The archive (once)

```
python scripts/quick-edit/archive.py --subject "Claude Duet" --date 2026-11-04 --tall WORK/render/short/claude-duet-short-9x16.mp4 --wide WORK/render/long/claude-duet-long-16x9.mp4 --tall-thumb WORK/thumbs/thumb-tall-1080x1920.jpg --wide-thumb WORK/thumbs/thumb-wide-1280x720.jpg
```

## 2. The visual gate on the videos and thumbnails

`WORK/gate/post.json` as `.agents/skills/produce-video/SKILL.md` section 8 shows, with the logos actually on screen:
long cut Gmail, Google Calendar, Slack, Microsoft 365, Claude; short cut Gmail, Google Calendar, Slack, Microsoft 365,
Claude; both thumbnails Claude (the drawer's `thumbs.json` names it). Then
`python scripts/post-pack/visual_gate.py WORK/gate/post.json`. The piece's own Visual gate step must read done first
(`making.py b63d2507-dbb4-449d-bce4-f21e859ee2ad show`); today it does not, and the Pack step is not built.

## 3. The post's library folder

POST FOLDER is the pack folder `making.py ... show` names once the Pack step is done.

```
python scripts/post-pack/send.py "ARCHIVE FOLDER" --as "3 Posts/POST FOLDER/3 Video" --purpose "The finished videos and their thumbnails: wide 16:9 for YouTube and Substack, tall 9:16 for Shorts, Reels, TikTok and LinkedIn" --dry-run
```

then the same without `--dry-run`.

## 4. The record

```
python scripts/post-pack/making.py b63d2507-dbb4-449d-bce4-f21e859ee2ad video long "Long cut, 16:9" "3 Video/Claude Duet - wide 16x9 - YouTube, Substack.mp4" --seconds LONG_SECONDS --thumb "3 Video/Claude Duet - wide 16x9 - thumbnail.jpg" --thumb-file WORK/thumbs/thumb-wide-1280x720.jpg --music no-curves-instrumental
python scripts/post-pack/making.py b63d2507-dbb4-449d-bce4-f21e859ee2ad video short "Short cut, 9:16" "3 Video/Claude Duet - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4" --seconds 77.75 --thumb "3 Video/Claude Duet - tall 9x16 - thumbnail.jpg" --thumb-file WORK/thumbs/thumb-tall-1080x1920.jpg --music no-curves-instrumental
python scripts/post-pack/making.py b63d2507-dbb4-449d-bce4-f21e859ee2ad show
```

`LONG_SECONDS` is the long cut's report `total_seconds` (`WORK/render/long/claude-duet-long.report.json`). Use the
paths `archive.py` printed if they differ from the names above.

## Rebuilding a cut

Titles or words changed: edit `docs/plans/2026-11-04-wednesday/post.json` `video_title` (the title beside his face in
the long cut), run `scripts/quick-edit/kit.py ... --cut long` again, then `video/configure.py long` and make.py.
Thumbnail words: edit `cover-facts.json` `thumbs.headline` and run
`python scripts/pages/build.py docs/plans/2026-11-04-wednesday/cover-facts.json --out WORK/thumbs --thumbs`.
Every render needs ffmpeg 8.1.2 on PATH (`.cache/tools/ffmpeg-n8.1.2-*-linux64*/bin` here; `. scripts/ve-env.sh` on a
home computer): the 6.1 build this container ships cannot read make.py's `-/filter_complex`.
