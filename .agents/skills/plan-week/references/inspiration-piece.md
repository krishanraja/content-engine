# His instruction: make a ticked Inspiration card into a piece now

Reference for the `plan-week` skill, read by the Inspiration piece run (`.github/workflows/inspiration-piece.yml`) and
by any session asked to answer one of his ticks by hand. `docs/PUBLISH_BOARDS.md`, "His instruction", says where it sits.

Krish, 2026-11-12: "In my inspiration board can I have an option to tick a box that states that this isn't just random
inspiration but it's an actual instruction that needs to be followed (or made into a piece urgently), or a production
style that should be mimicked within the next week? We can turn some inspiration into actual action immediately and
jump the queue." Ruling (Krish, 2026-11-12): an inspiration card he ticks is an instruction that jumps the queue:
Content means make it into a piece now, Production means use the style within a week.

This reference is the Content half: one idea, on the ideas board, today. (The Production half is the make-piece skill's
and Growth's: the next fitting cut names the card in `brand.references`.) His tick is an instruction, so the idea is
not judged against the week's other ideas for whether to offer it: it is offered. It is held to every standard an idea
is held to, and it still waits for his Approve.

## Before a word

1. `python3 scripts/check_failures.py`, then `python3 scripts/floor.py --format script` and
   `python3 scripts/floor.py --format title` (the rejection floor: what he refused and the standards nothing may fall
   beneath).
2. Read the brief the workflow wrote, `.scratch/inspiration/<action_id>.json`
   (`python3 scripts/post-pack/inspiration_act.py brief <action_id> --out ...`): `his_words` (his words when he ticked
   it, then the card's: why it's here, what he typed he likes, his note for Claude; quote them as his, never a tapped
   guess as his words), the `card` (its name, kind, how he said to read it, the post it came from, its transcript),
   the `reading` (content-watcher's reading of the post), the planning `week` and its `open_days` in order, each with
   its series' mandate. The brief is private: it stays in `.scratch/`, which is never committed.
3. Read `.agents/skills/plan-week/references/ideas-gate.md` and `references/refused.md`: a subject he refused is not
   offered again unless his words on this card raise it again.

## The idea

4. **What he wants from it.** His words lead. When they say what the piece is ("make it about who pays"), that is the
   story; when they say only that he wants it made, the card's own argument is the starting point. Never copy the
   source: make the piece the publication's own (the same rule as every idea from his inspiration).
5. **Research it the same day**, as step 3 of the plan-week skill does: the strongest fact, from its primary source,
   linked and checked against that source; a company's own claim says so. Leave out any fact you cannot check. The
   built-in web search and fetch are the tools; there is no Drive or Firecrawl connector in the run.
6. **Write the option as every idea is written** (the plan-week skill, step 3, "The quality bar"): `so_what` first
   (what a business person finds out, in one plain sentence, the consequence before any mechanism), then its `story`
   (Headline, Hook, the evidence, the chain, what's actually going on, where we land), `why_now` with its date, `fact`
   and `source` `{label, url}`. The business-leader test, simple first then unpacked, follow.the.money shows the money.
   Then the gates in code: `python3 scripts/post-pack/copy_lint.py` and
   `node vendor/makeyourmindup/kill-list/kill-list.mjs` on the words (no em dashes, none of the killed phrases, no
   "Not X, Y" in either order). Fix and check again until both pass.
7. **Its day: the earliest open day it fits.** Walk `open_days` in order and take the first whose series' mandate the
   idea fits (Monday follow.the.money, Wednesday under.the.hood, Friday mind.the.gap); his words naming a day win.
   When no open publishing day fits, it is an off-day option on the earliest of Tuesday, Thursday or Saturday, written
   as `references/offdays.md` says for a piece he records (`kind: recorded`: his own ideas go there as pieces he records,
   Ruling, Krish, 2026-10-29). Never a day that already has its piece.
8. **Its record.** Make the idea's row first: `python3 scripts/engine.py POST /api/content-ideas @<file>` with
   `{"raw_text": "<the so_what and the story>", "source_type": "week_research"}` (never `manual`: that means his own
   words). If the answer says `"via": "ingest_gate"`, the relevance gate dropped it: write no idea file and stop; the
   run tells him on his card that it could not be placed.

Once it has its row, report on it as you work and file what the research found there
(`python3 scripts/post-pack/board_session.py <piece id> start`, `progress`, `add`, `done`; docs/PUBLISH_BOARDS.md,
"Sessions and materials"), so the live board shows who is working on it and what is on file.

## Placing it

9. Write `.scratch/inspiration/<action_id>.idea.json`: `{"action_id", "week" (the brief's Monday), "day", "piece_id"
   (the row from step 8), "option" (the ideas.json option: so_what, story, why_now, fact, source, and for an off day
   the off-day fields), "pitch" and "why_now" (the week option's words, up to 700 and 400 characters; a publishing day
   only)}.
10. `python3 scripts/post-pack/inspiration_act.py place .scratch/inspiration/<action_id>.idea.json`. It appends the
    option to its day in `docs/plans/<Monday>-week/ideas.json`, after the day's other options so the board's press
    ids for them never move, marked `from_inspiration` with his tick and the card, and with the card in its `covers`.
    It refuses a day that already has its piece.
11. `python3 scripts/post-pack/board_feed.py gate <Monday>` must pass (what he refused stays refused). Then stop. The
    workflow keeps the week's `ideas.json` on the week's branch, offers the idea for its series through
    `/api/week/options` on top of the day's four (`inspiration_action`), bumps the week's change signal and tells
    Control Centre the idea is drafted, so it is listed first in To approve with the card beside it.

## Never

- Never put the idea on the publish board: no `/api/content-ideas/<id>/schedule`, no pick, no press, no `decided`.
  Only his Approve does; the database refuses any other placement (the ideas gate).
- Never write his words as a session's, or a session's words as his.
- Never commit the brief or anything from the card's reading: this repository is public.
- Never end silently: a run that cannot make the idea says why on his card (the workflow's last step).
