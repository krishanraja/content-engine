> **Historical.** Archived 2026-10-29 by the docs steward. Not current guidance.
> Replaced by: `WORKBENCH.md` and `docs/ve/STATUS.md`
> Reason: moved from WORKBENCH.md on 2026-10-28 to keep it within its size limit; Friday 23 was later rebuilt on ve.

# Moved from WORKBENCH.md on 28 October 2026

## 24 October: Friday locked and signed off; Codex makes the videos (Claude)

- **Signed off by Krish:** storyboard, no trim, titles, outline ("signed off, keep, all A"), prediction A2 ("a2"), and
  the six first-person test lines in the fact gate ("yes, $0.30, and I sign off my test lines"). Spend: $1.09 of the
  $1.30 he approved.
- **Done:** the article (`docs/plans/2026-10-23-draft-body.md`, on the piece; fact gate `ok`, voice, AI scan and spine
  checks pass) and every channel's copy (`docs/plans/2026-10-23-friday/locked/board-copy/`: `article.md`,
  `publishing-copy.md`; voice score 4.5, bar 6). The board shows the signed storyboards (revision 50).
- **Waiting on Krish:** start Codex by pasting `docs/plans/2026-10-23-friday/locked/CODEX_PROMPT.md` (the part below
  the line) into a new Codex session on a home computer. Then his look at the four videos on the board, then his yes
  to the final board publish.
- **Changed after sign-off (his answers, 24 Oct):** the 90-second on-camera cut loses the recap and three small repeats
  ("Cut the recap (Recommended)"), and both vertical cuts are sped to 1.12x ("Speed both to 1.12x (Recommended)") so the
  whole file with intro and outro runs under 89 s. His warning, "last time Codex glitched a bunch of words on the
  speedup and also misaligned the captions", is `config/learnings.json` `speedup-without-glitches` and the
  "Speed without glitches" section of `CODEX.md`.
- **Making record completed by Claude (24 Oct, after Codex stopped on it):** Visual gate (cover and thumbnails drawn
  from his picked words, gate passed), Scripts with both read-backs (two fresh readers each, nothing lost) and Pack
  (sent to the Two passports library folder) are recorded; every step up to Recorded reads done. `scripts/pages/build.py`
  now tries the smaller headline sizes on its ladder before refusing a 3:2 cover.
- **Codex** works from `locked/CODEX.md` and nothing else; it fills only the chapter times in `publishing-copy.md`.
- **Where things are:** takes in the engine's recordings store (`recording.py list`); evidence captures under
  `2 Covers and images/Evidence` and the storyboards under `2 Covers and images/Storyboard` in the post's library
  folder. The Anthropic and GitHub reference clip (Video Engine > Inspiration) had still not reached the library;
  Codex fetches it first (`motion-system.md`).

