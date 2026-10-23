# Handover: Friday 23 October, mind.the.gap (sovereign AI), from the test results to Teleprompter

Written 23 October by the session that took the piece from Krish's angle to two checked scripts (its context passed
500k tokens, guard G1). Branch `ccr-b67ca85c-yxrn71`, everything pushed. Start a fresh session from this file.

## Start the new session with

> Pick up the Friday handover, docs/handovers/2026-10-23-friday-sovereign-ai.md. Here are the test results
> (answers.md and the screenshots). Score them against the test design, fill the gaps in both scripts, run the
> readers and get both into Teleprompter before I record this afternoon.

Everything here is on main once the pull request for branch `ccr-b67ca85c-yxrn71` has merged (it merges itself
when CI passes). If it has not merged yet, `git fetch origin ccr-b67ca85c-yxrn71 && git checkout ccr-b67ca85c-yxrn71`.

## What this session settled with him (do not ask again)

Story A (two passports) on his hook; three named examples (Airbnb, Cursor, Lindy); the countries part as it is
("No, I agree with this"); his view as the call beat; the jokes he marked; "having a proper look at"; his line marks;
no choppy rhythm; the matched-pair test with every setting matched and ChatGPT in it. Standing rules from it:
learnings `script-is-the-bottleneck`, `one-question-at-a-time`, `no-choppy-rhythm`, `tests-are-experiments`,
`wit-he-marked`, `his-call-in-his-words` (config/learnings.json). Ask him only what is still open below, one
question at a time.

## Where it stands

- Piece `7083d6ad-419e-4fdc-9aba-f3be7f3f3a23`. Narrative **signed** (`docs/plans/2026-10-19-week/narrative-fri.md`);
  his words throughout in `docs/plans/2026-10-23-friday/story.md`. Research: `research-sovereign-ai-corpus.md` (his)
  and `research-gaps.md` (read at source) in the same folder.
- Scripts: `docs/plans/2026-10-23-draft-script.md` (5-minute) and `docs/plans/2026-10-23-draft-script-90s.md`.
  Every line worked with Krish one question at a time: his hook, his view (the "my call" beat and "keep a second AI
  ready"), his jokes (Korea "Awkward", Grok "keep the boss happy", the holiday fling, "You can take DeepSeek out of
  China. But you can't take China out of DeepSeek."), his opening ("having a proper look at"), re-joined after "the
  choppy rhythm, sounds robotic". Both pass `story_check.py` with stand-in test lines. **The test gaps are marked
  `TEST RESULT A`, `TEST RESULT B`, `WHAT THE TEST SHOWS` (long) and `TEST RESULT,` (short).**
- The test: `docs/plans/2026-10-23-friday/test-design.md` (thesis, hypothesis, matched pairs, what is read from each
  answer, written before the run) and `cowork-test-prompt.md` (Krish runs it in Cowork in his own browser). Waiting
  on his go for the four prompts and on `answers.md` plus screenshots from `~/Desktop/friday-ai-test`.
- He records **this afternoon** (23 Oct). Titles and thumbnail words only after he records.

## Next, in order

1. When `answers.md` arrives: save it and the screenshots under `docs/plans/2026-10-23-friday/test-results/`
   (screenshots to the post's library folder with `send.py`, not git). Score each of the twelve answers against the
   items in `test-design.md`, in a table, before writing a word of script.
2. Fill the gaps from the scores only: plain win, lose or draw words, the result not the method, no new caveats.
   If the hypothesis does not hold, say so (the design says how). Keep the long cut 675 to 825 words and the short
   160 to 195; `story_check.py --cut long|short --series mind_the_gap` until ready, no choppy warning.
3. Three fresh readers per cut (make-piece, "The Scripts step", A, B and C prompts word for word).
4. Outline and spine judge (`docs/plans/2026-10-23-outline.md`, make-piece "Outline"), then `making.py <piece> scripts
   long.md short.md`, `read-back` per cut, then `teleprompter_send.py plan` and the Teleprompter calls (standing yes).
5. Board: `python docs/plans/2026-10-19-week/update_friday_23oct.py` then `--build`. It refuses nothing by itself:
   publish only when `same_panels` is all true, `assets_absent` is empty and `verify` is empty. On 23 Oct it was
   blocked because Wednesday's record lacks two Drive links (that session's to fix); Friday still shows build
   a053b673's first drafts. Never patch the built board.
6. Article (1,000 to 1,400 words, "3 things you can do tomorrow", a sharp prediction within 92 days at 80%), fact
   gate, visuals after he records.

## Open with him

- His go on the four test prompts (they replace the three he had agreed).
- The engine API (`scripts/engine.py`) was declined in the first session; `making.py` worked.
- A pull request with auto-merge for the branch (AGENTS.md) once the scripts are final: it carries the
  `story_check.py` choppy-rhythm warning, the make-piece skill lines, and learnings `script-is-the-bottleneck`,
  `one-question-at-a-time`, `no-choppy-rhythm`, `tests-are-experiments`.
