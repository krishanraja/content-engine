---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-05
head: 8ddf532
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

## Where it is right now (as of 2026-11-05)

<!-- north-star-state {"week_of":"2026-11-02","week_target":4,"current":2,"current_as_of":"2026-11-05","current_source":"Control Center content_ideas in the publication's series (2 published in the last 7 days)","urgency":3,"urgency_reason":"at 50% of this week's target"} --> **North Star number: U3, well behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 2, against 4 this week, on the way to 30 by 30 November 2026. Two experiments a week, growth output doubled.

- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). From 9 Nov one production round: `ve proof` shows the hardest beat moving on his own take, and `ve render` refuses a whole cut until he presses Approve proof; the day tab carries four presses (Sign storyboard with a `ve expect` sheet, Pick a style, Approve proof, Approve cut) in `meta.making.gates`. Five lessons of the killed Thursday 5 Nov cut are guards in `scripts/velib/guards.py`, binding from 9 Nov. (2026-11-04)
- **The style and caption lab** ran 12 looks on one pinned 8 s window of his Thursday take; reel and sheet are with him (`docs/ve/lab/2026-11-04.json`). ve also gained quick-edit's craft: even 24 fps laying, HDR tone mapping, `ve said`, `ve faces`, `ve study`, motion strips for the Critic and `ve sfx audition` (six sounds shortlisted, none downloaded). Captions sit off his face; STAGE beats, logo_orbit and face-with-proof carry the brand treatment (Codex cards ve-motion-3, -5, -6). (2026-11-04)
- **One music bed shape for both engines** (`config/music-bed.json`, `scripts/bed_shape.py`): no video reaches 3 Posts without its bed-shape receipt (F40). Off days bed on their own rotation in the house mint. (2026-11-04)
- **The failure loop is built:** `engine_incidents` (migration `20261123090000`, applied) records each failure with the piece's preflight receipt; from 9 Nov `ve brief` and `ve render` refuse without one. `engine-learning-weekly.yml` runs Sundays on his subscription; first live run Sunday 15 Nov. (2026-11-04)
- **Known red check:** `npm run verify` passes on the session branch except `tests/quick-edit-mix.test.ts` (`mix_test`, this container's ffmpeg 6.1.1; the repository pins 8.1.2). Migrations `20261116090000_rejections.sql`, `20261116100000_ux_feedback_recordings.sql` and `20261117090000_taste_ventures.sql` are not recorded as applied as of 2026-10-28.

## What changed recently

- 2026-11-05 Series covers and thumbnails wear nine skins, one a week from 9 Nov, in the series' own colour (Krish: "keep all of them and rotate them all at will over the coming weeks"; "Skin the covers too"); a skin that cannot be drawn on any shape moves the whole piece on to the next, said in its records, and the plain series Receipt if none can ("Yeah just move on automatically"); nothing sits on the words or the logos (`scripts/pages/skins/`, `receipt.settle`, `tests/series_skins_test.py`).
- 2026-11-05 The intro sting is back in front of every 16:9 long cut of a weekly series piece, and only there (Krish: "I think it should go at the start of the longer wide videos 100%,"): the six clips he saw on 12 October, byte for byte, pinned by sha256 in `config/intro-sting.json` and filed in the library's brand kit. The tall cut opens on the hook and off days wear none, in both engines (`intro.py`, `make.py`, ve's `VeCut` wrapper, compile, premix, the qc `opening` row); it moves the ve engine hash.
24 more lines of 3 to 5 November are in `docs/history/2026-11-05-NOW-moved-2.md`. Five lines of 3 November are in `docs/history/2026-11-03-NOW-moved-1.md`. Everything to 29 October 2026 is in `docs/history/2026-10-29-NOW-changed-recently.md`, 30 October lines in `docs/history/2026-10-30-NOW-moved-3.md` and `-4.md`, `-5.md` and `-6.md`, and `docs/history/2026-10-31-NOW-moved-1.md`, and `docs/history/2026-11-02-NOW-moved-2.md` and `-5.md`, all verbatim (W2.12); `npm run check:workbench` holds the byte cap. The 28 October waiting line is in `docs/history/2026-10-31-NOW-moved-4.md`, and one 2 November line in `docs/history/2026-11-03-NOW-moved-1.md`, two in `-moved-2.md`, two in `-moved-3.md` and two in `-moved-4.md`, and one 3 November line in `docs/history/2026-11-04-NOW-moved-2.md` and one in `-moved-4.md`. The twelve 4 November closeout notes, as folded, are in `docs/history/2026-11-05-NOW-closeout-fold.md`.


## What is next and what is waiting on Krish

- Next, covers (2026-11-05): merge, then draw the 9 Nov series pieces' covers and thumbnails together (`build.py --cover --thumbs`) once their cover facts exist. The 9 Nov week (board 0e79df54): his Wednesday script press, Growth posts the off days, Saturday's pick on Sunday 8 Nov.
- Next (2026-11-05): dispatch maxine-trial.yml once with take ai-music-short.mp4, clip_seconds 0 and the four diagnostic variants of run 42122881395 (ess2 on the whole take; c10 and c10yaw30 with --input /home/runner/work/_temp/take/c10.mp4; nv with --input /home/runner/work/_temp/take/nv.mp4) to learn what the NIM accepts; then run ve eyeline on the whole take, score it, get a blind review, and send Krish the strips and loop.
- Waiting on Krish (as of 2026-10-29): Control Center's `GITHUB_TOKEN` needs Contents: write and Actions: read on this repository for the make press; whether the $15 cap gets a reader; the Buffer plan (due 31 October); OUR TEST or MY TEST on a video label he presents; "we" in article titles while video titles keep "I".
- Waiting on Krish (as of 2026-10-29, Wave 2 and 3 production): by ear, the levels and a sound-effect set; Gate 2 on face-with-proof frames and six devices; 5 to 10 golden frames; 20 minutes on 9 Nov scoring shadow cuts. His 29 Oct answers and the home-computer steps: the handover above.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- 9 Nov week (2026-11-04): board 0e79df54. Wed and Fri scripts on their tabs (Fri in Teleprompter); Tue and Thu carousels signed off and in 3 Posts; cover rule in the carousel standard. Next: Wed's script press; Growth posts the off days; Sat chosen Sun 8 Nov.
- Krish approved all 20 production standard groups (2026-11-04): 159 floor standards now approved, read first by `floor.py`; the 56 session-process standards stay with the failure loop, whose first live weekly run is Sunday 15 Nov.
- Waiting on Krish (2026-11-04): rate the motion styles. A trial of each on his own footage turns `untested` into liked or not for us; only liked styles lead the picker.
- Thursday lessons done (2026-11-04): all six answers in (`docs/learning/2026-11-04-thursday-killed.md`); off days now bed on the off-day rotation in the house mint.
- North Star check (2026-11-05): holds.

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
