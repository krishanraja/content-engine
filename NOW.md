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

- Both Fri 20 Nov cuts pass ve lint under main's new piece guards, and the pre-show review passes on this spec. The short's face beats are SPLIT with chips of his own words; the long cut uses the new pillar staging (his vertical take whole on the right of 16:9, Krish's pick), with chips on its face beats. The site address is one word in both cuts, and an art-directed cut gives an over-wide word a caption page of its own. (2026-11-19)
- No article, script or cut needs a prediction any more (Ruling, Krish, 2026-11-19). The publish checks CALL, CALL_HORIZON and CLEAR_STANCE pass a piece that carries none; house rules CALL, CLEAR_STANCE and SHARP_PREDICTION reach no writer or judge; scripts end on the answer and the close; ve no longer requires a call on mind.the.gap. A piece carries one only when Krish asks on that piece (meta.prediction { wanted, said, on }, or spec.call in a ve spec he signs), and then it is held to the old standard. (2026-11-19)
- The Fri 20 Nov piece (c00cd4e0) has its article on the piece: 1,391 words, reading age 12, four inline figures with no brand mark. Nine verbatim sources are filed and one paid fact check ran ($0.99). The dated call is optional in ve and waived for this piece by Krish's word. Both cuts now fail main's new piece guards (talking head over 20%, the short's hindsight window, the short's site address), so no proof has gone to Krish. (2026-11-19)
- Word (.docx, .doc), PowerPoint (.pptx) and Excel (.xlsx) files can be filed on every piece; PDFs and Markdown already could. The live library bucket takes the new types (applied and read back 19 Nov). (2026-11-19)
- Article figures are guarded. An inline Substack figure carries no mark, names one picture form (source-page, scale, timeline, ledger, map, comparison) with at most 40 words of running text, and says nothing the article does not; scripts/pages/render_figure.mjs runs scripts/pages/figure_check.py first and draws no refused figure. The 25 old figure pages under docs/plans lost their typed mark; make-piece's Reader test row now orders the work (draw, the three checks, the reader test, then Krish). (2026-11-19)
- Until a piece's lock is signed, its Claude prompt names every research item on file by id as the corpus the narrative is built from, traced with the 5 Whys and made fun to consume (_corpus.ts, the one place; Re-run the narrative copies the same prompt). Research filed on a piece already reaches Drive's 6 Research library by itself; a test now pins that images and PDFs filed as research go there too. (2026-11-19)
- Fri 20 Nov (c00cd4e0, "AI finds the skeletons in your closet") in post-production. Both masters cut and in sync (short 85.1 s, long 4:25, worst drift 8 ms); both cuts specced and passed by a separate pre-Critic; 13 stills and 11 clips generated within Krish's 703.75 of 710 approved Higgsfield credits; takes and his thumbnail words on the record. Engine fixes from the first proof through the new show gate: frame guard off-by-one, proof excerpt measured as its own window, halo on every caption style over his take, his face framed 1.1x higher on tall cuts (his "Halo + frame me higher"), Wire H test pinned to its own day. Face-led cover card queued for Codex once main has it. (2026-11-19)
- Saturday offers only good-news carousels, three or more, each five great things AI is doing for people with who each helps and how (smarter, better, happier, more successful), topics may mix, no lead theme of the last four Saturdays, never medicine-led after a month of medical stories (the Sunday run's gate, code goodnews, and the board holds a non-good-news Saturday option with the reason). Every week's ideas board carries the meme templates (last week's unanswered ones are carried), and an idea that is already approved or in work on any week leaves the board ("Already in work"). (2026-11-19)
- The brand close card's SUBSCRIBE FREE line is 26 px on both shapes (was 24 px, which read 17 px tall, under ve qc's 18 px small-text floor), so a whole cut's own close no longer fails composition small_text. The house golden is redrawn for the three recorded cuts that end on it. (2026-11-19)
- **StyleStill covers: 47 of 48 passed a separate review and are filed and recorded for the board's style pickers** (`config/ve/style-samples.json`). Eight came from Codex's second pass, 24 from its third, and 15 of the 16 held back from its fourth, after the reviewer's five named faults were fixed (`82360c9b`: line-boil passes too thick to read as three lines, receipt and living-ui labels ink on ink, the data story's chart now the sourced monthly sales indexed 100 to 107, flip-hinge sampled with its key word lit). slot-roll stays held: its uneven word gap is in the caption theme itself (`c631e0ac`). (2026-11-16)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-19 ve gains the pillar staging and a recording's frame on assets; compile pages an over-wide word alone under art-directed captions; the take_orientation guard accepts the pillar.
Older lines: `docs/history/2026-11-19-NOW-moved-12.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-19): Compile both cuts, render the short proof, check it at full size, run ve qc and the separate Critic, then the show receipt for Krish's Approve proof.
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
