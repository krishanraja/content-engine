# Wednesday production, 21 October 2026

Piece `d7a20885-7001-4661-b444-9d7ca1043416`, under.the.hood.

The North Star contribution is a complete essay, short video and long video from Krish's recordings, with clear evidence graphics and a usable private review board. This folder preserves the exact recorded scripts and production inputs. It does not declare editorial or playback acceptance.

Krish approved the title and heading set after recording; see `packaging-approval.json`. PR #120 was confirmed merged at `620cdb3c5fc804ad24f4ba8fcf0307cadc89ef04` before this branch was created from main.

## Current review

22 October finishing pass: the revised article has 422 personal-test evidence words and 423 corpus evidence words. The final authorised check cost $0.59. Krish approved all 27 named flagged sentences against their evidence; four native manual reviews and 23 sign-offs clear the fact gate while retaining the raw model verdicts. The exact-body retrospective exception merged in PR #134 after all 15 checks passed (main `6bfad15`). No further paid run is authorised.

Both stabilised exports are complete. Background-motion RMS fell 67.7% for long and 51.5% for short. Both have six calibrated sync windows passing within 40 ms and decoded audio identical to the accepted mixes. Every one-second frame and quarter-second bookend sample was inspected; all camera transforms pass geometry checks. Continuous phone playback acceptance remains open; raw recognizer differences remain recorded. See `stabilisation-review.md` and `release-review.md`.

The private Wednesday board is https://content.krishraja.com/board/2026-10-19#wednesday. The editable Article draft and Publishing copy boxes retain the normal save and comment controls. Native board updates preserve every prior asset, unrelated panel and feedback collection. Fresh exact-byte readbacks accompany the stabilised activation. `production-readback.json` is explicitly historical evidence for the earlier exports; it does not certify the replacements.

Nothing has been publicly posted. No prediction confidence or playback acceptance has been invented.

## Where the media is

Runtime production folder on this machine:
`C:\Users\krish\.scratch\wednesday-production-2026-10-21`.

Sources remain in the Video Engine recording store and original Inbox. The source hashes are:

- Long: `a6c0715fa5ce82e95d0a9e9aee98e55fdc27b38fa00151c368ed3200f238d9d0`.
- Short: `012c82c8efe059e5d88528ef321a3589dd225a53480a5146ca2180328db15cd4`.

The library destination is `3 Posts/2026-10-21 Wed under.the.hood - Muse vs Grok Bot`. Review video exports belong under `3 Video/Working - review` until their exact-byte validation receipts and playback acceptance pass. Working graphics, bookends, transcripts, cue clocks and checks are retained together in `production-working.zip`; no signed provider download URLs are included.

The stabilised refresh contains 32 article/graphics/copy records and seven held working files. All 39 actual newest library downloads match their hashes and sizes; `stabilised-readback.json` records them with the new board and technical evidence. `production-readback.json` remains the historical 35-file proof for the prior exports. This confirms the engine library, rather than claiming that a particular Drive runner has already written every file.

## Reproduction

Use the repository's Python environment with faster-whisper, Pillow and Playwright, plus ffmpeg. `MYMU_BROWSER=msedge` selects the installed browser on this machine. The render wrapper limits workstation encoder threads; it changes no playback speed.

1. Restore the exact source recordings and raw word JSONs from their recording and working archive records into a production folder.
2. Draw `cards.json` into its `cards` folder and `article-cards.json` into `article-cards` with `scripts/pages/video_card.py`. Keep their receipts separately because the drawer uses one default receipt filename.
3. Draw covers and thumbnails with `scripts/pages/build.py cover-facts.json --cover --thumbs`, and the approved bookends with `scripts/quick-edit/story_io.py`.
4. Run `prepare_page.py PRODUCTION_FOLDER`; use the resulting page facts with the house page builder. The article source remains in `../2026-10-19-week/wednesday-article-draft.md`.
5. Run `draw_scorecard.py PRODUCTION_FOLDER/takeaway`, then `scripts/pages/card.py` on its HTML at 1600x1780. It measures every word at phone width.
6. `prepare_video.py PRODUCTION_FOLDER` resolves cuts and unique spoken-word anchors; run the house kit for each generated cut profile, retaining the manual cues. The correct long config includes the `Ascender` transcription repair to `the sender`.
7. The first exports used `render_video.py`, followed by `finish_long_music.py PRODUCTION_FOLDER` for the long music mix. Krish accepted their phone sync but rejected the opening, logo sizes and portrait framing. For the 22 October picture revision, draw the updated bookends in `story-revised` and graphics in `cards-revised`. Run `render_visual_revision.py PRODUCTION_FOLDER CUT --prepare`, then `--preview`, then without either flag for each cut. This calls the native house compositor, preserves manual cue timing and copies the accepted audio, asserting identical decoded samples. Current folders are `render-long-revised` and `render-short-revised`. Measure those exact exports with `sync_check.py` into `sync-CUT-final-revised`, and sample them with `frame_review.py` into `review-CUT-revised`. Inspect every contact sheet; run `check_face_framing.py` on the portrait sampler and `finish_receipts.py PRODUCTION_FOLDER` without `--heard`. Raw prior transcript differences travel with the identical-audio derivation; they are not a fresh ASR pass. Human continuous playback acceptance of the revised pictures remains open.
8. `feed_board.py PRODUCTION_FOLDER --videos --stable` supplies only native board inputs and a normal immutable asset map. It refuses changes to the other panels or loss of assets. Dry-run `board_web.py publish-web` and activate with the exact expected build. Read back actual HTML, every changed asset and all six stores for both weeks.
9. `stage_pack.py PRODUCTION_FOLDER --videos --stable` builds the article/graphics pack and a separate held `review-media` folder, without marking the piece made. The pack builder makes flat filenames: its `name` field cannot create a Working directory. Send the pack with the standard library sender; send `review-media` with the same sender's `--as` and `--purpose` arguments from `review-library-plan.json`. This retains the native `3 Video/Working - review` lane and all failed receipts. Read both groups' library hashes back.

For stabilised reproduction, assess and treat the camera with `scripts/quick-edit/wall_stabilize.py`, preserving the saved path checkpoint and frame count. Use `render_stable.py PRODUCTION_FOLDER CUT --prepare`, then render through the native compositor. Measure camera samples with the sequential-frame verifier, check all transforms with `verify_camera_geometry.py`, run fresh exact-export sync and frame review, then `finish_receipts.py PRODUCTION_FOLDER --stable` only after inspecting every contact sheet. A human playback decision must bind to the exact board export; `record_playback_acceptance.py` records that explicit decision while retaining raw recognizer results. Original recordings remain unchanged.

`prepare_publish.py PRODUCTION_FOLDER` prepares the native publish-manager page without declaring readiness. After live article checks and the exact video receipts pass, `feed_board.py PRODUCTION_FOLDER --videos --stable --ready-page PRODUCTION_FOLDER/publish/publish-manager.html` feeds that page through the normal board builder, retaining all editable review boxes. The adapter refuses activation while either gate remains held.
