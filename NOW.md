---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-27
head: 68a84e7
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

The content engine is the production team behind makeyourmindup, the publication at makeyourmindup.ai: it finds what is worth saying, judges it with a blind panel, drafts it to the right subchannel's mandate, and turns it into the hero assets (the article, both cuts, thumbnails and covers), while Krish makes every decision that matters and nothing publishes itself. It is a Make Your Mind Up product, not a Mindmake one (Ruling, Krish, 2026-10-28); its `plan-week` is the one ideation path, and it runs makeyourmindup's kill list from a pinned copy (`vendor/makeyourmindup/kill-list/`).

Two halves share one Supabase database: the content engine (`apps/control-plane`, its own Vercel project: the judges, drafting, the fact gate, the publish board, the ledger) and production (`scripts/ve.py`, the video engine; `scripts/quick-edit`, the fallback; `apps/renderer`; the Studio in `packages/` and `apps/runner`). Control Center is the desk Krish works at, and its Content tab holds the one live Publish Board, the one surface he presses on (Ruling, Krish, 2026-11-11; the old board pages redirect to it since 2026-11-13). The publication has three subchannels, follow.the.money, mind.the.gap and under.the.hood, each held to a mandate in the database (`docs/NORTH_STAR.md`). This repository makes every asset, only from the locked v5 Library (the hero pieces, carousels, memes, Notes, per-channel words, covers, thumbnails and the weekly edition's package; `config/asset-routes.json`), and hands Growth-MakeYourMindUp finished, approved assets; Growth posts, schedules, distributes and measures them and reports performance back (Ruling, Krish, 2026-11-26; `docs/GROWTH-HANDOFF.md`, which supersedes the 26 and 28 October split).

## Who it is for and why it matters for Mindmake

The engine is internal: it is how the publication reaches its reader, the people who make the calls or make the work in the creative, arts, music, entertainment, media and sports industries (the reader Krish approved on 26 Nov, `config/beat.json` and `docs/NORTH_STAR.md`). The face in `apps/control-plane/api/_mission.ts` (leaders of PE and VC backed media, adtech and data businesses) is Mindmake's reader, not the publication's. What it proves to that reader is that one person can run a publication with an AI production team and stay the editor: the machine proposes and shows its working, the person decides, and the machine learns only from what the person decided.

Stories a writer can carry without asking Krish:

- **Nobody was grading the judges.** The view comparing each judge with Krish's decision returned zero rows for two weeks, because no screen sent the panel's run id with his decision (`docs/STATE.md`).
- **Every mechanical check passed and the video was still rejected.** Eleven QC checks passed on the first ve proofs; Krish: "the visuals look like Microsoft Excel from 20 years ago". Design became a gate of its own (`config/failures.json`, F19).
- **Fewer rules, not more.** After weeks of one-piece rules, Krish asked for the engine to "know what kind of thing doesn't fly with me": the hard blocks shrank to eight nevers he confirmed, and everything else guides or is tested on engagement (`docs/production/THE_BAR.md`).

Objection it answers: "AI content is slop." Here is an engine that grades its judges against the editor, refuses to ship beneath his recorded rejections, and never counts its own actions as taste.

## Where it is right now (as of 2026-11-27)

<!-- north-star-state {"week_of":"2026-11-23","week_target":20,"current":0,"current_as_of":"2026-11-27","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (0 published, and 0 derived carousels and Shorts content-engine made and Growth posted that passed the 10/10 judges and went live, in the last 7 days)","urgency":5,"urgency_reason":"under 40% of the week's target two weeks running (0% now)"} --> **North Star number: U5, stalled.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 0, against 20 this week, on the way to 30 by 30 November 2026. Everything else pauses unless it moves the number.

- The 7 Dec ideas board is fully drafted on branch claude/kind-allen-lrvme1 (docs/plans/2026-12-07-week/ideas.json: 8 hero options across Mon, Wed and Fri, each past two whys probes; 10 Tue/Thu options; 9 meme templates; 5 Saturday good-news carousels), with floor, read-backs, repeat review, wildcard distances, blind judges, score and order done. board_feed.py gate still refuses it, so it is not on the live board: the humour engine returned no reading for 264 of 278 reads and then hit Control Center's daily humour cap, and the divergence engine's judged angle score returned usefulness and specificity for only one angle per option, so no hero has a sound angle. Two engine fixes ride on the branch: lookalike.py prepare now carries the sheet's newest 30 carousels (the Saturday rule could never pass on the backfill rows), and week_plan.min_ideas honours thin_week. (2026-11-27)
- The v5 docs teach a cold session the rebrand: the North Star says the engine serves makeyourmindup, not Mindmake, with Krish's approved positioning lines (27 Nov 2026); the marks, the music rotation, the Saturday footnote exception, the tall cut with no dress and the retired day colours read as v5 everywhere they are named. (2026-11-27)
- Krish, 27 Nov: "My ideas board has become a little bit too focused on individual creators and not enough on what it was before, which is businesses and, under the hood, how AI is changing things." config/lens.json (beside config/beat.json, so the blind proof's frozen engine files stay unchanged) sets a lens: inside the same focus sectors and reader, every Monday, Wednesday and Friday option leads on a business (or the AI firms and markets they run on) and says what AI changes in how it works; one creator or one creator tool's feature leads at most one option a day. The Sunday gate refuses the day otherwise (code lens, scripts/post-pack/lens.py, from the 7 Dec board, made by the Saturday 28 Nov run; his own ideas and Inspiration ticks are never checked); the radar's brief and the plan-week skill say the same. On the 30 Nov board it would have refused Wednesday (Suno Bridge, TikTok's face check for creators, the folk song) and Friday (the designer survey, the AI film, the AI music award). The video sign-offs were checked against today's standards: 8 of 12 golden frames and all 4 Gate 2 stills showed the corner logo, the series label, the old close card or a prediction, so they are retired with their reasons (config/ve/sign-offs.json retired) and Gate 2 is off his board; each card now says what he is looking at, what Approve and Not this change and what happens if he never presses, and when it was last checked. (2026-11-27)
- The five good-news story samples in the Library carry the short headlines approved on 27 Nov, with their mint phrases, and the 21 Nov deck's own lines and sources. verify_static.py reports 4 known failures (3 memes, the good-news cover). (2026-11-27)
- The v5 Library's known gate failures fell from 65 to 13 on a draft pull request awaiting Krish's approval of the before-and-after sheet: the safe boxes now follow STANDARD and the carousel and cover margins, the carousel cover hierarchy rule follows the v5 covers, the podcast V4 meets STANDARD 6 and the advice cover's contrast check reads its cream card. (2026-11-27)
- From 27 Nov a video carries one wordmark, S3h on its outro: the wide quick-edit frame and the why-ladder title card draw no V4, no beat carries a series pill, and ve lint and ve render refuse a cut that would; cuts dated before render as signed. (2026-11-27)
- The working-files loop's leftovers are gone for good, with Krish's yes of 27 Nov: the 29,437 retired rows of content_library_files (1,868 ready rows kept), the 14,710 stored files only they used (39,266,945 bytes; the bucket went from 17,154 to 2,444 objects), and content_library_files_unready; the database now refuses "2 Channel art (permanent)/" for every row. (2026-11-27)
- Every close a new render can reach is now the locked v5 look: quick-edit's kit films the Library outro (S3h, Follow for more, makeyourmindup.ai, the climb bars) for pieces dated from 26 Nov, the why-ladder close card ends on S3h instead of V10, and the title lockup drops its retired V10 from 26 Nov. (2026-11-27)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-27 The Instagram inspo sheet's newest 100 rows held no carousel, so no Saturday option could pass the gate; prepare now adds the newest 30. The cover check asked every hero day for four options even on a thin week; it now reads the thin minimum.
Older lines: `docs/history/2026-11-28-NOW-moved-1.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-27): Once the humour cap resets, rerun story_score.py humour and angles --judge for the week of 7 Dec, then score, order --fresh --write and board_feed.py gate; land the week only when the gate passes.
- House close (2026-11-26): every whole cut dated from 26 Nov closes on the Library's outro (`docs/production/BRAND_PALETTE.md`, "The series close"); `docs/production/CLOSING.md` describes the 10 Nov statement card that cuts dated before 26 Nov keep. He hears the first cut with the outro at full size.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-27): holds.

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
