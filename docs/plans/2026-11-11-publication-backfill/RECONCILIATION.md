# Publication backfill: videos and thumbnails (11 November 2026)

Krish, 11 Nov 2026: "Session is no longer handling anything so you will need to do the historical backfill as well."

## What was actually broken (each one tested, not assumed)

| Fault | Evidence | Fix |
|---|---|---|
| The newest cards had no thumbnail | Since 24 Oct every piece goes out as a Substack video post, whose RSS enclosure is `audio/mpeg`; `apps/cover/lib/rss.ts` took a cover only from an `image/*` enclosure | The site reads covers from Substack's archive API, which holds one for every post (makeyourmindup#39) |
| No piece knew its YouTube video | 0 of 10 pieces published from 5 Oct held a YouTube address; Growth's receipts cover Shorts and Reels (Buffer), and Krish uploads the full cut himself, so nothing recorded it | The hourly publish watcher reads the channel's uploads feed (content-engine#517); this backfill covers the history |
| The Substack watcher had read nothing since about 6 Nov | Its runs report `ok` with `posts: 0` every hour from 6 Nov; the archive API now answers `{posts, nextCursor}`, not a bare list | `readPosts` reads both shapes and any other shape fails the run (content-engine#517) |
| A failed feed showed an empty newsstand | `latestPosts` returned `[]` on any failure, which drew the "nothing yet" state | No source answering now throws, so the last good page keeps serving |
| "A YouTube feed 404 causes every missing video" | Not the cause. The channel is `@makeyourmind-up` (`UCvxmp6eKUqrjGGbCGl7f9-A`); its feed answers 200. `@makeyourmindup` (no hyphen) is a 404, and no code in content-engine, makeyourmindup or control-center reads either | Nothing to fix; the watcher uses the channel id |

## Inventory (complete, not a feed window)

- **Substack:** 49 posts, read through every page of the archive API. 18 since the relaunch, 31 before it. All 49 hold a cover except 8 posts from 2025 that have none: they are before the relaunch date and never shown on the site.
- **YouTube:** 18 uploads. The channel's uploads playlist says 18, and its Videos and Shorts tabs list the same 18: 11 full videos and 7 Shorts.
- **Engine pieces:** 12 since 5 Oct. 10 are published; the 9 Nov piece went out on Substack but was never marked published (the watcher fault above); the 11 Nov piece is not out yet.

## Result

| | Count |
|---|---|
| Uploads associated with a piece, with evidence (`backfill.json`) | 16 (11 full videos, 5 Shorts) |
| of which already recorded by Growth's receipts | 2 |
| written by this backfill | 14 |
| Intentional exception: the launch Short, no engine piece | 1 (`ADOA0DutbQg`) |
| Intentional exception: the Tuesday 3 Nov off-day meme, no piece (Krish, 11 Nov: "a tuesday off day where we post a funny meme") | 1 (`gJr6lwb-myE`) |
| Unresolved | 0 |
| Pieces with their full video after the backfill | 11 of 11 out |
| Pieces with their Short | 5 of 11 (the other 6 had no Short on the channel) |

The 20 Oct pair, two full videos on one day, was the only real ambiguity. It is settled by Substack's own video posts: each carries the same title as its YouTube upload, and each one's text opens with its own article (one on model names, one on prices). No association rests on a fuzzy title match alone; `backfill.json` gives each one its evidence.

## How it was run

- `node backfill.mjs` (dry run) printed 14 to write, 2 already recorded, 0 conflicts.
- `--apply` writes only an empty slot, so a second run changes nothing. Applied on 11 Nov with Krish's yes. The first apply changed nothing: the table's guard (`content_ideas_keep_newer_making`) keeps a making record unless the incoming one is newer, so the script now stamps `making.updated_at` like every engine write and reads every slot back. Readback: 16 of 16 on their pieces; a second run writes nothing.
- Covers need no backfill: the site reads each post's own cover from Substack every 15 minutes, history included.
