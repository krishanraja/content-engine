---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-28
head: a35e3a9
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

## Where it is right now (as of 2026-11-28)

<!-- north-star-state {"week_of":"2026-11-23","week_target":20,"current":0,"current_as_of":"2026-11-27","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (0 published, and 0 derived carousels and Shorts content-engine made and Growth posted that passed the 10/10 judges and went live, in the last 7 days)","urgency":5,"urgency_reason":"under 40% of the week's target two weeks running (0% now)"} --> **North Star number: U5, stalled.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 0, against 20 this week, on the way to 30 by 30 November 2026. Everything else pauses unless it moves the number.

- The news hub has three trend lanes above its six sectors (money, behaviour, technology): checked stories each and a line of what is moving and why, gated against those stories, in the edition as snapshot.trends. The Sunday gather reads them, and from the 14 Dec board every idea, memes and carousels included, names the dated trend it follows (config/trend-tie.json). makeyourmindup.ai does not show the trends yet. (2026-11-28)
- The daily news hub behind makeyourmindup.ai spends from an allowance of its own, $15 a week and at most $2.50 an edition, outside the $15 chain cap. Each edition is metered by its run id in meter_events, and the chain cap takes those rows out. (2026-11-28)
- The 7 Dec ideas board is on the live board: 7 Monday, Wednesday and Friday options, each with a business lens (Krish's 27 Nov ruling, businesses first and under the hood), 10 Tuesday and Thursday options, 9 meme templates and 5 Saturday good-news carousels. The gate passes every check except the humour floor of 11 memes and shorts, which land marked on their cards as humour not read or not passed, by Krish's choice on 28 Nov. (2026-11-28)
- The 7 Dec ideas board is scored and ordered on branch claude/kind-allen-lrvme1 (docs/plans/2026-12-07-week/ideas.json: 8 hero options across Mon, Wed and Fri; 10 Tue/Thu options; 9 meme templates; 5 Saturday good-news carousels). After the 28 Nov rerun every hero and carousel passes the gate; only 11 memes and shorts still lack a humour reading, because the humour engine rejects them on grounding. It is not on the live board yet and waits on Krish's call. The daily news hub behind makeyourmindup.ai has stored no edition since it was built: the week's chain spend was $22.62 against the $15 cap, so the editorial stage refused, the refusal was swallowed as "no stories", and the site has shown its frozen 26 Nov snapshot ever since. (2026-11-28)
- The 7 Dec ideas board is fully drafted and on main since 28 Nov (#1021; docs/plans/2026-12-07-week/ideas.json: 8 hero options across Mon, Wed and Fri, each past two whys probes; 10 Tue/Thu options; 9 meme templates; 5 Saturday good-news carousels), with floor, read-backs, repeat review, wildcard distances, blind judges, score and order done. board_feed.py gate still refuses it, so it is not on the live board: the humour engine returned no reading for 264 of 278 reads and then hit Control Center's daily humour cap, and the divergence engine's judged angle score returned usefulness and specificity for only one angle per option, so no hero has a sound angle. Two engine fixes landed with it: lookalike.py prepare now carries the sheet's newest 30 carousels (the Saturday rule could never pass on the backfill rows), and week_plan.min_ideas honours thin_week. (2026-11-27)
- The v5 docs teach a cold session the rebrand: the North Star says the engine serves makeyourmindup, not Mindmake, with Krish's approved positioning lines (27 Nov 2026); the marks, the music rotation, the Saturday footnote exception, the tall cut with no dress and the retired day colours read as v5 everywhere they are named. (2026-11-27)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-28 config/hub-sources.json trends; lib/hub feeds, editorial, snapshot, types and pipeline; scripts/post-pack/trend_tie.py in board_feed.py's gate; plan-week's beat reference.
Older lines: `docs/history/2026-11-28-NOW-moved-3.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-28): Show snapshot.trends on makeyourmindup.ai (krishanraja/makeyourmindup apps/cover), once the first edition with trends is stored.
- House close (2026-11-26): every whole cut dated from 26 Nov closes on the Library's outro (`docs/production/BRAND_PALETTE.md`, "The series close"); `docs/production/CLOSING.md` describes the 10 Nov statement card that cuts dated before 26 Nov keep. He hears the first cut with the outro at full size.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-28): holds.

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
