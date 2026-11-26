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

- The Sunday ideas run now treats step 6d (judges, score, order, stage 2 touches) as part of the run, and its log names how the Claude step ended and which commands it was refused. (2026-11-26)
- Branch story/engine-v5 holds the story engine v5 (the reader Krish approved on 26 Nov, sports on the beat, the story floor, the blind story score with the pre-pick whys probe, close calls and a checked wildcard every Monday, Wednesday and Friday, gated from the 30 Nov board: the Sunday 29 Nov run is the first gated, with every hard floor citing his ruling or a recorded failure and the buyer judge kept as the paying-reader judge), the production cycle's one registry (config/cycle.json, touch.py), impact zoom (config/ve/impact-zoom.json, in ve and quick-edit, each with its camera.impact check) and the 26 Nov split, with origin/main and its v5 Library merged in. Landing on main on 26 Nov; the docs match it. (2026-11-26)
- config/beat.json carries sports as a focus sector (Ruling, Krish, 2026-11-25), so the feed, radar, ideas run and Sunday gate keep sports stories on the beat. Draft pull request, waiting for Krish's merge. (2026-11-25)
- Every whole cut dated from 26 Nov now ends on the Library's outro (video-wide-outro, video-vertical-outro, approved in docs/ve/cards/library/lock.json on Krish's delegation and his "1 agreed"), drawn by ve's V5Outro.tsx: S3h, "Follow for more", makeyourmindup.ai and the climb bars, with no tagline, no V10 mark, no days row and no series name; cuts dated before 26 Nov render as they were. The learning house-robot-or-no-robot now states the v5 no-robot rule and points at its line in docs/CAROUSEL-STANDARD.md, so the failure register guard is green again. (2026-11-26)
- The Library's YouTube and Facebook profile pictures are now S3h on grained ink, the same avatar-wordmark layout as Instagram at their own sizes and circle crops; the Substack logo stays the D icon. library.html renders from a clean checkout: its fonts load from assets/fonts/makeyourmindup/, and any .scratch review file it cannot find falls back to a drawn SVG stand-in in docs/ve/cards/library/samples/ (make_samples.py), with no photographs and nothing of Krish committed. (2026-11-26)
- Every video, series or off day, wide or tall, now ends on the plain v5 outro card (statement_card wide, statement_beat tall, drawn by EndingBand.tsx in the v5 look), and the intro sting closes no cut dated from 26 Nov (Ruling, Krish, 2026-11-26: "1 agreed"); ve lint and ve render refuse a sting clip anywhere in such a cut, and series cuts dated 23 to 25 Nov keep the sting close they were signed with. (2026-11-26)
- Series videos rotate two beds week by week on every series day, Four on the Funky Flour and NO CURVES; Liberty City, Mind Bender, Conclusion, Seize It and the new Movie track go behind carousels; Just Got Real and Drifting Valleys are retired because their files are not in the Music folder, so the live ledger checks clean. (2026-11-26)
- The last pre-v5 pointers point at the v5 kit (makeyourmindup brand-kit/, assets/brand/makeyourmindup/v5, Drive "1 Brand kit (permanent)/Channel art"), the felt robot and IBM Plex Mono are marked retired in live docs and skills, the palette marks pin the v5 SVGs, and the three ve tests that kept Full verify red since 08:12 on 26 Nov use the v5 fixture. (2026-11-26)
- The stray guard leaves floor/rejections and inspo/new-drops alone, the branches the Rejections engine and the inspiration drops reuse. (2026-11-26)
- config/beat.json carries sports as a focus sector (Ruling, Krish, 2026-11-25), so the feed, radar, ideas run and Sunday gate keep sports stories on the beat. Draft pull request, waiting for Krish's merge. (2026-11-25)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-26 What it is, from 26 Nov (Ruling, Krish, 2026-11-26): content-engine makes every asset from the v5 Library (config/asset-routes.json: the hero pieces, carousels, memes, Notes, per-channel words, covers, thumbnails and the weekly edition's package) and Growth-MakeYourMindUp posts, schedules and measures them and reports performance back; docs/GROWTH-HANDOFF.md is the contract and supersedes the 26 and 28 October split, so NOW.md's sentence that Growth owns the derived carousels, Notes and memes is history. Who it is for: the publication's reader is the people who make the calls or make the work in the creative, arts, music, entertainment, media and sports industries (config/beat.json reader, docs/NORTH_STAR.md); the face in _mission.ts (leaders of PE and VC backed media, adtech and data businesses) is Mindmake's reader only. Every copied board prompt names the Library as the only renderer, and ve card refuses the carousel, cover, meme and Notes image kinds.
Older lines: `docs/history/2026-11-26-NOW-moved-9.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-26): Read the 28 Nov 12:17 UTC run's "How the Claude step ended" lines and its gate for the week of 7 Dec.
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
