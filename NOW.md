---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-20
head: 6bbfa12
lifecycle: building
production_url: https://content-engine-flame-nu.vercel.app
state_doc: docs/STATE.md
history_log: docs/history/LOG.md
truth_files: []
authority_order: [production readback (the Vercel project content-engine and the Supabase database), AGENTS.md, docs/NORTH_STAR.md, docs/STATE.md, docs/SYSTEM_MAP.md, docs/CONTENT_ENGINE.md, docs/STUDIO.md, docs/ENGINE_SESSION.md, docs/GLOSSARY.md, README.md]
steward: https://github.com/krishanraja/ai-harness/blob/main/docs/steward/RUNBOOK.md
never_publish: [the Epidemic Sound licence ids and the Teleprompter and Descript account details, Drive folder ids, the Claude routine and trigger ids, the Supabase project id, any credential or secret name including the operator token, the cron secret, Drive paths, Windows runner host names and local paths, runner bearer and signing key target names, any Remotion licence status detail, any client or guest name in config, the text of any subchannel mandate or of the voice block]
---
# Make Your Mind Up content engine: where it is right now

## What it is

The content engine is the production team behind makeyourmindup, the publication at makeyourmindup.ai: it finds what is worth saying, judges it with a blind panel, drafts it to the right subchannel's mandate, and turns it into the hero assets (the article, both cuts, thumbnails and covers), while Krish makes every decision that matters and nothing publishes itself. It is a Make Your Mind Up product, not a Mindmake one (Ruling, Krish, 2026-10-28); its `plan-week` is the one ideation path, and it runs makeyourmindup's kill list from a pinned copy (`vendor/makeyourmindup/kill-list/`). Two halves share one Supabase database: the content engine (`apps/control-plane`, its own Vercel project: the judges, drafting, the fact gate, the publish board, the ledger) and production (`scripts/ve.py`, the video engine; `scripts/quick-edit`, the fallback; `apps/renderer`; the Studio in `packages/` and `apps/runner`). Control Center is the desk Krish works at, and its Content tab holds the one live Publish Board, the one surface he presses on (Ruling, Krish, 2026-11-11; the old board pages redirect to it since 2026-11-13). The publication has three subchannels, follow.the.money, mind.the.gap and under.the.hood, each held to a mandate in the database (`docs/NORTH_STAR.md`). This repository owns production, its standards and the hero assets; Growth-MakeYourMindUp owns posting, distribution and the derived carousels, Notes and memes (`docs/GROWTH-HANDOFF.md`, rulings of 26 and 28 October).

## Who it is for and why it matters for Mindmake

The engine is internal: it is how the publication reaches its reader, the face in `apps/control-plane/api/_mission.ts` ("a senior leader who will not admit to anyone that they are not ready for what is happening... leaders of PE and VC backed media, adtech and data businesses Krish already knows"). What it proves to that reader is that one person can run a publication with an AI production team and stay the editor: the machine proposes and shows its working, the person decides, and the machine learns only from what the person decided.

Stories a writer can carry without asking Krish:

- **Nobody was grading the judges.** The view comparing each judge with Krish's decision returned zero rows for two weeks, because no screen sent the panel's run id with his decision (`docs/STATE.md`).
- **Every mechanical check passed and the video was still rejected.** Eleven QC checks passed on the first ve proofs; Krish: "the visuals look like Microsoft Excel from 20 years ago". Design became a gate of its own (`config/failures.json`, F19).
- **Fewer rules, not more.** After weeks of one-piece rules, Krish asked for the engine to "know what kind of thing doesn't fly with me": the hard blocks shrank to eight nevers he confirmed, and everything else guides or is tested on engagement (`docs/production/THE_BAR.md`).

Objection it answers: "AI content is slop." Here is an engine that grades its judges against the editor, refuses to ship beneath his recorded rejections, and never counts its own actions as taste.

## Where it is right now (as of 2026-11-20)

<!-- north-star-state {"week_of":"2026-11-16","week_target":12,"current":4,"current_as_of":"2026-11-20","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (1 published, and 3 Growth carousels and Shorts that passed the 10/10 judges and went live, in the last 7 days)","urgency":4,"urgency_reason":"at 33% of this week's target"} --> **North Star number: U4, far behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 4, against 12 this week, on the way to 30 by 30 November 2026. A bold swing every day; work that does not move the number waits.

