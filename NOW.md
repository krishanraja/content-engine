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

- The taste report tool hit its daily cap on 18 Nov, so Krish's typed corrections that day (the head and visual rejection, the carousel font, delete the frames) could not be filed with it. The session-end backstop (scripts/taste_backstop.py) posts to a different route, Control Center's /api/taste/backstop, and that route was open: it filed the queued line and four more of his lines from this session (4 of 4 accepted). Two faults in the backstop are fixed: it read the compaction summary and a hook's feedback as lines he typed (a dozen of the assistant's own lines passed its filter on 18 Nov), and its filter missed plain complaints such as "this font is crappy ... why would it still keep popping up". Both are tested. The report tool's cap itself is Control Center's setting, not this repository's. (2026-11-18)
- plan_scene.py takes a really generated still for a generated beat (--made-still) and draws his caption style over it; PRODUCTION_PLAN.md says when a run may generate one (priced first, at most three, never his face). One still (the B8 warehouse, 0.25 credits, Krish's yes 2026-11-18) was generated and drawn as the proof. (2026-11-18)
- a meme option that carries a template clip now gets the reskin prompt (download that exact clip, reskin it to docs/MEME-STANDARD.md, his caption, the wordmark small at the bottom right, no carousel steps) instead of the carousel one; scripts/now_trim.py can now move old dated lines out of "What is next" so NOW.md cannot jam main again. (2026-11-18)
- Fixed the live SPLIT layout fault Krish rejected on the Wed 18 proof video ("Can't cut my head off and also ruin the visual above"), without waiting on a key-frame set. Reproduced first: the Wed 18 Build-or-buy short and the AI music short are both 1080 x 1920, and the old default plate crop 50% 88% hides the top 669 rows, so a render of the Wed 18 take cuts at his eyebrows and plate.head_in_band fails it (crown 336 px up, no face found in two beats). Changed: the default crop is 50% 16% (apps/renderer/src/engine/layouts/splitGeometry.ts; scripts/velib/qc_as_shot.py now reads it from that file instead of copying it), the stage is a true 16:9 (768 x 432 at x 76, y 288: safe column, below the top bar, clear of the caption and his head) so a 16:9 visual is drawn whole, and head_in_band names the plate.crop that would fit when it fails (qc_faces.fitting_position). Rendered on both real takes with a 16:9 test visual: 12 of 12 head samples whole on each and the visual whole; the old crop fails the same check. The default is one value measured on two takes; the check is the guard, not the default. head-cut-off-and-visual-squeezed is now guarded. The round-3 receipt key-frame card (ve-fwp-rebuild-3) is queued as codex-ve-fwp-rebuild-3; the key-frame set is a design reference only and gates nothing. (2026-11-18)
- off-tue-adsswitch carousel made (8 cards, Anton body type, no robot, real OpenAI ad screenshot on card 2): deck-v2 passes carousel_check.py, two cold readers and carousel_check.py --cards; rendered here by docs/plans/2026-11-16-week/ads-carousel/render_v2.py because Codex's sandbox on Lorimer has no network. The 10/10 judges returned judgements_unavailable twice. Cards and caption sent to the engine library for "3 Posts/2026-11-17 Tue off.day - Free ChatGPT has ads now/4 Social"; the always-on machine writes them to Drive within about ten minutes, read-back not yet done. Not scheduled in Buffer: it needs public image URLs. (2026-11-18)
- **StyleStill covers: 47 of 48 passed a separate review and are filed and recorded for the board's style pickers** (`config/ve/style-samples.json`). Eight came from Codex's second pass, 24 from its third, and 15 of the 16 held back from its fourth, after the reviewer's five named faults were fixed (`82360c9b`: line-boil passes too thick to read as three lines, receipt and living-ui labels ink on ink, the data story's chart now the sourced monthly sales indexed 100 to 107, flip-hinge sampled with its key word lit). slot-roll stays held: its uneven word gap is in the caption theme itself (`c631e0ac`). (2026-11-16)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). From 9 Nov one production round: `ve proof` shows the hardest beat moving on his own take, and `ve render` refuses a whole cut until he presses Approve proof; the day tab carries four presses (Sign storyboard with a `ve expect` sheet, Pick a style, Approve proof, Approve cut) in `meta.making.gates`. Five lessons of the killed Thursday 5 Nov cut are guards in `scripts/velib/guards.py`, binding from 9 Nov. (2026-11-04)

## What changed recently

- 2026-11-18 scripts/taste_backstop.py, tests/taste_backstop_test.py.
Older lines: `docs/history/2026-11-18-NOW-moved-24.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-18): when a session finds the report tool refused, run the backstop route (python3 scripts/taste_backstop.py, or tb.entries then tb.send with his exact lines) rather than leaving his words unfiled.
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
