# Handover: one idea queue, marked from the board, triaged in Control Center

Start a fresh Claude Code session on `krishanraja/content-engine` (it will also need
`krishanraja/control-center`) and paste: "Read docs/handovers/2026-10-19-idea-queue.md and do what it says."
Opus for the design and the words; Sonnet for rebuilds and tests. No agents or workflows.

## His words (19 Oct), in full in `config/learnings.json`: `one-idea-queue`, `story-a-business-person-gets`

"Can you let me mark ideas for a queue instead of selecting them for this week because I like multiple ideas
and some of them aren't time-sensitive? That way every ideas tab can start to build a queue of stuff that should
be published at some point. That becomes a pretty powerful canon but it needs to survive everything and be the
first thing in chat. That queue needs to be A/B triage in Control Centre in that way as well."

"Would I consider this story or angle? If not would I consider it cute or am I curious but not convinced for
some specific reason because it's safer?" ... "Let's make the publish board permanently upgraded with this and
cohesively connected to the control centre as well as there just being one cue [queue]."

## What to build

1. **One queue, in the engine.** Check first what already exists (`content_ideas` states and `library_at`,
   `apps/control-plane/api/content-ideas.ts`, the purge and triage sweeps, `docs/CONTENT_ENGINE.md`) and reuse
   it rather than add a second store. A queued idea is a `content_ideas` row marked queued (meta or a column, by
   migration under `supabase/migrations/`), exempt from every purge, expiry and bury sweep, carrying his triage
   verdict and its evidence (story, why now, checked fact, source). One guarded route (`guardEngine`) reads and
   writes it, e.g. `GET/POST /api/idea-queue`. "Survives everything": a test proves the purge, triage and judge
   sweeps never touch a queued row.
2. **His triage, four ways** (his words): Story (would run it), Angle (would run it from this angle), Cute (likes
   it, would not run it), Curious but not convinced (with his reason, e.g. "it's safer"). Plus Drop. Recorded
   with `decided_by: 'Krish'` only from his own tap or words.
3. **The board** (`scripts/post-pack/week_board.py`, `week_board/week.js`): beside each idea's Pick box, the
   four triage buttons and a Queue mark. Saved at once in the board's store (`queue/<pick>`) and posted as a
   comment (`QUEUE <pick> <verdict> <reason>`) so either account reads it; the next session copies them into
   the engine queue. The Ideas tab also shows "From your queue" first: the queued ideas that fit each day.
   Self-test and `--verify` cover it; browser-test it before publishing; republish to every link in
   `config/boards.json` for the week with his yes.
4. **Control Center** (`krishanraja/control-center`): one Queue page doing A/B triage (two ideas side by side,
   he taps the better, or triages one with the four verdicts), reading and writing the engine route. No second
   copy of the queue there.
5. **First thing in chat**: every planning or making session starts by reading the queue (add it to
   `docs/ENGINE_SESSION.md`'s start, `plan-week` step 1 and `WORKBENCH.md`'s top), and plan-week offers queued
   ideas before new research. Encode both learnings with markers, so `scripts/check_failures.py` holds them.
6. **Every idea line says what a business person finds out**, first and in plain English, before the
   mechanism. Add it to `read_ideas` (a `so_what` field, refused when missing) and to plan-week step 3b.

## Rewrite on the live board now

The Monday Argon idea, as he asked, in plain English (put it in `docs/plans/2026-10-19-week/ideas.json` as its
story and rebuild): "If your business is building on Google's AI, your bill doubles on 1 December, and almost
nobody has priced that in. The companies that set up their AI to reuse what it has already read pay a tenth of
the price for most of it; the ones that did not will see their AI costs jump overnight. Who wins, who gets
squeezed, and what to check in your own contracts before December."
(Facts behind it, checked 18 Oct: $2 and $10 per million tokens to 30 Nov, then $4 and $20; cached input $0.10
to $0.20. "A tenth" is cached input against normal input, $0.20 against $2 before December: recheck on Google's
own pricing page at the fact gate.)

## Also open from the last session

`docs/handovers/2026-10-18-week-picks.md` (his picks onto the week page; the 4SZR link on his other account).
Do the queue first if he has not picked yet, so his marks on this week's tab are not lost.
