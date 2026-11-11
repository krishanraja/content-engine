---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-11
head: 90e1b12
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

## Where it is right now (as of 2026-11-11)

<!-- north-star-state {"week_of":"2026-11-09","week_target":8,"current":2,"current_as_of":"2026-11-10","current_source":"Control Center content_ideas in the publication's series (2 published in the last 7 days)","urgency":4,"urgency_reason":"at 25% of this week's target"} --> **North Star number: U4, far behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 2, against 8 this week, on the way to 30 by 30 November 2026. A bold swing every day; work that does not move the number waits.

- Pull requests now wait only on the quick checks (CI: `npm run verify:quick`, Linux, every guard plus the related and publishing-safety tests); the full `npm run verify` on Linux and Windows and the browser jobs run after merge in full-verify.yml, which opens one issue when main goes red. Ruling (Krish, 2026-11-11): quick checks on pull requests, the full verify after merge; merge fast and he tests live. (2026-11-11)
- Wed 11 Nov (36886e0b) publish pack built and sent: fact gate passed on run 7 (all runs past the second on Krish's words), spine judge passed, visual gate passed, covers and thumbnails in the week's neon skin, titles Krish picked; both cuts in the post's working folder (the 5-minute dropped by Krish); reader test 8 9 7 8 8 8, under the bar. (2026-11-11)
- Wed 11 Nov (36886e0b) is ready to post: fact gate passed (run 7), spine judge passed, visual gate passed, pack in its 3 Posts folder; covers and thumbnails in this week's neon skin; both cuts are in the post's working folder (not filed: a one-off composite has no ve or quick-edit receipt, Krish chose b). Reader test 8 9 7 8 8 8, under the bar (reader-test.md). (2026-11-11)
- Vertical video carries no wordmark, mark tile, series badge or opening logo in any route (ve, quick-edit, the style lab, the Studio routes), by Krish's ruling of 11 November; the wide cut keeps them. ve QC proves the mark absent on 9:16 (brand.no_mark), renderer tests refuse chrome on any 9:16 beat, the lab checker fails a tall cut with a dress and any word over a wide wordmark, and quick-edit ignores an older config's dress. HOOK_IS_THE_INTRO now says so, approved by Krish. (2026-11-11)
- The Publish Board's feed has one versioned contract (apps/control-plane/api/board/view.schema.json, contract_version 1.0.0, a frozen fixture, check:view-contract in verify) and answers with an ETag and 304; content.krishraja.com/board/<Monday> is the archive with a banner to Control Centre's live board, and every link the engine gives Krish to the board is the live one (config/boards.json live_board). (2026-11-11)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). From 9 Nov one production round: `ve proof` shows the hardest beat moving on his own take, and `ve render` refuses a whole cut until he presses Approve proof; the day tab carries four presses (Sign storyboard with a `ve expect` sheet, Pick a style, Approve proof, Approve cut) in `meta.making.gates`. Five lessons of the killed Thursday 5 Nov cut are guards in `scripts/velib/guards.py`, binding from 9 Nov. (2026-11-04)

## What changed recently

- 2026-11-11 config/studio.json was left unchanged because it is bound into the signed media standard's hash; the vertical exemption is enforced in the renderer instead.
Older lines: `docs/history/2026-11-11-NOW-moved-4.md`, `docs/history/2026-11-11-NOW-moved-3.md`, `docs/history/2026-11-11-NOW-moved-2.md`, `docs/history/2026-11-11-NOW-moved-1.md`, `docs/history/2026-11-10-NOW-moved-8.md`, `docs/history/2026-11-10-NOW-moved-7.md`, `docs/history/2026-11-10-NOW-moved-6.md`, `docs/history/2026-11-10-NOW-moved-5.md`, then `docs/history/2026-11-10-NOW-moved-4.md` (it lists the earlier `*-NOW-*.md` files) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-11): Watch the first full-verify runs on main and fix any red from its issue the same day.
- House close (2026-11-10): kit and ve close on the statement card, "Built to help you decide." (`docs/production/CLOSING.md`). Krish approved the engine change for Wed 11 Nov (`docs/plans/2026-11-11-wednesday/ve/engine-exceptions.json`). He hears the first cut with it at full size.
- Wed 11 (2026-11-11): approved in Krish's own words (picks/yes-wed-words); the board reads it as ready to post, both cuts and the pack in its 3 Posts folder.
- Eye contact (2026-11-09): Wednesday runs `ve eyeline` per take (each has its own Maxine copy); visible contact needs the recording fix in EYE_CONTACT.md.
- Fri 13 Nov pre-production sheet (2026-11-07): both takes on the making record (Recorded: done); takes heard against the script (`docs/plans/2026-11-09-week/fri-takes-vs-script.md`: short take says "delegate" for "delete" and adds an unsupported "AI costs halved"; long take calls Hanoi "exaggerated" and changes the close line); the held 4 Nov send closed honestly (sent 06:46 on his words, no reader read-back ever passed). Sheet A to G sent to Krish as files and written as `docs/plans/2026-11-09-week/fri-preproduction/creative.json`. Waiting on Krish: Sign creative, and the 4-second pickup for "delete". Nothing is built before he signs.
- 16 Nov week (2026-11-09): board picked and published (Mon Oracle widened, Wed build vs buy, Fri AI after the midterms). Monday's lock signed 10 Nov: its long cut runs a few minutes over 5 and the article longer, to carry the midterm data-centre backlash. Next: one session per day from `docs/plans/2026-11-16-week/HANDOVER.md`.
- Waiting on Krish (as of 2026-10-29): Control Center's `GITHUB_TOKEN` needs Contents: write and Actions: read on this repository for the make press; whether the $15 cap gets a reader; the Buffer plan (due 31 October); OUR TEST or MY TEST on a video label he presents; "we" in article titles while video titles keep "I".
- Waiting on Krish (as of 2026-10-29, Wave 2 and 3 production): by ear, the levels and a sound-effect set; Gate 2 on face-with-proof frames and six devices; 5 to 10 golden frames; 20 minutes on 9 Nov scoring shadow cuts. His 29 Oct answers and the home-computer steps: the handover above.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-11): holds.

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

- `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT.md`, `docs/ENGINE_SECRETS_HANDOVER.md` and `docs/CAROUSEL_ENGINE_STATE.md` in the passages `docs/STUDIO.md` lists as stale (audited 2026-09-25).
- `docs/STATE.md` below its 29 October section, and `docs/SYSTEM_MAP.md`, `docs/GLOSSARY.md` and `docs/STUDIO.md`, where they predate the code: none was checked against the commits from 2026-10-22 on (ve, the floor, taste by venture, the Sunday loop, zero routines).
- `.agents/skills/mindmake-video` where it routes work into The Money of AI or Built With AI: correct for the Studio's series, wrong as a description of the publication.
- Any document that names Descript as the script reader (teleprompter.com since 2026-10-12), a 3-minute long cut (5 minutes since 2026-10-19), a series line or a weekly deep cut (retired 2026-10-21), or a publish board built as a Claude artifact (the web board since 2026-10-19).
- Any document that calls the publication or this engine Mindmake's (superseded 2026-10-28), gives it two channels (2026-09-25), or names a Claude routine as a scheduler (2026-10-29).
- Everything in `docs/history/`.
