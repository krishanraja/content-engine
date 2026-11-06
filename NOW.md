---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-06
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

## Where it is right now (as of 2026-11-06)

<!-- north-star-state {"week_of":"2026-11-02","week_target":4,"current":2,"current_as_of":"2026-11-05","current_source":"Control Center content_ideas in the publication's series (2 published in the last 7 days)","urgency":3,"urgency_reason":"at 50% of this week's target"} --> **North Star number: U3, well behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 2, against 4 this week, on the way to 30 by 30 November 2026. Two experiments a week, growth output doubled.

- eye contact on the whole 96 s take runs end to end and is accepted by every integrity check, but five blind reviews have not called it commercial grade; the verdicts swung between "close" and "not there yet", which says the reader noise is high; what they agree on is the wide-eyed look at the biggest corrections and some uncorrected frames. This note supersedes now-notes/2026-11-06-maxine-whole-take.md. Fixed and merged on 6 Nov (#436 to #441): the iris is no longer smeared at hard glances (a clean iris of his own, built from his lens-looking frames, laid at Maxine's calibrated lens point inside his own lid line); small corrections are left exactly as they were (gate: none under 0.3 iris radii of move, full from 0.8); the no-op guard asks whether Maxine's copy differs from the take; and a bug from before this session, the YUV-BGR-YUV round trip darkened and warmed every frame the pass wrote (luma down 0.8 to 1.6 levels; fixed by naming the file's matrix and range on the reader and writer, test added, 0.05 level now). Whole take, latest: flicker 0.997, seams 1.0, jitter 0.98, lid ratio 1.00, sharpness 0.99, blinks 10 and 9 (the lost one is a half blink at 0.54 against the 0.5 line), gaze spread 6.2 to 3.6 deg; 2791 of 2880 frames taken from Maxine, 81 head-turned and 8 no-face left alone; the pass takes 5 to 6 min here; Maxine on a rented RTX takes under 4 min for $0.04. Spend on the whole trial about $1.45. Remaining, in order of what the reviews agree on: (1) At the hard glances (5.57 s, 51.67 s, 60.03 s) the eyes read wide and startled: his own lids stay shaped for the sideways glance, so white shows around a centred iris. Commercial tools lower the upper lid as the gaze comes to the lens. Suspected fix: in blend_aperture lower the upper-lid contour by a share of the eye height that grows with the move, filling the revealed area with lid skin. (2) The two irises sometimes disagree in size (51.67 s): take the iris radius from his normal frames per eye, which is done for the clean iris, and check the live-iris path for frames just under the template threshold. (3) Frames with half-lowered lids, squints and downcast eyes (4.0 s, 64.73 s, 72.8 s) are left uncorrected: the lock skips closing eyes (OPEN_MIN, OPEN_REL), and Maxine itself fades out; decide whether to correct them. (4) Reviews flagged the template iris as darker and flatter than his own (40th percentile of the stack): try the 50th with the dark-centroid alignment kept. Each of these is tested on the cached readings in minutes and a whole-take pass is 6 min: render the frames first, then run the whole take. (2026-11-06)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). From 9 Nov one production round: `ve proof` shows the hardest beat moving on his own take, and `ve render` refuses a whole cut until he presses Approve proof; the day tab carries four presses (Sign storyboard with a `ve expect` sheet, Pick a style, Approve proof, Approve cut) in `meta.making.gates`. Five lessons of the killed Thursday 5 Nov cut are guards in `scripts/velib/guards.py`, binding from 9 Nov. (2026-11-04)

## What changed recently

- 2026-11-05 Series covers and thumbnails wear nine skins, one a week from 9 Nov, in the series' own colour (Krish: "keep all of them and rotate them all at will over the coming weeks"; "Skin the covers too"); a skin that cannot be drawn on any shape moves the whole piece on to the next, said in its records, and the plain series Receipt if none can ("Yeah just move on automatically"); nothing sits on the words or the logos (`scripts/pages/skins/`, `receipt.settle`, `tests/series_skins_test.py`).
- 2026-11-05 The intro sting is back in front of every 16:9 long cut of a weekly series piece, and only there (Krish: "I think it should go at the start of the longer wide videos 100%,"): the six clips he saw on 12 October, byte for byte, pinned by sha256 in `config/intro-sting.json` and filed in the library's brand kit. The tall cut opens on the hook and off days wear none, in both engines (`intro.py`, `make.py`, ve's `VeCut` wrapper, compile, premix, the qc `opening` row); it moves the ve engine hash.
- 2026-11-06 the pass now keeps a frame's colour; Maxine's pixels are not used at all, only its lens point.
Older lines are in `docs/history/`: the dated `*-NOW-*.md` files (the latest, `2026-11-06-NOW-moved-2.md`, lists every earlier one) and `LOG.md`.


## What is next and what is waiting on Krish

- Next, covers (2026-11-05): merge, then draw the 9 Nov series pieces' covers and thumbnails together (`build.py --cover --thumbs`) once their cover facts exist. The 9 Nov week (board 0e79df54): his Wednesday script press, Growth posts the off days, Saturday's pick on Sunday 8 Nov.
- Next (2026-11-06): Krish runs a live video tomorrow (maxine-trial.yml, clip_seconds 0, one variant ess2: --bitrate 40000000 --detect-closure 1 --eye-size-sensitivity 2, then ve eyeline --backend maxine --maxine-copy) and notes the timestamps that look wrong; the first fix after that is the upper-lid lowering at the hard glances.
- Waiting on Krish (as of 2026-10-29): Control Center's `GITHUB_TOKEN` needs Contents: write and Actions: read on this repository for the make press; whether the $15 cap gets a reader; the Buffer plan (due 31 October); OUR TEST or MY TEST on a video label he presents; "we" in article titles while video titles keep "I".
- Waiting on Krish (as of 2026-10-29, Wave 2 and 3 production): by ear, the levels and a sound-effect set; Gate 2 on face-with-proof frames and six devices; 5 to 10 golden frames; 20 minutes on 9 Nov scoring shadow cuts. His 29 Oct answers and the home-computer steps: the handover above.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- 9 Nov week (2026-11-04): board 0e79df54. Wed and Fri scripts on their tabs (Fri in Teleprompter); Tue and Thu carousels signed off and in 3 Posts; cover rule in the carousel standard. Next: Wed's script press; Growth posts the off days; Sat chosen Sun 8 Nov.
- Krish approved all 20 production standard groups (2026-11-04): 159 floor standards now approved, read first by `floor.py`; the 56 session-process standards stay with the failure loop, whose first live weekly run is Sunday 15 Nov.
- Waiting on Krish (2026-11-04): rate the motion styles. A trial of each on his own footage turns `untested` into liked or not for us; only liked styles lead the picker.
- Thursday lessons done (2026-11-04): all six answers in (`docs/learning/2026-11-04-thursday-killed.md`); off days now bed on the off-day rotation in the house mint.
- North Star check (2026-11-06): holds.

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
