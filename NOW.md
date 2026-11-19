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

<!-- north-star-state {"week_of":"2026-11-16","week_target":12,"current":4,"current_as_of":"2026-11-18","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (2 published, and 2 Growth carousels and Shorts that passed the 10/10 judges and went live, in the last 7 days)","urgency":4,"urgency_reason":"at 33% of this week's target"} --> **North Star number: U4, far behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 4, against 12 this week, on the way to 30 by 30 November 2026. A bold swing every day; work that does not move the number waits.

- A production or Publish session on a piece with no schedule date of its own (an off-day meme or carousel the board placed) could not report to the board: every report was refused as piece_not_scheduled, so the card never moved and the Publish prompt looped. Every board prompt now names the week and day beside the piece id, which the report call needs. (2026-11-19)
- the Critic's two blocking questions are now asked while the spec and cards are written, not after the render. `ve critic --pre <piece>` (verdict.pre.json, bound to the spec's hash) is required by `ve card` and `ve lint` (critic.pre) for a piece published from 19 Nov; `ve lint` idea.one_object reads the idea's content (a move that acts out the line; more than 4 different generated pictures with no persisting carrier); `ve card` writes the spec's never-list into every card and refuses a quoted on-screen figure the piece does not own (numbers.invented); `ve verify-card` reads the numbers off what Codex made (not_run when tesseract is absent). The thresholds (4 pictures, 60% carrier, the acts-out phrases) are in config/ve/production-guards.json and are Krish's to change. (2026-11-18)
- covers and thumbnails have one stated owner, content-engine's production session (cover-art, thumbnail-designer, a separate critic), with Krish picking and Growth only posting and verifying; the one post-production prompt now says so and ends with `piece_manifest.py draft`, which refuses a video channel with no designed cover, so no manual ask is needed anywhere. docs/production/COVER-STANDARD.md has the owner table. (2026-11-18)
- a post's Drive folder now follows its day whenever a Growth or Buffer-sweep report touches the placed item (renamed by its ID to the item's date and day, recorded in `followed`), not only at the press that moves it; the board also reads the item's own drive_folder as the option's folder. The Thu 19 post's Tue 17 folder will be renamed on the next report (within 15 minutes of the deploy). (2026-11-18)
- a post that moved day now shows the files in its Drive folder (the folder is dated for the day it was first made for; the board now also takes a folder of another day of the week when an option names it or its title is in exactly one option's title), and the files stay on the card when it is Scheduled or Live. Thu 19 "Free ChatGPT has ads now" was really scheduled on Instagram for Fri 20 with its eight cards; the board just could not see its folder. (2026-11-18)
- Tue 17 data-centres piece (b019dbf8): both cuts specced, conformed, mixed (Aspire 15% under the house bed) and rendering in full on the engine Krish approved on 18 Nov: one picture per beat in one shared grade with a focus rack, no face ghost in a dissolve, no logo or off.day tag in the body, the wordmark on the title frame and the close card, the episode title built from his own line. Short 85 s; long 5 min 19 s (two restarts kept as said where no quiet allowed a cut, flagged to Krish). (2026-11-18)
- Migration 20261206090000_taste_evidence_reference.sql written, not applied: it adds reference_at and reference_note to taste_evidence and marks the 3,682 rows of the 17 Nov Instagram profile-grid backfill as reference material (record hygiene Krish approved on 18 Nov). (2026-11-18)
- a meme template's production prompt now carries his caption from the words on his Approve press, however he gave it (typed in his own box or a caption idea tapped, which fill the same box), instead of reading a field that neither route wrote; a caption idea he did not choose is never used. (2026-11-18)
- no cut draws an icon in its body unless its props say bodyLogo true. The palette's logo rule starts on Mon 16 Nov (it was 23 Nov, with an icon-tile carve-out for the week of 16 Nov), an undated spec carries none, the renderer's default is no logo, and ve qc proves the mark absent on every cut without the flag. (2026-11-18)
- The weekly standards check-in opens its grouping pull request with CHECKIN_PR_TOKEN and writes its own closeout note, so the pull request runs CI and merges itself; without the secret it warns and waits for Krish's Approve and run as before. (2026-11-18)
- **StyleStill covers: 47 of 48 passed a separate review and are filed and recorded for the board's style pickers** (`config/ve/style-samples.json`). Eight came from Codex's second pass, 24 from its third, and 15 of the 16 held back from its fourth, after the reviewer's five named faults were fixed (`82360c9b`: line-boil passes too thick to read as three lines, receipt and living-ui labels ink on ink, the data story's chart now the sourced monthly sales indexed 100 to 107, flip-hinge sampled with its key word lit). slot-roll stays held: its uneven word gap is in the caption theme itself (`c631e0ac`). (2026-11-16)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3**, at 0 of 3 counted cuts (`docs/ve/STATUS.md`, "Phase 3 count", last moved 2026-11-18). Procedure: `docs/ve/ENGINE.md` and `docs/ve/RUNBOOK.md`; `ve render` refuses a whole cut until he presses Approve proof. (2026-11-19)

## What changed recently

- 2026-11-19 a board prompt gave only the piece id, so a piece with no schedule date of its own was refused as piece_not_scheduled and its Publish prompt looped; every prompt now names the week and day (`25ee9d2c`).
- 2026-11-18 the Tue 17 habits short reached production with 13 generated pictures acting out his line and invented figures against its own never-list; the F31 guard only checked that an idea existed.
- 2026-11-18 the renderer draws the episode title moment; beats take a graded backdrop; the bed is ridden by EBU R128 loudness, not RMS; off.day is never a tag; figures are never dimmed behind a focus.
Older lines: `docs/history/2026-11-18-NOW-moved-29.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-19): Krish presses Publish again on the Cat counting cash meme (Thu 19) once the new prompt is live; the session still needs his channels, time and captions, and Buffer scheduling itself stays with Growth's route.
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
