---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-19
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

## Where it is right now (as of 2026-11-19)

<!-- north-star-state {"week_of":"2026-11-16","week_target":12,"current":3,"current_as_of":"2026-11-19","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (1 published, and 2 Growth carousels and Shorts that passed the 10/10 judges and went live, in the last 7 days)","urgency":4,"urgency_reason":"at 25% of this week's target"} --> **North Star number: U4, far behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 3, against 12 this week, on the way to 30 by 30 November 2026. A bold swing every day; work that does not move the number waits.

- ve qc and ve lint now measure the Tue 17 and Wed 18 faults on any cut, from one config file of his words and numbers (config/ve/frame-checks.json, scripts/velib/qc_frames.py): one carrier a beat, figures, ghost cuts, flat-black backdrops, the logo rule, off.day text, the title card and its hold, false starts, first-seconds motion, head in frame and bottom right on 16:9. A row that cannot read its render, words or a face detector is not_run, never a pass. (2026-11-19)
- A piece still being made (a proof filed and not answered by him, a production session working on it, or final files waiting on Approve for publish) is never Missed once its day passes: its card keeps its real next step, says its day has passed and offers Move to…. View contract 1.32.0 adds the optional `passed` flag; Control Centre's matching card change is its own pull request. (2026-11-19)
- Wed 18 build-or-buy (db9f9f6a) post-production on ve is well along but not filed as finished cuts. Both cuts are specced and lint clean. Short: 16 beats, no split frames, his whole head full frame on his lines, the hook a continuous Higgsfield clip (80 credits, "go 80"), a title card that slams in over his hair as he says the title, rack-focus captions with a letter halo, each proof beat on its own page as a blurred full-frame backdrop. Long: 27 beats on the long master's word clock, bedded on Make up Your Mind (Instrumental) through the new per-cut bed (Mind Bender looped under 4:55 loses its loud open). The short's second full render failed QC (captions over his face, sparse proof frames, page text under 40 px, phrase breaks): the fixes since (full halo over his take, page backdrops, compile weighing mid-phrase breaks, the web address joined) pass on beat proofs, and a third full render needs his press (two per proof press). The article is written (1,390 words, voice 0.0, AI scan pass, three figures, nine sources filed word for word); the fact gate's third paid run waits on his words (guard G3). The written edition is filed. The post folder in 3 Posts is made and bound, holding the article, written edition and three figures. Packaging is drafted; thumbnail words wait on his pick. (2026-11-18)
- A production or Publish session on a piece with no schedule date of its own (an off-day meme or carousel the board placed) could not report to the board: every report was refused as piece_not_scheduled, so the card never moved and the Publish prompt looped. Every board prompt now names the week and day beside the piece id, which the report call needs. (2026-11-19)
- the Critic's two blocking questions are now asked while the spec and cards are written, not after the render. `ve critic --pre <piece>` (verdict.pre.json, bound to the spec's hash) is required by `ve card` and `ve lint` (critic.pre) for a piece published from 19 Nov; `ve lint` idea.one_object reads the idea's content (a move that acts out the line; more than 4 different generated pictures with no persisting carrier); `ve card` writes the spec's never-list into every card and refuses a quoted on-screen figure the piece does not own (numbers.invented); `ve verify-card` reads the numbers off what Codex made (not_run when tesseract is absent). The thresholds (4 pictures, 60% carrier, the acts-out phrases) are in config/ve/production-guards.json and are Krish's to change. (2026-11-18)
- covers and thumbnails have one stated owner, content-engine's production session (cover-art, thumbnail-designer, a separate critic), with Krish picking and Growth only posting and verifying; the one post-production prompt now says so and ends with `piece_manifest.py draft`, which refuses a video channel with no designed cover, so no manual ask is needed anywhere. docs/production/COVER-STANDARD.md has the owner table. (2026-11-18)
- **StyleStill covers: 47 of 48 passed a separate review and are filed and recorded for the board's style pickers** (`config/ve/style-samples.json`). Eight came from Codex's second pass, 24 from its third, and 15 of the 16 held back from its fourth, after the reviewer's five named faults were fixed (`82360c9b`: line-boil passes too thick to read as three lines, receipt and living-ui labels ink on ink, the data story's chart now the sourced monthly sales indexed 100 to 107, flip-hinge sampled with its key word lit). slot-roll stays held: its uneven word gap is in the caption theme itself (`c631e0ac`). (2026-11-16)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-19 scripts/velib/qc_frames.py, config/ve/frame-checks.json, scripts/velib/qc.py, scripts/velib/guards.py, scripts/ve.py, tests/ve_frame_checks_test.py, tests/ve_qc_modules_test.py, config/failures.json, docs/ve/ENGINE.md.
Older lines: `docs/history/2026-11-19-NOW-moved-2.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-19): Krish confirms the first thresholds in config/ve/frame-checks.json (listed in the pull request); the show gate that makes these rows a condition of showing him a proof is the other fork's.
- House close (2026-11-10): kit and ve close on the statement card, "Built to help you decide." (`docs/production/CLOSING.md`). Krish approved the engine change for Wed 11 Nov (`docs/plans/2026-11-11-wednesday/ve/engine-exceptions.json`). He hears the first cut with it at full size.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-19): holds.

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
