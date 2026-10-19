# Codex: fix and re-render Friday's two cuts (16 Oct, mind.the.gap)

**2 of 3.** It carries out the plan in file 1, `docs/plans/2026-10-09-friday/fix-plan-19-oct.md`. File 3,
`docs/handovers/2026-10-19-board-to-content-krishraja.md`, moves the publish board and can run at the same time in
another session.

Paste everything below the line into Codex on Krish's home computer, in `C:\Users\krish\dev\content-engine`, run
outside the sandbox (it needs the engine key, H: and the internet).

---

You are working in the Mindmake content engine repository (`krishanraja/content-engine`), at
`C:\Users\krish\dev\content-engine`. You have no other context; everything you need is named below.

## 0. Read first, in this order

1. `AGENTS.md` (rules for every agent) and `docs/NORTH_STAR.md`. Run `python scripts\check_failures.py` and read
   the entries in `config\failures.json` and `config\learnings.json` named `cut-called-done-unheard`,
   `lip-sync-drift-at-joins` and anything about music, captions or video.
2. `git pull --ff-only`. Set `$env:MAKING_BY = "Codex"`.
3. **The plan you are carrying out:** `docs\plans\2026-10-09-friday\fix-plan-19-oct.md`. Read all of it. It holds
   Krish's exact words, the measured faults, and every change. Then
   `docs\plans\2026-10-09-friday\90s-failures-19-oct.md` (what went wrong with the 90-second cut and why).
4. `.agents\skills\produce-video\SKILL.md` (how video is made here) and `docs\handovers\2026-10-19-friday-deep-cut-render.md`
   (the last deep-cut render, step by step: where the take, cards, music and story clips come from).

## 1. What the piece is

- Piece id `904658db-4df2-4537-a0ed-ebe93e081db7`, "Why so many AIs", mind.the.gap, Friday 16 Oct 2026.
- Two cuts, both already published to Krish's library and both rejected by him on 19 Oct:
  - **Deep cut**, 16:9, 13 min 41 s. Config `docs\plans\2026-10-09-friday\long-cut\long.json`, script
    `docs\plans\2026-10-09-script-deep-v6.md`. Faults: voice drifts ahead of his lips (0.68 s by the end); music
    silent between chapters; almost no car-analogy visuals; captions never heard-checked.
  - **90-second cut**, 9:16, sped 1.1×. Config `docs\plans\2026-10-09-friday\short-cut\short.json` (cards drawn by
    `short-cut\badge90.py`, logos in `docs\plans\2026-10-09-friday\logos\`). Faults: garbled captions, clipped words,
    visuals on only 44% of the talk, the badge card does not show Mercedes = Claude, C-Class = Opus 5.5.
- Work folder `W = .cache\produce\2026-10-16-904658db` (takes in `W\takes` and `W\takes90`, kit in `W\kit` and
  `W\kit90`, output in `W\long` and `W\short`).
- Takes: deep cut `python scripts\post-pack\recording.py get --sha256
  ee91ab41bc6ff0e25c2d7c2039c0bd55131ce7630110668c826e191605f0fd9f --out W\takes`; the 90-second take is the newest
  90-second take on the piece's making record (`python scripts\post-pack\making.py --help` shows how to read it),
  fetched the same way into `W\takes90`. Each file must be named exactly as its config's `source` says.
- Cards, panels and kit: `python scripts\post-pack\working.py fetch "2026-10-16 Fri mind.the.gap - Why so many AIs"
  --out W\working` (the working folders by date; later dates replace earlier files of the same name).
- Music: `python scripts\quick-edit\music.py fetch`; licensed tracks live only at `MINDMAKE_MUSIC_ROOT`, ledger
  `config\music-library.json`. The approved track `no-curves-instrumental` is never licence-checked again.

## 2. The work, in order (stop at each point marked KRISH)

1. **Lip sync** (plan section 0, item 5) in `scripts\quick-edit\make.py`: per-part sound padded and trimmed to the
   part's frame length; `aresample=async=1:first_pts=0` on the voice; the two blocking checks (gaps over 5 ms in
   `edited.mkv`, sync more than 40 ms off at six points). Add self-tests; `python scripts\quick-edit\make.py
   --self-test` must pass.
2. **Fresh words and the heard check** (plan section 0, items 1 to 3): transcribe each take on the clock it is cut
   on (faster-whisper, pinned per `requirements.lock.txt`), correct only spellings against the script; wider cut
   pads; after render, transcribe the finished file and refuse on any dropped or clipped word or caption that
   differs from what is heard.
3. **Deep cut music** (plan section 1): new `music_mode` `"episode_bed"` in `scripts\quick-edit\music.py` and
   `make.py`. KRISH: confirm the chapter-card level (−22 LUFS proposed) and the under-talk level (−31 approved, −33
   offered).
4. **Car visuals** (plan sections 1b and 2): one shared car drawing in `scripts\quick-edit\kit.py`. KRISH: approve
   the car drawing and the Mercedes = Claude / C-Class = Opus 5.5 mapping card before any beat is made. Then the
   ~14 deep-cut car beats and the 22 beats of the 90-second cut, cue pages on words (`"on"`), and the coverage gate
   (90% or more covered, no gap over 1.5 s, smallest text 48 px).
5. **Render** both cuts per `docs\handovers\2026-10-19-friday-deep-cut-render.md` steps 4 to 8 (the 90-second cut
   the same way with `short.json`, `--only 9x16`). Every check in the report must pass; the heard-check diff and
   the six sync points go in your reply.
6. **Review before calling it done:** a contact sheet at a frame a second, full width; read the heard-check diff in
   full. KRISH watches both cuts before anything is sent.
7. Only after his yes: `send.py` each cut into `3 Posts/2026-10-16 Fri mind.the.gap - Why so many AIs/3 Video`
   (new file names, never overwrite or delete the old ones) and record each with `making.py` (exact command in the
   deep-cut handover, step 10).

## 3. Rules that bite here

- Krish decides every taste choice; anything that sends, publishes, spends or deletes needs his yes immediately
  before it, for that action only. Never delete anything.
- No em dashes and no "Not X, Y" in any on-screen text; no number, quote or source that is not already filed; no
  bare scores (say what beat what, in plain words).
- Never commit media, credentials or job data. Commit code, configs and notes; run `npm run verify` before pushing;
  push to a branch and open a pull request, never straight to main.
- Before you stop: update `WORKBENCH.md` (what is done, what waits on Krish, where every file is), commit, push, and
  close the `lip-sync-drift-at-joins` and `cut-called-done-unheard` entries in `config\failures.json` only with
  their guards listed (`guards`), and only once the guards exist and pass.
- The publish board: do not touch it. It is moving to content.krishraja.com in a separate job
  (`docs/handovers/2026-10-19-board-to-content-krishraja.md`). When you stop, write in `WORKBENCH.md` the library
  path and Drive link of each new cut, so the board job (or whoever rebuilds the Friday tab, `fix-plan-19-oct.md`
  section 5) can pick them up.
