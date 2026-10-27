# Codex: finish Monday 26 Oct's two cuts (hand-over from Claude Code, 27 Oct)

Work in `C:\Users\krish\dev\mindmake\content-engine-monday26` (branch `claude/monday26-captions`). Never edit the main
checkout. Read `AGENTS.md`, `.agents/skills/produce-video/SKILL.md`, then `docs/plans/2026-10-26-monday/video/REVIEW.md`
(the review packet) and the hand-over note
`C:\Users\krish\AppData\Roaming\Claude\side-session-notes\local_4378fe90-63a4-4e63-81d9-db659b6936c6\monday26-cuts-handover.md`.

Tools: Python `C:\Users\krish\dev\mindmake\content-engine\.venv\Scripts\python.exe`; ffmpeg on PATH from
`.cache\tools\ffmpeg-n8.1.2-53-g1005b294ff-win64-gpl-8.1\bin`; `PYTHONUTF8=1`, `MAKING_BY=Codex`. Work folder
`.cache\produce\2026-10-26-b358e788\`.

State: both cuts are rendered on kit.py -> make.py with burned house captions (Krish's ruling, 27 Oct; direction
re-signed). The last render fixed lip sync in the engine (`make.py`: frame-aligned windows, voice-chain latency).
A SyncNet run was in progress: `review\sync-long\sync-report.json` and `review\sync-short\sync-report.json`.

Do, in order:
1. Confirm both SyncNet reports pass (every window within +-40 ms, calibrated). If not, say so and stop.
2. Re-check the loudness on the final encodes (`review.py long|short --no-heard`): -14 +-1 LUFS, true peak <= -1 dBTP.
   Put the numbers into REVIEW.md's table (replace SYNC_LONG / SYNC_SHORT).
3. Give Krish REVIEW.md and both share copies (`long\share\`, `short\share\`). Ask him for (a) acceptance on full
   playback, (b) his ruling on the visual-clarity word budget (REVIEW.md, "Two decisions"). Never publish, send or
   schedule anything; never invent his words.
4. Only after his acceptance: build each `<video>.validation.json` (heard, sync, loudness, visuals, full_review with his
   words, motion from `motion\*-stabilised.json`, visual_clarity per his ruling via `video\manifest.py` and an
   independent blinded review), then `archive.py`, then `send.py` (dry run first) to the post's `3 Video` folder, then
   `making.py ... video long|short`. Never file under a `working*` folder.
5. `npm run verify`, push, open a PR with auto-merge. Update `WORKBENCH.md` (the 27 Oct Monday entry) with Codex's
   wall clock and token use; that is the second baseline for the `ve` engine.
