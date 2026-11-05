---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-05
head: 45161a5
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

The content engine is the production team behind makeyourmindup, the publication at makeyourmindup.ai: it finds what is worth saying, judges it with a blind panel, drafts it to the right subchannel's mandate, and turns it into the hero assets (the article, both cuts, thumbnails and covers; Growth makes the derived carousels, Notes and off-day posts), while Krish makes every decision that matters and nothing publishes itself. It is a Make Your Mind Up product, not a Mindmake one (Ruling, Krish, 2026-10-28); its `plan-week` is the one ideation path, and it runs makeyourmindup's kill list from a pinned copy (`vendor/makeyourmindup/kill-list/`). Two halves share one Supabase database: the content engine (`apps/control-plane`, its own Vercel project: the judges, drafting, the fact gate, the publish board, the ledger) and production (`scripts/ve.py`, the video engine; `scripts/quick-edit`, the fallback; `apps/renderer`; the Studio in `packages/` and `apps/runner`). Control Center is the desk Krish works at; the web publish board (content.krishraja.com) is the one surface he presses on. The publication has three subchannels, follow.the.money, mind.the.gap and under.the.hood, each held to a mandate in the database (`docs/NORTH_STAR.md`). This repository owns production, its standards and the hero assets; Growth-MakeYourMindUp owns posting, distribution and the derived carousels, Notes and memes (`docs/GROWTH-HANDOFF.md`, rulings of 26 and 28 October).

## Who it is for and why it matters for Mindmake

The engine is internal: it is how the publication reaches its reader, the face in `apps/control-plane/api/_mission.ts` ("a senior leader who will not admit to anyone that they are not ready for what is happening... leaders of PE and VC backed media, adtech and data businesses Krish already knows"). What it proves to that reader is that one person can run a publication with an AI production team and stay the editor: the machine proposes and shows its working, the person decides, and the machine learns only from what the person decided.

Stories a writer can carry without asking Krish:

- **Nobody was grading the judges.** The view comparing each judge with Krish's decision returned zero rows for two weeks, because no screen sent the panel's run id with his decision (`docs/STATE.md`).
- **Every mechanical check passed and the video was still rejected.** Eleven QC checks passed on the first ve proofs; Krish: "the visuals look like Microsoft Excel from 20 years ago". Design became a gate of its own (`config/failures.json`, F19).
- **Fewer rules, not more.** After weeks of one-piece rules, Krish asked for the engine to "know what kind of thing doesn't fly with me": the hard blocks shrank to eight nevers he confirmed, and everything else guides or is tested on engagement (`docs/production/THE_BAR.md`).

Objection it answers: "AI content is slop." Here is an engine that grades its judges against the editor, refuses to ship beneath his recorded rejections, and never counts its own actions as taste.

## Where it is right now (as of 2026-11-04)

<!-- north-star-state {"week_of":"2026-11-02","week_target":4,"current":1,"current_as_of":"2026-11-03","current_source":"Control Center content_ideas in the publication's series (1 published in the last 7 days)","urgency":5,"urgency_reason":"under 40% of the week's target two weeks running (25% now)"} --> **North Star number: U5, stalled.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 1, against 4 this week, on the way to 30 by 30 November 2026. Everything else pauses unless it moves the number.

