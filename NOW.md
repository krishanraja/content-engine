---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-09
head: a07ea4e
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

## Where it is right now (as of 2026-11-09)

<!-- north-star-state {"week_of":"2026-11-09","week_target":8,"current":3,"current_as_of":"2026-11-09","current_source":"Control Center content_ideas in the publication's series (3 published in the last 7 days)","urgency":4,"urgency_reason":"at 38% of this week's target"} --> **North Star number: U4, far behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 3, against 8 this week, on the way to 30 by 30 November 2026. A bold swing every day; work that does not move the number waits.

- Claude sessions in this repo load the Codex plugin (codex@openai-codex), and .claude/settings.json no longer denies git pushes to main or force pushes. (2026-11-09)
- The 9 Nov board is live on layout v4 (build 2c5c124b, revision 26, 9 stored files, read back), published by Board rebuild run 42475151020 on Krish's yes; on a phone its long blocks fold to their titles, nothing is cut off, and its fonts are the brand fonts. (2026-11-08)
- The 9 Nov board's rebuild recipe no longer gives this week's Ideas list: every series day is picked, and the 7 Nov gather found inspiration cards saved after 2 Nov that belong to next Sunday's ideas; the Ideas tab says the week is picked. (2026-11-07)
- post-mortem of the 2 Nov week written; board v4 and pre-production sheet proposed with a mockup; 9 Nov outstanding listed. (2026-11-07)
- Publish board v4 is built and checked (PR #465): the Desk, seven stages on every day Mon to Sat, the Creative step with Sign creative, Scores for every post, Last week and bugs on their post; the live 9 Nov board is not rebuilt yet (the engine API is 401 from a cloud session). (2026-11-07)
- Saturday's good news is found on Thursday by its own run, .github/workflows/saturday-goodnews.yml (Claude Code in GitHub Actions on his subscription, 10:41 and 19:23 UTC Thursday, idempotent, startable by hand), the one exception to zero Claude schedules beside the Sunday ideas run; the Sunday run no longer finds the stories. (2026-11-07)
- The 6 Nov reel's three visual bugs and Wed 4 Nov's unreadable phone are checks (F41 to F44): ve lint and ve qc refuse a mark that names no words, sits over the hand-held phone or misses its words; a caption page that repeats the headline or ends mid-phrase; evidence words under 40 px on 9:16; channel_safe --shape cover_tall adds Instagram's 3:4 grid crop and account row (listed by produce-day). They bind pieces published from 14 Nov, advisory before, outside the engine hash (Wed 11 and Fri 13 unchanged). (2026-11-07)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). From 9 Nov one production round: `ve proof` shows the hardest beat moving on his own take, and `ve render` refuses a whole cut until he presses Approve proof; the day tab carries four presses (Sign storyboard with a `ve expect` sheet, Pick a style, Approve proof, Approve cut) in `meta.making.gates`. Five lessons of the killed Thursday 5 Nov cut are guards in `scripts/velib/guards.py`, binding from 9 Nov. (2026-11-04)

## What changed recently

- 2026-11-09 Codex plugin enabled for cloud sessions; push-to-main and force-push denies removed at Krish's request.
- 2026-11-07 Fri 13 Nov pre-production sheet sent to Krish before any build (`docs/plans/2026-11-09-week/fri-preproduction/creative.json`).
- 2026-11-07 Krish, 2026-11-07: "I think we should redesign the 9th of November board as well."
Older lines are in `docs/history/`: the dated `*-NOW-*.md` files (the latest, `2026-11-09-NOW-moved-6.md`, then `2026-11-09-NOW-moved-5.md`, `2026-11-07-NOW-moved-4.md` and `2026-11-06-NOW-moved-3.md`, which keeps the full list of earlier ones) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-06): put the original zip in Production Inspo from a home computer, then dispatch ve-kf-1-caption-build between pieces.
- Wed 11 Nov creative sheet (2026-11-07): the pre-production sheet for the Reiki master's No. 2 hit is with Krish as files (opener and close with two alternative hooks from his own take, three caption treatments on the safe zones and grid crop, three motion loops on his footage, the credit stack as the one idea with its never-list, storyboards for both cuts, three thumbnails in his grid and a YouTube row); picks in `docs/plans/2026-11-11-wednesday/creative.json`, his recorded words against the script in `words-against-script.md`. Waiting on Krish: Sign creative. Nothing is built until he signs; then ve expect, ve proof of the Grammys split, his Approve proof.
- Fri 13 Nov pre-production sheet (2026-11-07): both takes on the making record (Recorded: done); takes heard against the script (`docs/plans/2026-11-09-week/fri-takes-vs-script.md`: short take says "delegate" for "delete" and adds an unsupported "AI costs halved"; long take calls Hanoi "exaggerated" and changes the close line); the held 4 Nov send closed honestly (sent 06:46 on his words, no reader read-back ever passed). Sheet A to G sent to Krish as files and written as `docs/plans/2026-11-09-week/fri-preproduction/creative.json`. Waiting on Krish: Sign creative, and the 4-second pickup for "delete". Nothing is built before he signs.
- 16 Nov week (2026-11-07): Ideas tab live (run 42392494486). Next: the Sunday room on his presses; good-news stories Thu 19 Nov.
- Waiting on Krish (as of 2026-10-29): Control Center's `GITHUB_TOKEN` needs Contents: write and Actions: read on this repository for the make press; whether the $15 cap gets a reader; the Buffer plan (due 31 October); OUR TEST or MY TEST on a video label he presents; "we" in article titles while video titles keep "I".
- Waiting on Krish (as of 2026-10-29, Wave 2 and 3 production): by ear, the levels and a sound-effect set; Gate 2 on face-with-proof frames and six devices; 5 to 10 golden frames; 20 minutes on 9 Nov scoring shadow cuts. His 29 Oct answers and the home-computer steps: the handover above.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- 9 Nov week (2026-11-04): board 0e79df54. Wed and Fri scripts on their tabs (Fri in Teleprompter); Tue and Thu carousels signed off and in 3 Posts; cover rule in the carousel standard. Next: Wed's script press; Growth posts the off days; Sat chosen Sun 8 Nov.
- Krish approved all 20 production standard groups (2026-11-04): 159 floor standards now approved, read first by `floor.py`; the 56 session-process standards stay with the failure loop, whose first live weekly run is Sunday 15 Nov.
- Waiting on Krish (2026-11-04): rate the motion styles. A trial of each on his own footage turns `untested` into liked or not for us; only liked styles lead the picker.
- Thursday lessons done (2026-11-04): all six answers in (`docs/learning/2026-11-04-thursday-killed.md`); off days now bed on the off-day rotation in the house mint.
- North Star check (2026-11-09): holds.

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
