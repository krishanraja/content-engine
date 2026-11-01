# Filing the four rebuilt cuts (2 and 4 November) on a home computer

Krish approved all four on 1 November 2026, in his words: "Approved, file them and put them on the boards".

Done in the cloud session (1 Nov):
- On the 2 Nov publish board (build `f8a4d486…`): the four cuts were uploaded to the board as assets, with the shas checked on readback, and both days' materials are set to ready.
- The archive folders, named by `scripts/quick-edit/archive.py`, were built in that session's `.cache/archive`.

Not done, because the delivery gate needs checks this cloud session cannot run (SyncNet for `sync`):
- each cut's `.validation.json` receipt;
- the send to the post's library folder (`send.py`);
- the archive on Drive;
- `making.py video` on each record.

`send.py` refuses a video without a passing receipt, and so does `making.py video --video-file`.

## The files

Download each from the board's Finished videos rows. The full-size files sit behind the board assets: content.krishraja.com/board/2026-11-02, Monday and Wednesday, "Download the 5-minute video" and "Download the 90-second video".

| Cut | sha256 | Length |
|---|---|---|
| Mon long 16:9 | `bb83752650778d7177da436d8f980bb3f5a9477a66d1932f025b93c15d0a037c` | 293.47 s |
| Mon short 9:16 | `ad4c916883521f431c306d2699a502f2617dc83dc01f3d0199040c6e279870f6` | 71.7 s |
| Wed long 16:9 | `5dbd52f3efb673f41e7934b7a1d616137c0b9d199a1ba06583cd9b684bc8eeaa` | 289.7 s |
| Wed short 9:16 | `4cc08b7afaae3ef7cc957df11397824521538b83abb6f9016c71376c504c4302` | 80.8 s |

The cuts were built by the scripts under `docs/plans/2026-11-02-monday/rebuild/` and `docs/plans/2026-11-04-wednesday/rebuild/`. Each take plays continuously with no joins, so the joins gate has nothing to join.

## Steps, from the repository root, with `MAKING_BY="Claude Code"` and `. scripts/ve-env.sh`

1. Receipts. For each file, build `<file>.validation.json` as `.agents/skills/produce-video/SKILL.md` and Monday 26's `video/CODEX_FINISH.md` step 4 describe:
   - `full_review`: Krish's words above, dated 2026-11-01.
   - `heard`: from `scripts/quick-edit/words_gate.py`.
   - `loudness`: measured on the file.
   - `visuals`: the visual gate.
   - `motion`: from the stabilised takes `.cache/produce/<piece>/takes/*-stable.mp4`.
   - `visual_clarity`.
   - `sync`: `scripts/quick-edit/sync_check.py`.

   If a check fails, stop and report it; never write a pass that was not measured.
2. Archive: run `scripts/quick-edit/archive.py`, exactly as in `docs/plans/2026-11-02-monday/video/FILE.md` step 2 and `docs/plans/2026-11-04-wednesday/video/FILE.md` step 1, but on the four rebuilt files and the picked thumbnails:
   - Mon: `.cache/produce/2026-11-02-9a0c97af/thumbs/thumb-16x9.jpg` and `thumb-9x16.jpg`.
   - Wed: `.cache/produce/2026-11-04-b63d2507/thumbs/thumb-wide-1280x720.jpg` and `thumb-tall-1080x1920.jpg`.
3. Library: `send.py "ARCHIVE FOLDER" --as "3 Posts/<pack folder>/3 Video" --purpose "The finished videos and their thumbnails: wide 16:9 for YouTube and Substack, tall 9:16 for Shorts, Reels, TikTok and LinkedIn"`, dry run first. The pack folders are:
   - `2026-11-02 Mon follow.the.money - Who trains your 2030 seniors`
   - `2026-11-04 Wed under.the.hood - Claude Duet`
4. Record: `making.py <piece> video long|short ... --video-file <file> --seconds <length above> --music no-curves-instrumental`, with the paths and thumbnails named in each day's `video/FILE.md` step 4. Then `making.py <piece> show`.

Readback: `making.py <piece> show` lists both Video assets as done for each piece.