- **Video: ve is the engine on main, quick-edit the fallback until ve passes Phase 3** (`docs/ve/STATUS.md`). From 9 Nov every ve piece runs one production round on the board (Sign storyboard with `ve expect`, Pick a style, Approve proof, Approve cut), and five guards from the killed Thursday 5 Nov cut bind (F31 to F39). Built and tested with the renderer mocked; no ve piece has yet run the round end to end on a real take.
- **The look is in the lab, waiting on his eye.** The renderer draws ten motion styles (`apps/renderer/src/engine/kit/motion-profiles.json`), the five look-alikes now have their own looks, and `ve lab` rendered every style and caption look on his Thursday take (reel sent 4 Nov; `docs/ve/lab/2026-11-04.json`). It shows the word caption across the SPLIT seam. Monday's Ladder is the data-story recipe; its `through_line` device waits until Friday 13 Nov is filed (F33, F39).
- **Craft measured on his real takes:** 24 fps teleprompter takes laid evenly (0 dropped frames against 1), `ve said` reads what he said on the take, sniffs turned down, the Critic sees motion strips. `picture.as_shot` (his room as shot) and `ve faces` (off-lens moments) are advisory and uncalibrated (F14).
- **Covers and thumbnails** are the Receipt (2 Nov: a real proof picture, no face). Only the subchannel's one weekly piece, or an asset that `carries` it, wears its colour and name; everything else, any day, wears none (`scripts/pages/brand.py` `series_look`, `tests/series_colour_test.py`; `docs/CAROUSEL-STANDARD.md` holds Growth to the same rule). Nothing may sit on the words (`tests/receipt_overlap_test.py`). The heavier series skin waits on his pick of two concepts sent 4 Nov; nothing of it merges before.
- **One music bed shape** in both engines (`config/music-bed.json`), nothing keyed to his voice, and no cut reaches 3 Posts without its bed receipt (F40).
- **The failure loop is built:** every failure lands in `engine_incidents` with what the session read first, and `engine-learning-weekly.yml` finds repeats each Sunday from 8 Nov and puts at most three proposals on his list.
- **Docs were checked against the code on 4 Nov**, every living document in this repository, growth-makeyourmindup and content-watcher. The docs steward has not run since 31 Oct (it refuses a run the auto-merge bot starts), so `auto-merge.yml` now folds closeout notes itself after each merge.
- **Known red check:** `tests/quick-edit-mix.test.ts` fails in a container with ffmpeg 6.1.1 (CI pins n8.1.2 and passes). Migrations `20261116090000`, `20261116100000` and `20261117090000` are not recorded as applied as of 28 Oct.

## What changed recently

