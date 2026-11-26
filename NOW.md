---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-26
head: f03dcbc
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

## Where it is right now (as of 2026-11-26)

<!-- north-star-state {"week_of":"2026-11-23","week_target":20,"current":1,"current_as_of":"2026-11-25","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (0 published, and 1 Growth carousels and Shorts that passed the 10/10 judges and went live, in the last 7 days)","urgency":5,"urgency_reason":"under 40% of the week's target two weeks running (5% now)"} --> **North Star number: U5, stalled.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 1, against 20 this week, on the way to 30 by 30 November 2026. Everything else pauses unless it moves the number.

- The publish kit's Substack step now publishes a piece to the web only (untick "Send via email and Substack app inbox"; opt-in readers through Advanced, "Only send to a specific audience segment", once their section exists; stop and ask Krish if the box is missing), and every subscribe line promises the weekly edition: "Get the week's pieces and the news that matters, in one email every Saturday" (Ruling, Krish, 2026-11-25; design in growth-makeyourmindup docs/plans/2026-11-25-weekly-edition/). The self-test refuses "send to everyone" and the retired line; docs/AMPLIFICATION.md and the ARTICLE_SUBSCRIBE_ASK example say the same. It also vendors growth's subscribe route with the weekly edition's tagged links (sha256 01f74de9, growth-makeyourmindup PR 144), so it merges after that pull request. Krish approved the weekly edition plan (25 Nov), so it lands now (26 Nov) instead of waiting for V1: Substack documents the web-only box for posts and podcasts, not Video posts, and if a Video post's publish screen has no such box, the publish step stops and asks Krish before publishing. (2026-11-25)
- The standards check-in of 2026-11-26 grouped the new floor standards; config/floor-groups.json holds 85 groups, each new one seeded as a proposal for Krish on the pinned check-in page. (2026-11-26)
- The standards check-in gives a new evolution in the no-prediction lineage (bold_predictions, predictions_committed) the ruled statement from config/floor-rulings.json, not his database amendment, which quotes his words after it; on 26 Nov bold_predictions_e261126 copied the amendment and tests/floor_rulings_test.py refused the check-in pull request #994. (2026-11-26)
- tests/floor_groups_print_test.py passes again on main: its synthetic group was keyed house_brand, which the 25 Nov v5 ruling (config/floor-rulings.json v5_groups) now rewords, so the test printed the ruling's words instead of its own; the group is now corner_mark, which no ruling touches. (2026-11-26)
- No branch is left unmerged: the hourly stray guard (.github/workflows/stray-guard.yml) deletes merged and closed-PR branches, opens a pull request for any branch idle six hours, marks drafts idle a day ready, merges green ones and lists the rest in one issue; AGENTS.md tells every session to read open pull requests first and land or delete its branch. (2026-11-26)
- The weekly edition is drafted by the engine (Krish, 2026-11-25: one email a week, "makeyourmindup weekly", every Saturday at 08:00 New York; growth-makeyourmindup DESIGN.md, approved with every recommendation). config/weekly-edition.json holds its settings (topic heads the hub's subsectors, read from config/hub-sources.json by key; at most two items a subsector, in two to four topics as the Library's template lays them out; the link tags of growth's edition route); scripts/edition/edition.py gathers the week (live pieces, good news, and the news candidates from the week's daily hub editions through GET /api/board/<Monday>/edition/news, which reads hub_snapshots; 26 Nov: the edition runs no gathering of its own), checks the draft against content-engine-edition/1 and the copy rules and kill list, renders a structure-only preview (the v5 Library's look is locked, but its newsletter template is wired into render with the v5 Substack branding, so none is drawn yet) and packages the canonical bytes with their sha256; .github/workflows/weekly-edition.yml (Friday 17:17 and 23:47 UTC, guard scripts/weekly_edition.py, Claude Code on his subscription, .agents/skills/weekly-edition/SKILL.md) files it in the library as 3 Posts/<Saturday> Sat edition - makeyourmindup weekly; the view (contract 1.35.0) puts it on Saturday with one press, Approve for send, bound to its sha256 (409 edition_changed otherwise). Ready for merge on 26 Nov; nothing sends without his press. (2026-11-25)
- The week of 23 Nov has new Thursday and Saturday options on the Ideas tab, made by the v5 story engine as its first live test: four quiz carousels and a meme on Thursday, five good-news carousels on Saturday, each naming its v5 Library set. (2026-11-26)
- The standards check-in now takes every long dash out of the group title, statement and check it proposes (a number range reads "to", any other becomes a comma), so floor_group.py --check no longer refuses the week over one; on 26 Nov a new group's check carried one and the floor pull request #973 stayed red. (2026-11-26)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-26 Thursday and Saturday of the week of 23 Nov remade by the v5 story engine (26 Nov).
Older lines: `docs/history/2026-11-26-NOW-moved-5.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-25): the next piece's Substack publish reads the Video post screen and unticks the email box, or stops and asks Krish if the box is missing.
- House close (2026-11-10): kit and ve close on the statement card, "Built to help you decide." (`docs/production/CLOSING.md`). Krish approved the engine change for Wed 11 Nov (`docs/plans/2026-11-11-wednesday/ve/engine-exceptions.json`). He hears the first cut with it at full size.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-26): holds.

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
