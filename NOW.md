---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-18
head: b0ca88d
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

## Where it is right now (as of 2026-11-18)

<!-- north-star-state {"week_of":"2026-11-16","week_target":12,"current":4,"current_as_of":"2026-11-18","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (2 published, and 2 Growth carousels and Shorts that passed the 10/10 judges and went live, in the last 7 days)","urgency":4,"urgency_reason":"at 33% of this week's target"} --> **North Star number: U4, far behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 4, against 12 this week, on the way to 30 by 30 November 2026. A bold swing every day; work that does not move the number waits.

- the production plan's scene mock-ups now follow his picks (plan_scene.py draws the art-directed caption layout, the ai-music-slam statement slab with a struck word, and a labelled plate for beats that are not his face; any style it cannot draw is said on the scene). The one post-production prompt has a new step 9 and the shared close-the-loop rule says a Drive upload does not move the card: the session writes the cut's making record (making.py PIECE video ...), reads the board back and reports done only with the stage the board shows. Frozen board fixtures regenerated. (2026-11-18)
- Codex built round 2 of the face-with-proof key frames (card ve-fwp-rebuild-2, branch ve-card/ve-fwp-rebuild-2, verify-card passed); its acceptance reruns clean here (21 tests, typecheck). Claude rendered all eight on real plates (the Character.AI take for the receipt variant, the AI music take for the slam variant, the real Official Charts page for the slam proof, cropped to the three weeks tiles so 19, 21 and 22 read at phone size). Of round 1's seven faults the code fixes dead ground on the full-frame cards, the receipt end card's colours and order, the caption echo (a stricter token check), the tilted chart, the dropped "(reported)" and the 15 px gap. plate.head_in_band ran on real footage for the first time (OpenCV 4 installed in the container only): it fails round 1's broken render (no face findable in the band) and passes all four round-2 split frames. A fresh reader judged the set: only the receipt variant clearly beats a template, and its blanket 'fails fill everywhere' over-read the empty platform column. The lock's own measure (ve comp, which needs tesseract: a first run without it reported nothing, not a pass) settles it: receipt-face, receipt-proof and receipt-close pass every row; slam-hook (fill 65%, needs 80) and slam-close (fill 70%, text in the caption zone) and receipt-hook (text at y 1250, in the caption zone) fail; slam-face and slam-proof are flagged only for their baked-in caption sitting where the engine draws its own. Open and real: slam-proof pairs the peak with a Nov 2026 date (the peak was 28 Aug) and its numbers carry no unit; receipt-close's header block hides the series pill; receipt-hook's (REPORTED) touches its card edge; slam type is spaced out to fill space. The two contact sheets were shown to Krish for his pick; he has not answered. The live SPLIT layout is unchanged: the proof box is still 960 x 400 and the default plate crop still 50% 88%, which is what cut his head off and squeezed the visual in the Wed 18 proof video; both move only when he approves a set at Gate 2. Krish then agreed to drop the picture-matching for this style: `ve lock rules-only` made face-with-proof a rules-only lock (his words recorded; beats, zones and thresholds stay as rules; no key frame is stored or matched; cuts are held to the rules, plate.head_in_band, the Critic and his approval of the exact file), which also ends the legacy-format approval step for it. The 16:9 draft is unchanged. Round 3 (docs/ve/cards/fwp-rebuild/ve-fwp-rebuild-3.md) fixes the receipt set's two remaining faults: text in the caption zone on receipt-hook with a clipped (REPORTED), and the broken receipt-close header; the slam set is not being polished. (2026-11-18)
- **StyleStill covers: 47 of 48 passed a separate review and are filed and recorded for the board's style pickers** (`config/ve/style-samples.json`). Eight came from Codex's second pass, 24 from its third, and 15 of the 16 held back from its fourth, after the reviewer's five named faults were fixed (`82360c9b`: line-boil passes too thick to read as three lines, receipt and living-ui labels ink on ink, the data story's chart now the sourced monthly sales indexed 100 to 107, flip-hinge sampled with its key word lit). slot-roll stays held: its uneven word gap is in the caption theme itself (`c631e0ac`). (2026-11-16)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). From 9 Nov one production round: `ve proof` shows the hardest beat moving on his own take, and `ve render` refuses a whole cut until he presses Approve proof; the day tab carries four presses (Sign storyboard with a `ve expect` sheet, Pick a style, Approve proof, Approve cut) in `meta.making.gates`. Five lessons of the killed Thursday 5 Nov cut are guards in `scripts/velib/guards.py`, binding from 9 Nov. (2026-11-04)

## What changed recently

- 2026-11-18 the plan's mock-up scenes had ignored his picked look, motion and captions, and produced pieces were left stale on the board because the prompt never said to write the making record.
- 2026-11-18 apps/renderer/src/engine/stills/split/ (Codex round 2), apps/renderer/scripts/ve-keyframes.mjs (round 1, on main), scripts/velib/qc_faces.py plate.head_in_band (on main).
Older lines: `docs/history/2026-11-18-NOW-moved-22.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-18): run the next plan on a live piece (My takes are in the Inbox) and check that its three scenes differ by kind; if a generated beat should show a real still before the production session, that needs his yes on credits.
- House close (2026-11-10): kit and ve close on the statement card, "Built to help you decide." (`docs/production/CLOSING.md`). Krish approved the engine change for Wed 11 Nov (`docs/plans/2026-11-11-wednesday/ve/engine-exceptions.json`). He hears the first cut with it at full size.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-18): holds.

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
