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

<!-- north-star-state {"week_of":"2026-11-23","week_target":20,"current":2,"current_as_of":"2026-11-23","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (0 published, and 2 Growth carousels and Shorts that passed the 10/10 judges and went live, in the last 7 days)","urgency":5,"urgency_reason":"under 40% of the week's target two weeks running (10% now)"} --> **North Star number: U5, stalled.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 2, against 20 this week, on the way to 30 by 30 November 2026. Everything else pauses unless it moves the number.

- The tall and wide sting closes and the Character.ai recording layout carry their size and fill fixes (every close size at least 40 px, the tall band lifted 450 px, the wide close clear of x 1100, the recording filling its panel with its source line beneath); these missed the first merge of the outro pull request. (2026-11-20)
- The premium title slide (direction A) is queued to Codex as card ve-title-premium-a on gpt-6.2-astra, set on this card only; the engine's default model pin is unchanged. (2026-11-20)
- Everything the next session needs is in docs/ve/handoff-2026-11-20/ (HANDOFF.md, the approved PLAN.md, the audit evidence, the shot study, the polish spec and generators, and Krish's ten recipe verdicts); WORKBENCH.md points to it. All the week's engine work is merged to main (#941 to #956); the title slide card is queued to Codex. (2026-11-20)
- ve shot grammar step 5 built. `ve matte` makes an offline subject matte of a cut's picture, cached by its sha256; compile writes `props.matte`, the in-world number and chapter marks with his head, the anchor title behind his head and a body keep-out; the renderer lays type between his take and the matted subject and cuts him out over a whole-frame stage panel. Anchor graphics sit only above his head on an ink scrim, captions under his chin. `grammar.depth`, `grammar.title_timing` (the title on his spoken words within 30 s) and the after-render `panel.fill` row hold it. Generated imagery is allowed as an art-directed metaphor and refused as a stand-in for a real thing (`depicts`). Reference renders on the Fri 20 take: anchor 9:16, stage 9:16, stage 16:9 (docs/ve/INGREDIENTS.md, "Depth and the staging fixes"). (2026-11-20)
- The GPU matte trial's second run (44739662276) rented one RTX A4000 for 216 s ($0.0102) and decoded no frames: the pod's ffmpeg 4.4 has no -fps_mode. Fixed to -vsync passthrough with a guard test. The spend approval's two runs are used, so the comparison was made on the local CPU instead (same pinned models, same clip). (2026-11-20)
- The GPU matte runner now speaks Runpod's REST API v2 (api.runpod.io/v2): v1 (rest.runpod.io) was retired on 15 Nov and no longer resolves, so the first matte-trial run died before making a pod, at no cost. It reads the live GPU catalog and tries each affordable card in stock, cheapest first. scripts/velib/maxine_pod.py still calls v1 and is broken the same way. (2026-11-20)
- A GPU subject matte trial runner is built (scripts/velib/matte_pod.py, the hand-only matte-trial.yml workflow): BiRefNet HR matting (MIT) and RobustVideoMatting (GPL-3.0, run on the pod only) pinned by commit and weights sha256, on one RunPod pod under the Maxine runner's guards. Nothing feeds a render. (2026-11-20)
- The series close is now the intro sting at the end, direction A (tall 2.0 s: the sting at 1.5x, the band lifts, "Built to help you decide." and Subscribe free land under it; wide: the sting resolves into the statement card, settled by 2.53 s, nothing right of x 1100), from Mon 23 Nov, reconciled across config/intro-sting.json (close block; still retired as an opening), config/brand-palette.json (sting_beat, sting_card, sting_close, close_copy), the guard, compile, ve render and the renderer. The accent kit (ember, ember_deep, plum, plum_deep, peach) is in the brand tokens, scoped by ve lint to big moments, gradients and duotone cut-outs on Mon, Wed and Fri. The two protected baselines draw as he saw them: unit_field badges, stripe, plane, greying from the end and a bound counter; marquee tape; video_wall tiles from his grabs; headline tone and blur-in; photo_plate loops in the series colour; scribble in the series colour; wired into both recipes and the motion-designer skill. (2026-11-20)
- The three styles taken from Krish's own cuts (Character.ai receipts, the eating-its-own-jobs ladder and badge grid, the AI music slam) are marked liked in the style bank with his words, so no session treats them as untested experiments. (2026-11-20)
- **StyleStill covers: 47 of 48 passed a separate review and are filed and recorded for the board's style pickers** (`config/ve/style-samples.json`). Eight came from Codex's second pass, 24 from its third, and 15 of the 16 held back from its fourth, after the reviewer's five named faults were fixed (`82360c9b`: line-boil passes too thick to read as three lines, receipt and living-ui labels ink on ink, the data story's chart now the sourced monthly sales indexed 100 to 107, flip-hinge sampled with its key word lit). slot-roll stays held: its uneven word gap is in the caption theme itself (`c631e0ac`). (2026-11-16)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-20 The first merge of the outro pull request left main without the final size and fill fixes to the sting close and the Character.ai recording layout.
Older lines: `docs/history/2026-11-20-NOW-moved-5.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-20): Render the first series piece from Mon 23 Nov and check its close at both ratios against the approved mocks.
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
