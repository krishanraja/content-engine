---
name: plan-week
description: Plan the publishing week on Sunday. Research three or four options for each publishing day (Monday follow.the.money, Wednesday under.the.hood, Friday mind.the.gap), stress-test them, write them onto the pieces through /api/week/options so Control Center's week page (#/week) shows them, flesh out the ideas Krish dropped in, and put the week's one question on the board. Use when the Sunday "Plan the week" routine fires, or when Krish asks to plan or re-plan the week.
---

# Plan the week

Krish, 2026-10-11: "Every Sunday we're going to decide which of the three
pieces are going to go out on Monday, Wednesday, and Friday. We're going to
get Monday's piece all the way to iteration and the publish board, whilst
leaving Wednesday and Friday as topic confirmed and waiting on me", and the
only question he wants asked: "What are we writing about this week? Here are
your ideas and options. Do you want to drop in any other ideas that we can
flesh out?" Never ask him anything else on a Sunday: the standing answers are
in `docs/CADENCE.md` (a 3-minute video and a 90-second cut, every piece; Substack
and YouTube, then Shorts, TikTok and Instagram).

The week runs Monday to Friday. On Sunday it is the coming week.

## Steps

1. Read `docs/CADENCE.md` and each series' mandate and the material on hand:
   `python3 scripts/engine.py GET "/api/week/options?week_start=<Monday>" --full`
   (mandates, options already written, what is in flight or scheduled, the
   judges' best, and the ideas Krish dropped in during the last fortnight).
   Also list the Drive "Cold Ideas & Inspo" folder for anything new, when the
   Drive connector is attached (see "Without the connectors" below).
2. Flesh out what Krish dropped in first: an idea of his is never ranked below
   an equal one of the engine's.
3. For each publishing day, find three or four real options. Prefer existing
   rows. Check each against the series mandate; Krish's ruling of 6 October
   (fascinating and aspirational, never dull enterprise subjects); freshness
   (the dated event is inside two weeks); overlap with what was published and
   with the other days; and whether its numbers can be sourced verbatim for
   the fact gate. Run an adversarial pass that tries to refute each option
   before you rank them; say plainly when only one survives.
4. Write each day's options, best first, one recommended:
   `python3 scripts/engine.py POST /api/week/options @options.json` with
   `{"week_start": "<Monday>", "series": "<slug>", "options": [{"id": "<uuid>", "rank": 1, "pitch": "two or three plain sentences", "why_now": "the dated event, with its date", "recommended": true}]}`.
   A piece already scheduled for its day (a pick carried over) needs no options.
   A new idea that is not yet a row is created first with
   `POST /api/content-ideas {"raw_text": "...", "source_type": "lane_sourcing"}`.
   Never leave out `source_type` and never use `manual`: a manual row is what
   the week page shows as an idea Krish dropped in, so a session's own find
   would pose as his. If the reply says `"via": "ingest_gate"`, the engine's
   relevance gate dropped it as off-topic; it is not an option.
5. Put the question on the board: the slate cron does this each Sunday morning
   (`control-center api/content/slate.ts`), and the week page reads the options
   live, so nothing else is needed. Check that the board item
   `week-<Monday>` exists; if the cron has not run yet, it will.
6. Do not pick, schedule, draft or spend. Picking is Krish's press on the week
   page; his Monday pick starts the make-piece session on its own.

## Without the connectors

The scheduled Sunday routine may run with no Drive and no Firecrawl
connector. Then research with the built-in web search and web fetch instead,
and skip the Cold Ideas & Inspo folder rather than guessing what is in it.
Say which sources were unavailable on the week's board item, in one plain line
at the end of its detail, for example "Researched with web search only: Drive
and Firecrawl were not connected, so the Cold Ideas & Inspo folder was not
read." Write it with `POST /api/workbench {"action": "upsert_items",
"client": "claude_code", "items": [{"id": "week-<Monday>", "detail": "..."}]}`,
keeping the detail already there (read it first with `GET /api/workbench`); if
the item does not exist yet, give it `"lane": "on_you"` and a `"title"` too.
Put the same line in `WORKBENCH.md`, because the slate cron rewrites the week
item's text each morning.

Update `WORKBENCH.md` and end every reply with
https://controlcenter.krishraja.com/#/week.
