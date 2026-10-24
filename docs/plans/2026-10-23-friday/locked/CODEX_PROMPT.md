# Prompt to start Codex on Friday's videos

Paste everything below the line into a new Codex session on one of Krish's Windows home computers.
Written by Claude, 24 October 2026.

---

You are making the four videos for Krish's Friday 23 October piece, "Why every country wants its own AI"
(mind.the.gap, piece `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23`), in the repository krishanraja/content-engine.

**First, get the current state.** Run `git pull origin main` outside the sandbox (ask Krish to approve; the sandbox
cannot reach the internet or see the engine key). Then read, in this order and nothing else to start:
1. `AGENTS.md` (the rules), then `python scripts/check_failures.py`.
2. `docs/plans/2026-10-23-friday/locked/CODEX.md`: your brief. Everything you need is there and in the files it names.
3. The rest of that `locked/` folder as the brief directs: the four `script-*.md`, `timings.json`, `visual-copy.json`,
   `assets.json`, `motion-system.md`, `storyboard-signoff.md`, `titles.json`, `board-copy/`.

**What is already settled, so do not reopen it.** Claude wrote and locked every word, every on-screen label, the
motion style ("Border Control") and the storyboard, and Krish signed them off on 24 October ("signed off, keep, all
A"). The article and channel copy are final. Your job is production only: you make, you never write. If a beat cannot
be built from the locked files, stop and write it in `WORKBENCH.md` for Claude; never improvise a word, a number, a
label or a picture, and never drop a beat silently.

**The four videos:** a 5-minute voiceover (16:9, pictures only), a 5-minute on-camera cut (16:9, his portrait selfie
in a panel left, the pictures right), a 90-second voiceover (9:16, pictures only) and a 90-second on-camera cut (9:16).
The takes come from `python scripts/post-pack/recording.py get "<file>"` (file names in `CODEX.md`). Make the work
through `.agents/skills/produce-video` and the tools it names (sting, licensed music, thumbnails, filing, the making
record).

**The two things that went wrong last time, and must not happen again:**
- Chopped words. Wednesday's published video had random small cuts and chopped words; a Friday short was called 10/10
  and Krish rated it "about a 3/10". Every cut goes in the silence between words, with a short crossfade. Before
  anyone sees a video, transcribe the finished file and check every word of the script is there, in order, and
  listen to every join at full volume.
- The speed-up. Both vertical cuts are sped to 1.12x (Krish's words are in the scripts). Krish: "last time Codex
  glitched a bunch of words on the speedup and also misaligned the captions". Follow `CODEX.md`, "Speed without
  glitches", exactly: speed once, as one continuous file, through the config's `"speed"`; transcribe the sped file
  fresh and cut on that transcript; no captions burned into the picture; the caption file comes only from the
  finished file's own transcript; check lip sync at start, middle and end.

**The bar.** Krish wants these "in a world-class capacity that I'm not going to need to iterate for 30 hours".
Study the reference clip first (step 0 in `CODEX.md`). Every move lands on the word that names it. Watch every video
yourself, at full size, with sound, start to finish, against its script and the signed storyboard, and fix anything
before he sees it. A contact sheet, a loudness number or a passing script is not watching.

**When you are done:** put the four videos on the Friday board as materials marked `review`, with one line each on
what you checked (`CODEX.md`, "How to show Krish"). Do not publish anything publicly; the final board publish waits
on Krish's yes. Commit your work on a branch, run `npm run verify`, push, open a pull request. Update `WORKBENCH.md`
with where every file is and anything you could not do, with the smallest change that would fix it. Then tell Krish
in plain words, no project shorthand, what is ready to watch and where.
