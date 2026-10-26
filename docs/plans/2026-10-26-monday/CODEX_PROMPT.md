# Prompt to start Codex on Monday's videos

Paste everything below the line into a new Codex session on one of Krish's Windows home computers. Written by Claude,
26 October 2026.

---

You are making the two videos for Krish's Monday 26 October piece, "Why is Disney eating the scraps of bankrupt
Character.AI?" (follow.the.money, piece `b358e788-209f-427b-a84d-1f79a8ebb430`), in the repository
krishanraja/content-engine.

**First, get the current state.** Run `git pull origin main` outside the sandbox (ask Krish to approve; the sandbox
cannot reach the internet or see the engine key). Then read, in this order and nothing else to start:
1. `AGENTS.md`, then `python scripts/check_failures.py`.
2. `docs/plans/2026-10-26-monday/CODEX.md`: your brief. Everything you need is there and in the files it names.

**What is settled, so do not reopen it.** Claude wrote every word, the storyboard and the motion system ("Receipts"),
and Krish signed them on 26 October ("Yes to all four, recommended title"). Your job is production only: you make,
you never write. If a beat cannot be built from the files, stop and write it in `WORKBENCH.md` for Claude.

**The two videos:** a 5-minute on-camera cut (16:9, his portrait panel left, the pictures right) and a 90-second
on-camera cut (9:16). Both takes are on the piece's record; fetch them with `python scripts/post-pack/recording.py get
"recordings/<sha256>.mp4"` (the names are in `CODEX.md`).

**Krish's rule for his takes:** "That's just how I talk." Keep every word he said. The only cut is "which is fair
enough" in the 5-minute take, and only if it cuts cleanly in the silence between words; otherwise keep it.

**The bar.** No chopped words, no joins you can hear, every receipt line printing on the word that names it. Watch both
videos yourself at full size with sound, start to finish, against the signed storyboard, and have a reviewer who did
not make them do the same. The automated media reviewer is not qualified (it invented speech in silent files), so it
never stands in for that.

**When you are done:** both videos on Monday's tab of the week's board as materials marked `review`, with one line each
on what you checked (`CODEX.md`, "How to show Krish"). Nothing public. Commit on a branch, `npm run verify`, push, open a
pull request, update `WORKBENCH.md`, and tell Krish in plain words what is ready to watch and where.
