> **Historical (moved from WORKBENCH.md on 2026-10-24, G11).** Superseded by "24 October: Friday locked and signed off".

## 23 October, afternoon: Friday test scored, both scripts filled, on the board for Krish's review (Claude)

- **Test results:** `docs/plans/2026-10-23-friday/test-results/` (`answers.md`, `coding.md`, the pre-registered
  `predictions-and-checklist.md`, and `scores.md`, scored against `test-design.md`). DeepSeek wrote a full Xinjiang
  answer and deleted it, 3 of 3 runs, while answering Turkmenistan 3 of 3; Claude and ChatGPT answered both alike.
  Taiwan vs Singapore: a draw for all three. The 47 screenshots went to the library with `send.py`
  ("3 Posts/2026-10-23 Fri mind.the.gap - Two passports/2 Covers and images/AI test screenshots"), not git.
- **Scripts:** the gaps are filled from the scores. Krish's calls in this session (one question at a time): the
  call beat now reads "A Chinese AI is fine if you don't mind where your data ends up. But check what it tells you."
  (both cuts), and the short cut drops the "take DeepSeek out of China" joke to explain the test (the joke stays in
  the long cut). Both pass `story_check.py` (long 824 words, warns about 5:33 as he says it; short 195).
- **Readers:** two rounds of A, B and C on each cut. Round two: every retelling matches the point; small items left
  (Stanford's "three percent" on what, "two times in three" by ear, the call beat still read as mixed by five of
  six). Not yet recorded as read back; Krish chose to review on the board instead of signing off here.
- **Board:** published to https://content.krishraja.com/board/2026-10-19#friday (build `baa95ed9`, revision 48,
  served page hash read back equal; Ideas, Monday and Wednesday panels unchanged). The feeder now maps Wednesday's
  Drive downloads like Monday's and reads through `BOARD_BASE_URL` in a cloud session.
- **Creative direction (23 Oct, evening):** `docs/plans/2026-10-23-friday/creative-direction.md` is the brief Codex produces both cuts from: the 90-second cut voice only, the 5-minute mixed, every line paired with the picture that proves it. Order: he records, takes lined up, **storyboard to Krish for sign-off**, then render. Krish: "Once I've recorded show me your creative storyboard before I sign that off."
- **Teleprompter (23 Oct, 22:18 UTC, Krish: "Yes. Send it"):** both lengths are in his Teleprompter folder "Fri 23 Oct
  mind.the.gap - Two passports", one script per length holding both takes (`script-long-both-takes.md`,
  `script-short-both-takes.md`). Sent by hand on his word, **not through `teleprompter_send.py plan`**: the making record
  has no scripts yet because the outline is not approved and the spine judge has not run (no article draft), and those
  gates were not bypassed. So the record holds no Teleprompter ids and the recordings lane will not stamp these takes:
  line each take up with `narration_diff.py` against its own take's words. The engine now checks two-take scripts
  (`story_check.takes`) for the next piece.
- **Handover (24 Oct, videos recorded):** `docs/handovers/2026-10-24-friday-lock-for-codex.md`: Claude locks scripts, visual copy, article and board copy; Codex produces the videos and the final board.
- **Handover:** `docs/handovers/2026-10-23-friday-production.md` (start the next session from it).
- **Next:** read his comments on the Friday tab (`board_web.py read`), change the words he asks for, re-run
  `story_check.py` and fresh readers, then `making.py <piece> scripts long.md short.md` (outline and spine judge
  first, `docs/plans/2026-10-23-outline.md`), `read-back` (his words if he signs off), and `teleprompter_send.py
  plan` plus the Teleprompter calls. Teleprompter does not hold the new words yet.

The 22 October Friday story work (choosing the two-passports story with Krish) is archived in
`docs/history/2026-10-23-workbench-friday-22oct.md`.
