# Wednesday production, 21 October 2026

Piece `d7a20885-7001-4661-b444-9d7ca1043416`, under.the.hood.

The North Star contribution is a complete essay, short video and long video from Krish's recordings, with clear evidence graphics and a usable private review board. This folder preserves the exact recorded scripts and production inputs. It does not declare editorial or playback acceptance.

Krish approved the title and heading set after recording; see `packaging-approval.json`. PR #120 was confirmed merged at `620cdb3c5fc804ad24f4ba8fcf0307cadc89ef04` before this branch was created from main.

## Current review

The private Wednesday board is https://content.krishraja.com/board/2026-10-19#wednesday. Article, scorecard, covers, thumbnails and channel copy have been activated and read back. The editable Article draft and Publishing copy boxes retain the board's normal save and comment controls. Ideas, Monday and Friday were byte-identical after activation, and every original asset was kept.

Read `release-review.md` for the open decisions. One authorised fact-check run cost $0.50 and did not clear the gate. It remains preserved, with the claim list in `claim-review.md`. No rerun or public post is authorised. No prediction confidence or playback acceptance has been invented.

## Where the media is

Runtime production folder on this machine:
`C:\Users\krish\.scratch\wednesday-production-2026-10-21`.

Sources remain in the Video Engine recording store and original Inbox. The source hashes are:

- Long: `a6c0715fa5ce82e95d0a9e9aee98e55fdc27b38fa00151c368ed3200f238d9d0`.
- Short: `012c82c8efe059e5d88528ef321a3589dd225a53480a5146ca2180328db15cd4`.

The library destination is `3 Posts/2026-10-21 Wed under.the.hood - Muse vs Grok Bot`. Review video exports belong under `3 Video/Working - review` until their exact-byte validation receipts and playback acceptance pass. Working graphics, bookends, transcripts, cue clocks and checks are retained together in `production-working.zip`; no signed provider download URLs are included.

## Reproduction

Use the repository's Python environment with faster-whisper, Pillow and Playwright, plus ffmpeg. `MYMU_BROWSER=msedge` selects the installed browser on this machine. The render wrapper limits workstation encoder threads; it changes no playback speed.

1. Restore the exact source recordings and raw word JSONs from their recording and working archive records into a production folder.
2. Draw `cards.json` into its `cards` folder and `article-cards.json` into `article-cards` with `scripts/pages/video_card.py`. Keep their receipts separately because the drawer uses one default receipt filename.
3. Draw covers and thumbnails with `scripts/pages/build.py cover-facts.json --cover --thumbs`, and the approved bookends with `scripts/quick-edit/story_io.py`.
4. Run `prepare_page.py PRODUCTION_FOLDER`; use the resulting page facts with the house page builder. The article source remains in `../2026-10-19-week/wednesday-article-draft.md`.
5. Run `draw_scorecard.py PRODUCTION_FOLDER/takeaway`, then `scripts/pages/card.py` on its HTML at 1600x1500. It measures every word at phone width.
6. `prepare_video.py PRODUCTION_FOLDER` resolves cuts and unique spoken-word anchors; run the house kit for each generated cut profile, retaining the manual cues. The correct long config includes the `Ascender` transcription repair to `the sender`.
7. Render each cut with `render_video.py`. Measure the actual exports with `sync_check.py`, extract frame contact sheets with `frame_review.py`, retain the fresh heard-check differences and complete human playback review. A sampled frame check is not a claim of continuous listening.
8. `feed_board.py PRODUCTION_FOLDER --videos` supplies only native board inputs and a normal immutable asset map. It refuses changes to the other panels or loss of assets. Dry-run `board_web.py publish-web` and activate with the exact expected build. Read back actual HTML, every changed asset and all six stores for both weeks.
9. `stage_pack.py PRODUCTION_FOLDER --videos` builds an explicitly held review pack through the standard pack tool, without marking the piece made. Send it with the standard library sender and read the library receipt back.