- 2026-11-05 A generated carousel cover shows the house felt robot, from its reference photos, or no robot and a more creative idea (Krish: "either use the branded toy robot or are more creative than just a robot doing something"; `scripts/post-pack/cover_scene.py`, `config/brand-robot.json`).
- 2026-11-04 Series colours belong to the weekly piece, never the day (Krish: "Post random memes on a Monday but that doesn't mean it's Monday's colour and brand"). His verdicts: on the day-keyed first version, "everything's wrong in here"; on sticker concepts, "Stuff can't just randomly overlap on titles". The Saturday good news is five stories (`week_board.py` `STORY_COUNT`), as the standard and the 7 Nov carousel have it.
- 2026-11-04 Krish: "every single word inside the project documentation of all the repositories is 100% clear and up to date before you merge". The pass found NOW.md 39 closeout notes behind across the three repositories, because bot merges start no fold and the steward refuses them; auto-merge now folds, and the steward fix waits in ai-harness.
- 2026-11-04 The style and caption lab, his room as shot, face flags and `ve study` (#395): experiments move outside any piece (Krish: "experiment carefully"), on his own footage.
- 2026-11-04 ve took the craft quick-edit had and ve dropped (#394): his Monday 26 Oct take ran at 24.0019 fps with 9.2 ms jitter; the old filter dropped a frame and held 92 of 178 frames evenly, the new one none and 168.
- 2026-11-04 Krish killed the Thursday 5 Nov ve cut ("Okay, this is shit"); ten failures went into the register (F31 to F40) and five became guards binding from 9 Nov.
- 2026-11-04 Krish approved all 20 production standard groups: 159 floor standards are now approved and read first by `floor.py`.
- 2026-11-04 The bed pumped on Wednesday: one bed shape for both engines, and no cut filed without its receipt (#392, F40).
- 2026-11-03 Word captions sit on the split seam on SPLIT beats, at chest height on face beats, so they never land on his face (ve-motion-3).
- 2026-11-03 A second library lane, Heartside's (`send.py --library heartside`), and motion styles became a bank picked per piece.

Older lines are in `docs/history/LOG.md` (rolled verbatim on 4 Nov) and the `docs/history/*-NOW-*.md` files.

## What is next and what is waiting on Krish

- Next (2026-11-05): his pick of the series skin (D, the set, or A, the poster; sheets sent 4 Nov), then build it into the Receipt and redraw the 9 Nov series covers. The 9 Nov week (board 0e79df54): his Wednesday script press, Growth posts the off days, Saturday's pick on Sunday 8 Nov.
- Waiting on Krish (2026-11-05): new THE_RECEIPT text once he picks the skin (only he changes house rules). The 10 and 12 Nov off-day decks were rebuilt without under.the.hood and filed again on his yes (`docs/plans/2026-11-09-week/offday-carousels.md`); they reach the board at its next build.
- Waiting on Krish (2026-11-04): his numbers and words on the lab reel (`ve lab verdict`); download yes for the six shortlisted sounds, then his pick by ear; his words on the voice A/B; rating the motion styles on his own footage.
- Waiting on Krish (2026-11-04): a pull request in ai-harness so docs stay current by themselves: let the steward run when the merge bot starts it, fold on dispatch, add content-watcher to the fleet list, and give growth-makeyourmindup and content-watcher the fold workflow.
- Decisions the docs pass found (2026-11-04): the short cut's house rule says 160 to 225 words, the code 195; the ve engine cap is 300 minutes, set by a session, not him; house rule NO_NAME keeps his face on covers, THE_RECEIPT has none; rule 20 says the floor changes only by a pull request he merges, which auto-merge now does without him.
- Found, not fixed (2026-11-04): the hand-run quick-edit filing route cannot pass the receipt gates (only `produce_day.py` stages receipts); `ve sprint start` calls `ve brief` with arguments it refuses; `make-piece.yml`'s allowlist lacks commands the skill runs; `config/ve/crew/critic.lens.md` says seven questions where the card has eight (it is hashed into every verdict, so it is unchanged).
- Older open questions (2026-10-29): OUR TEST or MY TEST on a video label he presents; "we" in article titles while video titles keep "I"; Gate 2 on the 16:9 face-with-proof lock (9:16 froze on 3 Nov).
- North Star check (2026-11-04): holds.

## Read next

1. `AGENTS.md`: the rules for any agent here, and the start route. Read first.
2. `WORKBENCH.md`: where the last session stopped.
3. `docs/NORTH_STAR.md`: what the whole system is for, in Krish's words.
4. `docs/production/THE_BAR.md` and `scripts/floor.py`: the eight nevers, the aims, what is under test, and his rejections.
5. `docs/STATE.md`, `docs/SYSTEM_MAP.md` and `docs/CONTENT_ENGINE.md`: what is live, who owns what, and the engine route by route.
6. `docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md` and `docs/ve/STATUS.md`: the video engine and what it can do today.
7. `docs/CREATIVE_DIRECTION.md`, `docs/CAROUSEL-STANDARD.md`, `docs/PUBLISH_BOARDS.md` and `docs/CADENCE.md`: the signed direction, carousels and day colours, the board and the week.
8. `docs/GROWTH-HANDOFF.md`, `docs/DRIVE.md`, `docs/INTEGRATIONS.md` and `docs/COST_GUARDS.md`: Growth's side, Drive, outside services and spend.
9. `docs/GLOSSARY.md` and `config/failures.json` (`python3 scripts/check_failures.py`): every name, and every failure with its guard.

## Do not trust

- `docs/HARNESS_CONTEXT.md`: generated from ai-harness (`brain/repositories/content-engine.json`); it still names the 14 Oct handoff as orientation and does not name `docs/ve/`.
- `docs/AGENTS-REFERENCE.md` "What this repository is": a rule paragraph kept verbatim, which still describes the Studio making Shorts and carousels and a repository with no interface.
- `docs/CREATIVE_IDENTITY_UPGRADE.md`: a plan of September; the look lives in THE_BAR, the brand tokens, `docs/ve/MOTION_STANDARD.md` and the style bank.
- `docs/prompts/*.md` and anything in `docs/plans/` older than the current week: dated records, kept as written.
- Any document that names Descript as the script reader (teleprompter.com since 2026-10-12), a 3-minute long cut (5 minutes since 2026-10-19), a weekly deep cut (retired 2026-10-21), a Claude routine as a scheduler (2026-10-29) or a publish board built as a Claude artifact (the web board since 2026-10-19).
- Everything in `docs/history/`.
