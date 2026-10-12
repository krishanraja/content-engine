---
name: plan-week
description: Plan the publishing week on Sunday. Research three or four options for each publishing day (Monday follow.the.money, Wednesday under.the.hood, Friday mind.the.gap), stress-test them, write them onto the pieces through /api/week/options so Control Center's week page (#/week) shows them, flesh out the ideas Krish dropped in, put the week's one question on the board, and make the week's publish board (one page, a tab for each day, a tick for every step). Use when the Sunday "Plan the week" routine fires, or when Krish asks to plan or re-plan the week.
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

0. **Close out the week that is ending.** Copy Krish's ticks from its
   publish board onto the records (`.agents/skills/make-piece/SKILL.md`,
   "The week's ticks"), with that week's board link (its item
   `week-publish-board-<that Monday>`). The board is not closed by this: its
   item stays open, and every session's tick copy keeps reading it as last
   week's board until every picked day on it is at 100%, because Krish
   posts Friday's reposts at the weekend. Then `python3
   scripts/post-pack/descript_send.py pending`: a cut it lists is sent
   exactly as `make-piece`'s Scripts row says (his standing yes covers any
   session), or, without the Descript connector, named in one line on the
   week's board item. A cut sent by hand gets its record line instead, and
   one held back after a failed send is only named.
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
   `POST /api/content-ideas {"raw_text": "...", "source_type": "week_research"}`.
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
7. **Make the week's publish board**, last, once the options are written.
   Krish, 2026-10-12: "just give me one ... Publish Manager for the ...
   whole week with 3 tabs on it for Mon / Weds / Fri, which we need to get
   to 100%. Give me a tick box next to each one so I can tick as I go and
   you can durably record that completion where it needs to be recorded.
   That Publish Manager is what you create every Sunday and let me iterate
   inside until we're done, and then I check off the list what I have done
   as I do it."
   - **Build it** with all three tabs, from the week's picks as they stand:
     `python3 scripts/post-pack/week_board.py --week <Monday> --live --out
     .cache/week-board/<Monday>/week-board.html`. A day whose piece already
     has a publish page (a pick carried over) is a made tab: `Artifact`
     `read` its `publish_manager` link (in its making record) and add
     `--day DAY=<the saved file> --piece DAY=<uuid>`. A picked day not made
     yet gets its "not made yet" tab with a working checklist; a day not
     picked yet says so. It writes `week-board.json` beside the page: the
     week, each day's state and piece, every tick id, and the publish call.
     Exit 2 is a refusal it names: fix it and build again.
   - **Publish it as a new private artifact**, a new one every Sunday, never
     last week's link: `Artifact({action: "publish", file_path: "<absolute
     path>/week-board.html", title: "This Week's Publish Board", icon:
     "calendar", capabilities: {"db": {}, "downloads": true}, description:
     "<the manifest's publish.description>"})`. Then one `ArtifactData`
     `list` of `ticks` and one of `links` on its link: both are empty on a
     new board, and the page's own store is then known to answer.
   - **Record its link where every later session finds it.** On the board,
     an item of its own for this week, `week-publish-board-<Monday>`, so
     last week's item and link stay as they are: `POST /api/workbench` with
     `{"action": "upsert_items", "client": "claude_code", "items": [{"id":
     "week-publish-board-2026-10-19", "lane": "on_you", "rank": 0, "area":
     "This week", "title": "This week's publish board, 19 to 23 October",
     "detail": "One page for Monday, Wednesday and Friday. Tick each step as
     you do it; every tick is saved at once, and the next session copies it
     onto the piece.", "link": "<its link>", "link_label": "Open this week's
     publish board"}]}` (the id and the dates are the week's). In
     `WORKBENCH.md`, under "This week's publish board": the new week's line
     goes first, and the ending week's line moves under "Last week's
     publish board" (replacing the one there), where it stays until that
     week's item is done.
   - **When the picks come in.** This run is early on Sunday, before Krish
     picks, so most tabs start as not picked. The session his Monday pick
     starts (`make-piece`, "The week's publish board") rebuilds the board
     with the picks and republishes it to this same link, with `--previous`
     so no day it holds is lost, and no tick is lost; so does any session
     that finds a day picked or made that the board does not show yet. When
     this skill runs again in the same week (Krish asks to re-plan), it
     republishes to this week's link rather than making another.

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
the item does not exist yet, give it `"lane": "on_you"`, a `"title"`,
`"only_you": "judgment"`, `"link": "https://controlcenter.krishraja.com/#/week"`,
`"link_label": "Open the week"` and `"closes_on": "week_planned"` too, or
Control Center holds it back from his list (`WORKBENCH.md`, the board).
Put the same line in `WORKBENCH.md`, because the slate cron rewrites the week
item's text each morning.

Without the Descript connector, nothing is sent to Descript (step 0 names
what waits). Without the Artifact or ArtifactData tools, the week's board
cannot be made or read: say so on the week's board item and in
`WORKBENCH.md`, and the session his Monday pick starts makes it.

## Before you stop

Copy the week's ticks once more (a board made this run has none yet).
Update `WORKBENCH.md` and end every reply with
https://controlcenter.krishraja.com/#/week.
