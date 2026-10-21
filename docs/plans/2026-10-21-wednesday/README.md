# Wednesday production, 21 October 2026

Piece `d7a20885-7001-4661-b444-9d7ca1043416`, under.the.hood.

The North Star contribution is a complete essay, short video and long video from Krish's recordings, with clear evidence graphics and a usable private review board. This folder preserves the exact recorded scripts and production inputs. It does not declare editorial or playback acceptance.

Krish approved the title and heading set after recording; see `packaging-approval.json`. PR #120 was confirmed merged at `620cdb3c5fc804ad24f4ba8fcf0307cadc89ef04` before this branch was created from main.

## Current review

The private Wednesday board is https://content.krishraja.com/board/2026-10-19#wednesday. Both review videos, captions, article, scorecard, covers, thumbnails, chapters and channel copy have been activated and independently read back. Build `15bbcc9b68fc0436b3747f683741faf499a3a096975e4caced1a1579593c5d95` has 46 assets: all 24 originals and 22 Wednesday assets. The editable Article draft and Publishing copy boxes retain the board's normal save and comment controls. Ideas, Monday and Friday were byte-identical; all six stores for both weeks were unchanged.

Read `release-review.md` for the open decisions. One authorised fact-check run cost $0.50 and did not clear the gate. It remains preserved, with the claim list in `claim-review.md`. No rerun or public post is authorised. No prediction confidence or playback acceptance has been invented.

## Where the media is

Runtime production folder on this machine:
`C:\Users\krish\.scratch\wednesday-production-2026-10-21`.

Sources remain in the Video Engine recording store and original Inbox. The source hashes are:

- Long: `a6c0715fa5ce82e95d0a9e9aee98e55fdc27b38fa00151c368ed3200f238d9d0`.
- Short: `012c82c8efe059e5d88528ef321a3589dd225a53480a5146ca2180328db15cd4`.

The library destination is `3 Posts/2026-10-21 Wed under.the.hood - Muse vs Grok Bot`. Review video exports belong under `3 Video/Working - review` until their exact-byte validation receipts and playback acceptance pass. Working graphics, bookends, transcripts, cue clocks and checks are retained together in `production-working.zip`; no signed provider download URLs are included.

The 27 article/graphics/copy files and seven held working files were sent and independently downloaded back from the library. All 34 newest file hashes and sizes match. `production-readback.json` preserves that evidence alongside the live board and both final six-window sync measurements. This confirms the engine library, rather than claiming that a particular Drive runner has already written every file.

## Reproduction

Use the repository's Python environment with faster-whisper, Pillow and Playwright, plus ffmpeg. `MYMU_BROWSER=msedge` selects the installed browser on this machine. The render wrapper limits workstation encoder threads; it changes no playback speed.

1. Restore the exact source recordings and raw word JSONs from their recording and working archive records into a production folder.
2. Draw `cards.json` into its `cards` folder and `article-cards.json` into `article-cards` with `scripts/pages/video_card.py`. Keep their receipts separately because the drawer uses one default receipt filename.
3. Draw covers and thumbnails with `scripts/pages/build.py cover-facts.json --cover --thumbs`, and the approved bookends with `scripts/quick-edit/story_io.py`.
4. Run `prepare_page.py PRODUCTION_FOLDER`; use the resulting page facts with the house page builder. The article source remains in `../2026-10-19-week/wednesday-article-draft.md`.
5. Run `draw_scorecard.py PRODUCTION_FOLDER/takeaway`, then `scripts/pages/card.py` on its HTML at 1600x1500. It measures every word at phone width.
6. `prepare_video.py PRODUCTION_FOLDER` resolves cuts and unique spoken-word anchors; run the house kit for each generated cut profile, retaining the manual cues. The correct long config includes the `Ascender` transcription repair to `the sender`.
7. Render each cut with `render_video.py`. Finish the long cut with `finish_long_music.py PRODUCTION_FOLDER`: it uses the approved house continuous chapter bed, preserves the first visual render and proves the compressed picture stream unchanged. The final long folder is `render-long-music`, not the earlier voice-only render. Measure the actual exports with `sync_check.py`, extract frame contact sheets with `frame_review.py`, then run `finish_receipts.py PRODUCTION_FOLDER --heard` to retain fresh heard-check differences. Run it again without `--heard` once final sync reports land. Complete human playback review; a sampled frame check is not continuous listening.
8. `feed_board.py PRODUCTION_FOLDER --videos` supplies only native board inputs and a normal immutable asset map. It refuses changes to the other panels or loss of assets. Dry-run `board_web.py publish-web` and activate with the exact expected build. Read back actual HTML, every changed asset and all six stores for both weeks.
9. `stage_pack.py PRODUCTION_FOLDER --videos` builds the article/graphics pack and a separate held `review-media` folder, without marking the piece made. The pack builder makes flat filenames: its `name` field cannot create a Working directory. Send the pack with the standard library sender; send `review-media` with the same sender's `--as` and `--purpose` arguments from `review-library-plan.json`. This retains the native `3 Video/Working - review` lane and all failed receipts. Read both groups' library hashes back.
