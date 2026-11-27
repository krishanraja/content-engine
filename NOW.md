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

- The v5 Library's known gate failures fell from 65 to 13 on a draft pull request awaiting Krish's approval of the before-and-after sheet: the safe boxes now follow STANDARD and the carousel and cover margins, the carousel cover hierarchy rule follows the v5 covers, the podcast V4 meets STANDARD 6 and the advice cover's contrast check reads its cream card. (2026-11-27)
- From 27 Nov a video carries one wordmark, S3h on its outro: the wide quick-edit frame and the why-ladder title card draw no V4, no beat carries a series pill, and ve lint and ve render refuse a cut that would; cuts dated before render as signed. (2026-11-27)
- The working-files loop's leftovers are gone for good, with Krish's yes of 27 Nov: the 29,437 retired rows of content_library_files (1,868 ready rows kept), the 14,710 stored files only they used (39,266,945 bytes; the bucket went from 17,154 to 2,444 objects), and content_library_files_unready; the database now refuses "2 Channel art (permanent)/" for every row. (2026-11-27)
- Every close a new render can reach is now the locked v5 look: quick-edit's kit films the Library outro (S3h, Follow for more, makeyourmindup.ai, the climb bars) for pieces dated from 26 Nov, the why-ladder close card ends on S3h instead of V10, and the title lockup drops its retired V10 from 26 Nov. (2026-11-27)
- The Library's static check runs on a clean checkout again: no live part of library.json, library.html, the review page or the guide names a retired cover template, verify_static.py skips the local bank-prompts comparison when that file is absent, and test_locking.py passes; 65 older gate failures in live v5 templates remain, listed in docs/ve/cards/library/verify-static-known.json. (2026-11-27)
- The working-files lane no longer sends its own list or the copy the library sync keeps beside it, so the loop that rewrote five working-files lists in the Two passports post folder every ten minutes since 30 Oct has stopped; find and the by-hash lookup never return a row at a path the library now refuses. (2026-11-27)
- The standards check-in of 2026-11-27 grouped the new floor standards; config/floor-groups.json holds 96 groups, each new one seeded as a proposal for Krish on the pinned check-in page. (2026-11-27)
- The Sunday ideas run now treats step 6d (judges, score, order, stage 2 touches) as part of the run, and its log names how the Claude step ended and which commands it was refused. (2026-11-26)
- The story engine v5 is on main (pull request #1005, merged 26 Nov): the reader Krish approved on 26 Nov, sports on the beat (config/beat.json, Ruling, Krish, 2026-11-25; pull request #997, merged), the story floor, the blind story score with the pre-pick whys probe, close calls and a checked wildcard every Monday, Wednesday and Friday, gated from the 30 Nov board: the Sunday 29 Nov run is the first gated, with every hard floor citing his ruling or a recorded failure and the buyer judge kept as the paying-reader judge. With it came the production cycle's one registry (config/cycle.json, touch.py), impact zoom (config/ve/impact-zoom.json, in ve and quick-edit, each with its camera.impact check) and the 26 Nov split. (2026-11-26)
- Every whole cut dated from 26 Nov now ends on the Library's outro (video-wide-outro, video-vertical-outro, approved in docs/ve/cards/library/lock.json on Krish's delegation and his "1 agreed"), drawn by ve's V5Outro.tsx: S3h, "Follow for more", makeyourmindup.ai and the climb bars, with no tagline, no V10 mark, no days row and no series name; cuts dated before 26 Nov render as they were. No intro sting clip goes anywhere in such a cut (`ve lint` and `ve render` refuse one); series cuts dated 23 to 25 Nov keep the sting close they were signed with (`docs/production/BRAND_PALETTE.md`). This replaces the v5 statement card of pull request #1001, which still drew the V10 mark and the tagline. The learning house-robot-or-no-robot now states the v5 no-robot rule and points at its line in docs/CAROUSEL-STANDARD.md, so the failure register guard is green again. (2026-11-26)
- The Library's YouTube and Facebook profile pictures are now S3h on grained ink, the same avatar-wordmark layout as Instagram at their own sizes and circle crops; the Substack logo stays the D icon. library.html renders from a clean checkout: its fonts load from assets/fonts/makeyourmindup/, and any .scratch review file it cannot find falls back to a drawn SVG stand-in in docs/ve/cards/library/samples/ (make_samples.py), with no photographs and nothing of Krish committed. (2026-11-26)
- Series videos rotate two beds week by week on every series day, Four on the Funky Flour and NO CURVES; Liberty City, Mind Bender, Conclusion, Seize It and the new Movie track go behind carousels; Just Got Real and Drifting Valleys are retired because their files are not in the Music folder, so the live ledger checks clean. (2026-11-26)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-27 docs/ve/cards/library/library.json, library.html (embedded registry), LIBRARY-GUIDE.md, verify_static.py and verify-static-known.json.
- 2026-11-27 config/brand-palette.json marks_rule, scripts/brand_palette.py, scripts/velib/compile.py, guards.py, lint.py, scripts/ve.py, ChannelPill.tsx, StageHeader.tsx, v5/Cards.tsx, v5/Sequence.tsx, props.ts, scripts/quick-edit/kit.py and kit-v5/v5-frame.html, their tests, config/learnings.json, BRAND_PALETTE.md, the produce-video skill, its mirror and references/marks.md.
- 2026-11-27 supabase/migrations/20261227090000_content_library_delete_retired_rows.sql (applied) and tests/control-plane/library-path.test.ts; the 20 "working-files (2) to (5).json" copies moved in Drive to makeyourmindup/_Archive/2026-11-27 working-files loop copies (retired, do not use).
Older lines: `docs/history/2026-11-27-NOW-moved-2.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-27): Krish approves or rejects the sheet; he also chooses the words for the 10 good-news samples and a fix for the 3 meme crops.
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
