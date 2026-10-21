# Handover: Wednesday 21 Oct (Muse vs Grok Bot), after the afternoon edits

Start a fresh session from this file (cost guard G1: the last session passed 500k tokens).

## Where it stands

- **Piece:** `d7a20885-7001-4661-b444-9d7ca1043416` (under.the.hood, Wed 21 Oct).
- **Scripts:** `docs/plans/2026-10-21-draft-script.md` (5 min, about 798 words) and
  `docs/plans/2026-10-21-draft-script-90s.md` (90 s, 195 words). Both pass
  `story_check.py`, are on the making record with two fresh readers each, and are
  in Teleprompter (`teleprompter_send.py plan` says nothing to send). They are built
  from Krish's 13:21 board edit and his comment "what does "a split" mean?".
- **Article and scorecard:** `docs/plans/2026-10-19-week/wednesday-article-draft.md`
  (ends with "3 things you can do tomorrow") and `wednesday-scorecard.md`.
- **Board:** content.krishraja.com/board/2026-10-19#wednesday shows the *morning*
  scripts (build 973df9eb). Republish only if Krish asks; the builder is
  `docs/plans/2026-10-19-week/update_wednesday_21oct.py` (snapshot, then `--build`,
  then `board_web.py publish-web ... --expected-build <current> [--apply]`).
- **PR #127** (branch `ccr-2ea65cbe-81iw85`): the afternoon drafts, learning
  `plain-score-words`, and the fix for main's red test. Krish removed the
  `board-ui-guard` hook from `.claude/settings.json` on main (eaeb6b9) and chose
  "Keep it removed": `tests/claude-hooks.test.ts` no longer expects it, and
  AGENTS.md, `docs/PUBLISH_BOARDS.md` and WORKBENCH say it is unregistered.
  He approved merging #127 once green.

## Rules settled today (all in code)

No series line; scripts open straight on the hook; close on "Here's what I'd do
with this info if I were you", last line "The full deep dive is at
makeyourmindup.ai." (`SCRIPT_CLOSE`); every article ends "3 things you can do
tomorrow" (`THREE_THINGS_TOMORROW`); tone observational, witty, positive
(`TONE_OBSERVANT_WITTY`); say the result, never the method; scores use win,
lose or draw only.

## Next

1. Krish records both cuts from Teleprompter.
2. Titles and thumbnail words after he records (his standing rule).
3. Open notes from readers he may want to fix before recording: "Grok found X
   conversations" can be heard as a number; his own line "I did a piece last
   week on this" loses listeners.
