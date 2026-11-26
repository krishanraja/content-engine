---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-26
head: f03dcbc
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

## Where it is right now (as of 2026-11-26)

<!-- north-star-state {"week_of":"2026-11-23","week_target":20,"current":1,"current_as_of":"2026-11-25","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (0 published, and 1 Growth carousels and Shorts that passed the 10/10 judges and went live, in the last 7 days)","urgency":5,"urgency_reason":"under 40% of the week's target two weeks running (5% now)"} --> **North Star number: U5, stalled.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 1, against 20 this week, on the way to 30 by 30 November 2026. Everything else pauses unless it moves the number.

- Drive's makeyourmindup brand lives in one folder, 1 Brand kit (permanent), the v5 kit unpacked from makeyourmindup's brand-kit zip; 2 Channel art (permanent) is retired and the engine, post pack and library sync refuse it (channel art is 1 Brand kit (permanent)/Channel art). Four on the Funky Flour is the main music track under every video (music.py main_first). The video font kit's data face is DM Mono. scripts/pages/brand.py reads the v5 marks from this repository instead of the old site PNGs, and channel-kit refuses to run. (2026-11-26)
- The 06:00 UTC hub edition now asks makeyourmindup.ai to announce the new edition, the home page and the six desks to IndexNow (Bing, whose index feeds ChatGPT search and Copilot) right after the snapshot saves. The step is additive: it never fails or repeats the edition, and it skips until MAKEYOURMINDUP_INDEXNOW_SECRET is set. (2026-11-26)
- The hub serves past editions. GET /api/hub/today?date=YYYY-MM-DD returns a published day's edition (404 when none) and ?archive=1 lists every edition date, so makeyourmindup.ai can give each day a permanent, indexable page. (2026-11-26)
- The week fixture follows the v5 caption choices. The proof and cover guards use the live formats, and a missing FFmpeg reports an advisory error without stopping a cut. (2026-11-26)
- The makeyourmindup v5 look is locked. The 122-template Library, brand book words, reskin plan and identity studies are here as proposals (draft PR #977). The Library is not agreed with Krish. The engine lock-out is draft PR #976 and its CI is red. The rebrand serves subscriber growth through a clearer front door. Nothing has published. (2026-11-25)
- Covers, thumbnails and carousels now fill from the approved Library with scripts/library/make_piece.py; the v5_feed skin and the old Receipt cover path are retired behind --legacy. The Library gates still hold open template conflicts (wordmark on colour, why-card caption gaps, the 160 px colour floor) that need Krish's call, and the Receipt covers wait on the image-led cover redesign. (2026-11-26)
- The image-led renderer keeps the approved artwork. The 160 px gate now measures headline or figure cap height and local contrast on wides and applies the 10% colour floor to 9:16 and carousel covers. The three historical pieces have review HTML. Their exports and pixel checks are pending. (2026-11-26)
- The v5 why-ladder cards and house captions are wired into the renderer in both aspect ratios. The pop-song fixture uses the original Spotify document. (2026-11-25)
- The v5 tokens, vector marks, feed cover and retirement gates are in the look/v5-lockout worktree. Cover appearance awaits browser review. (2026-11-25)
- The daily creative edition pipeline is implemented for local review. The cover can read a versioned snapshot and keep its last good edition through an upstream failure. (2026-11-26)
- Story-arc cards make no prediction: where_this_goes now holds the landing, what the arc shows plus one open question ending in a question mark (compose prompt, card lint and arc score), and the lint refuses a forecast to a date, stated odds or confidence, and a landing with no question (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of everything that suggests predictions, calls, dated, odds or scores). The score's forward_claim component is now landing, same weight; stored cards keep the field name and still read. (2026-11-25)
- The 5 Whys is live (PR 970; Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of everything that suggests predictions, calls, dated, odds or scores). The three venture_formats mandates are why-ladder mandates with THE BEAT, the claim_scoreboard and claims_due views are dropped, and control-center's pillar:creative_economy is live with the shared avoid list on all six pillars; all applied 2026-11-25 on Krish's yes and checked on the live rows. (2026-11-25)
- The control plane carries no prediction machinery (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of everything that suggests predictions, calls, dated, odds or scores). The CALL, CALL_HORIZON and CLEAR_STANCE checks, the 19 Nov opt-in, the confidence guard, the fact gate's forecast set-asides, packages/contracts/src/call.ts, the scoreboard, the call-market and odds routes and the claims sweep and its two crons are gone, and every reader of venture_formats.mandate drops the old prediction close as it reads the row. (2026-11-24)
- The creative beat is in code. config/beat.json holds Krish's focus sectors (media, entertainment, arts, music, creator tech, their economics included), the avoid list (governance, regulation, security, privacy, breaches, enterprise productivity with no creative angle), his 24 Nov words and the model piece. The headline gate (_beat.ts), the feed ingest (pool governance and security lanes dropped as off_beat unless the headline is in a focus sector), the relevance classifier, the lens radar's searches, the editorial radar's prompt, the creator moves grounding, the Sunday gate (off_beat, from the 30 Nov board) and the plan-week skill read it. Creative tools and platforms (YouTube, Midjourney, Runway, Sora, Veo, ElevenLabs, Adobe and others) are a focus row, a rollout verb is not enterprise by itself, and the Sunday gate reads the focus angle from the topic alone. The beat mandates migration (20261224091000_mandates_creative_beat) was applied 2026-11-25 on Krish's yes, with the 5 Whys mandates (`699bb736`). (2026-11-24)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-26 Krish, 2026-11-26, asked for makeyourmindup.ai to be the most discoverable page by search and AI engines and handed that to Growth. This moves the publication's subscriber North Star through discovery; it does not move this repository's asset count.
- 2026-11-25 the call, its checks, odds, the scoreboard routes and crons are gone; research files a sourced why-ladder (meta.whys), WHY_LADDER blocks approval on a filed ladder, and the Short ends on the landing card bound from it.
Older lines: `docs/history/2026-11-26-NOW-moved-1.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-26): After the library sync unpacks the v5 kit, check Drive's 1 Brand kit (permanent) holds it and nothing old outside _Archive.
- House close (2026-11-10): kit and ve close on the statement card, "Built to help you decide." (`docs/production/CLOSING.md`). Krish approved the engine change for Wed 11 Nov (`docs/plans/2026-11-11-wednesday/ve/engine-exceptions.json`). He hears the first cut with it at full size.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-26): holds.

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
