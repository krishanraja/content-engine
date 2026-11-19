---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-19
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

## Where it is right now (as of 2026-11-19)

<!-- north-star-state {"week_of":"2026-11-16","week_target":12,"current":3,"current_as_of":"2026-11-19","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (1 published, and 2 Growth carousels and Shorts that passed the 10/10 judges and went live, in the last 7 days)","urgency":4,"urgency_reason":"at 25% of this week's target"} --> **North Star number: U4, far behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 3, against 12 this week, on the way to 30 by 30 November 2026. A bold swing every day; work that does not move the number waits.

- ve ingest measures each take's frame (size and rotation, ffprobe) onto the take record; compile stages a 16:9 cut over a vertical take as pillar when no layout is named; lint refuses an unmeasured take only once ingest has run (plan PR 4). (2026-11-19)
- A piece's engine and rules now freeze at Sign storyboard and nothing asks Krish to approve an engine hash. ve expect records the engine files, the rule files (lint, the piece guards, config/ve/*.json but the records ve writes during a piece, the brand palette) and the commit in engine.json. When either moved on main, ve proof and ve render run the whole command on that commit by themselves, before lint, from a checkout under .cache/ve-pins checked to hold both hashes; a whole cut renders on the engine of its approved proof. A fix follows main only under his standing engine-follows-main yes for the piece, or when no rule moved, every changed file is renderer source, houseGolden.json and its test are untouched, and the house golden test passes. bind_unshown is retired and a rule binds by its binds_from against the publish day as before, so a future-dated rule already frozen still binds. An approval may carry `at`, the moment he pressed, read by the two-renders-per-press count and by gates.from_approvals. Pieces frozen before this lands have no rules record and are moved only by their engine. (2026-11-19)
- The no-ask guard is in. config/ve/asks.json names the only four moments a production session may ask Krish (the lock with the recipe and one credit ceiling, Sign storyboard with the scripts, the final review, publish); make-piece, ve, produce-video, motion-designer and thumbnail-designer now decide, record and carry on between Sign storyboard and the final review, and validate-skills.py refuses a production skill that waits for him mid-production outside its Allowed asks section. Anything he might change lands as one line on the piece (making.py PIECE final-review KEY "LINE", the making record's for_final_review). The full rule is .agents/skills/ve/references/allowed-asks.md. Code gates that still hold for a press (ve render without a proof approval, the thumbnail drawer without his picked words, making.py video without his thumbnail pick) are named there as engine gaps for PRs 5, 16 and 17a. (2026-11-19)
- Four checks that stopped the engine on its own output are fixed: the plain-frame guard no longer refuses the brand palette's own close card, a frame grab at the clip's last frame reads it instead of reporting not_run, captions.word_default asks for word captions only where no caption style is picked and captions.steady measures only those cuts, and the pre-critic verdict is bound to the idea, the beats and the figures it judged, so an audio target, crop or counter edit no longer makes it stale. The title wordmark alignment failure is on the register. (2026-11-19)
- The Fri 20 Nov cuts lint clean and pass the pre-show review after fixing what the rendered stills showed: evidence cards no longer replace their page with a word mark, counters count down and are drawn in cream on a dark ground, the short's face, code and hindsight beats slam his key words, and the pillar staging no longer touches a tall cut. (2026-11-19)
- No channel copy in content-engine promises a prediction or a public scorecard any more: the YouTube description template, the X bio record and the call card's comment. Live profile bios that were set from the old copy still carry it until Krish changes them. (2026-11-19)
- The ve title is now one full-frame lockup with the stacked wordmark inside it, Wed 11's "AI MUSIC or HUMAN MUSIC?" build made the engine's own: two angled bands slam in from opposite sides as he says each part, the connector word in mint, bars behind and a light sweep, the wordmark on the lockup's own opacity. ve qc measures the settled title frame (title.lockup, title.lockup_frame), and every proof renders the title frame and is not sendable until someone has looked at it at full size (ve proof --title-looked); an approval that names the title holds until that look is recorded. Nothing was rendered on any piece. (2026-11-19)
- **StyleStill covers: 47 of 48 passed a separate review and are filed and recorded for the board's style pickers** (`config/ve/style-samples.json`). Eight came from Codex's second pass, 24 from its third, and 15 of the 16 held back from its fourth, after the reviewer's five named faults were fixed (`82360c9b`: line-boil passes too thick to read as three lines, receipt and living-ui labels ink on ink, the data story's chart now the sourced monthly sales indexed 100 to 107, flip-hinge sampled with its key word lit). slot-roll stays held: its uneven word gap is in the caption theme itself (`c631e0ac`). (2026-11-16)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-19 precritic.spec_sha now hashes style.idea, proof.structural_hash per cut and the figures in the datasets and object words; a verdict written on the old whole-spec hash still stands while that spec is unchanged.
Older lines: `docs/history/2026-11-19-NOW-moved-15.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-19): re-ingest the Fri 20 long take so its record carries media.frame, then drop the typed asset frame from its spec.
- House close (2026-11-10): kit and ve close on the statement card, "Built to help you decide." (`docs/production/CLOSING.md`). Krish approved the engine change for Wed 11 Nov (`docs/plans/2026-11-11-wednesday/ve/engine-exceptions.json`). He hears the first cut with it at full size.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-19): holds.

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