- The shot grammar Krish approved on 20 Nov is built in ve. Every cut keeps one staging (band, stage or anchor) for its whole body; `ve lint` checks seven `grammar.*` rules from the spec (staging, face runs, region, evidence size, generated, repeat, caption zone) for pieces frozen from 23 Nov; `ve shots` writes each beat's shot type and the shot table on the storyboard; the layout-variety rule, the dead face cap, the full-frame takeover on band and stage cuts and `pivot-split` are retired. The recipe samples' engine faults are fixed with it: stage draws him large bottom right, the title builds in the panel and holds full frame at most 2 s, devices grow to fill a staged panel, money reads "$195,000", band captions sit on the seam, the pace floor measures the body only, and `captions.off_face` reads where captions really are. Anchor is built at 9:16 only; generated imagery is refused outright. (2026-11-20)
- The ten style combinations Krish approved on 20 Nov are recipe files in config/ve/recipes/, each rated {approved: true, by: Krish, on, words} through the new `python scripts/ve.py recipe rate <id> <0-10> --words "..."` or `--approved --words "..."`; floor.rated treats his approval like a 9, so all ten are usable from 23 Nov. Every recipe names its staging (band, stage or anchor) and no generated kinds. Two samples on his Fri 20 Nov take went to Inbox from My AI (character-ai-receipts 9:16, ai-music-slam 9:16); the rest were stopped because they show the engine faults the shot-grammar build is fixing (stage puts him in a small window, under-filled panels, the title lockup tripping the plain-dark guard, and the 6 s 16:9 close alone breaking the pace floor's longest gap). (2026-11-20)
- The home computers' machine-owned engine copies (recordings-source, library-source) now heal themselves after a rewrite of main: scripts/home-copy.ps1 (Update-HomeCopy) is the one pull the recordings lane, the library sync and the recordings installer use; when the fast-forward fails it keeps HEAD on a local backup/auto-<stamp> branch and resets main to origin/main, never for runner-source or a person's copy. A failed heal held for more than two hours now leads the recordings_drive_inbox failure with the machine, the hours and the fix (stale_copies in the run ledger), and checkout_tidy prints the three realign commands for a person's copy left on rewritten history. Failure home-copies-stale-after-history-rewrite. (2026-11-20)
- the ve quality floor (wave 1b): a cut with any `ve pace` measure below every reference he keeps, or a blind judge score below 8 (`ve judge`, the ve-critic agent scoring the cut among his references without knowing which clip it is), is held (ve status prints one "held: below the floor" line, never READY; ve file refuses it); ve faces keeps the face box and compile writes a face keep-out per beat and refuses captions, staged device regions or backdrop panels on it. From pieces frozen on 23 Nov 2026: ve lint refuses a staged panel empty or only a backdrop for more than 1.5 s, asks for a recipe Krish rated 9 or more (or the one named experiment) with captions and generated assets only from it and a face track on every take, and a cut with no judge score is held. Tested on fixtures (`tests/ve_quality_floor_test.py`), not yet on a piece. (2026-11-19)
- ve ingest measures each take's frame (size and rotation, ffprobe) onto the take record; compile stages a 16:9 cut over a vertical take as pillar when no layout is named; lint refuses an unmeasured take only once ingest has run (plan PR 4). (2026-11-19)
- **StyleStill covers: 47 of 48 passed a separate review and are filed and recorded for the board's style pickers** (`config/ve/style-samples.json`). Eight came from Codex's second pass, 24 from its third, and 15 of the 16 held back from its fourth, after the reviewer's five named faults were fixed (`82360c9b`: line-boil passes too thick to read as three lines, receipt and living-ui labels ink on ink, the data story's chart now the sourced monthly sales indexed 100 to 107, flip-hinge sampled with its key word lit). slot-roll stays held: its uneven word gap is in the caption theme itself (`c631e0ac`). (2026-11-16)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-20 scripts/velib/grammar.py, scripts/velib/shots.py, config/ve/shot-grammar.json, the renderer's stagings, title and kinetic_stat, docs/ve/INGREDIENTS.md "Shot grammar".
Older lines: `docs/history/2026-11-20-NOW-moved-2.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-20): Run Monday's piece on the grammar: pick its staging at the lock with the recipe, run `ve shots` before Sign storyboard, and check its lint is clean of `grammar.*`.
- House close (2026-11-10): kit and ve close on the statement card, "Built to help you decide." (`docs/production/CLOSING.md`). Krish approved the engine change for Wed 11 Nov (`docs/plans/2026-11-11-wednesday/ve/engine-exceptions.json`). He hears the first cut with it at full size.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-20): holds.

## Read next

1. `AGENTS.md`: the rules for any agent here, and the start route. Read first.
2. `WORKBENCH.md`: where the last session stopped.
3. `docs/NORTH_STAR.md`: what the whole system is for, in Krish's words.
4. `docs/production/THE_BAR.md` and `scripts/floor.py`: the eight nevers, the aims, what is under test, and his rejections.
5. `docs/plans/2026-11-07-wave-2.md` and `docs/plans/2026-11-14-wave-3.md`: the work after the first Sunday loop.
6. `docs/STATE.md`, `docs/SYSTEM_MAP.md` and `docs/CONTENT_ENGINE.md`: what is live, who owns what, and the engine route by route.
7. `docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md` and `docs/ve/STATUS.md`: the video engine and what it can do today.
8. `docs/CREATIVE_DIRECTION.md`, `docs/CAROUSEL-STANDARD.md`, `docs/PUBLISH_BOARDS.md` and `docs/CADENCE.md`: the signed direction, carousels, the board and the week.
9. `docs/GROWTH-HANDOFF.md`, `docs/DRIVE.md`, `docs/INTEGRATIONS.md` and `docs/COST_GUARDS.md`: Growth's side, Drive, outside services and spend.
10. `docs/GLOSSARY.md` and `config/failures.json` (`python3 scripts/check_failures.py`): every name, and every failure with its guard.

## Do not trust

- `docs/DEPLOYMENT.md` in the passages `docs/STUDIO.md` ("The detailed Studio documents") lists as stale. (`docs/CAROUSEL_ENGINE_STATE.md` is a retired stub since 2026-11-13; its record is in `docs/history/`.)
- `.agents/skills/mindmake-video` where it routes work into The Money of AI or Built With AI: correct for the Studio's series, wrong as a description of the publication.
- Any document that names Descript as the script reader (teleprompter.com since 2026-10-12), a 3-minute long cut (5 minutes since 2026-10-19), a series line or a weekly deep cut (retired 2026-10-21), or a publish board built as a Claude artifact, or the web board at content.krishraja.com as the live one (it was the board from 2026-10-19, a read-only archive from 2026-11-11, and is retired since 2026-11-13, every address redirecting to the live board in Control Centre's Content tab).
- Any document that calls the publication or this engine Mindmake's (superseded 2026-10-28), gives it two channels (2026-09-25), or names a Claude routine as a scheduler (2026-10-29).
- Everything in `docs/history/`.
