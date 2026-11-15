---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-15
head: 3ab533c
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

## Where it is right now (as of 2026-11-15)

<!-- north-star-state {"week_of":"2026-11-09","week_target":8,"current":4,"current_as_of":"2026-11-15","current_source":"Control Center content_ideas in the publication's series and content-engine's asset_judgements (3 published, and 1 Growth carousels and Shorts that passed the 10/10 judges and went live, in the last 7 days)","urgency":3,"urgency_reason":"at 50% of this week's target"} --> **North Star number: U3, well behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 4, against 8 this week, on the way to 30 by 30 November 2026. Two experiments a week, growth output doubled.

- Krish ruled "keep captions clear of the mark" (2026-11-15). The Codex card `docs/ve/cards/motion-standard/ve-motion-2-mark-clearance.fields.json` is rewritten as `ve-motion-2b-mark-clear-every-layout`: captions, held titles and words move below the mark's clear zone on every layout, STAGE included, the mark never moved, shrunk or hidden, with a `mark_clearance` QC row and tests that pass only when no caption box meets the zone. The ruling is in `docs/ve/INGREDIENTS.md`. The old branch `ve-card/ve-motion-2-mark-clearance` is not merged. (2026-11-15)
- `ve lint` has a `voice.synthetic` row (`scripts/velib/lint.py`) for INV-SYNTHETIC-OFF. An asset whose tool names a realism-test capability in `config/ve/tools.json` (elevenlabs voice_clone, heygen avatar or lipsync), HeyGen-generated footage, or any generated recording is a synthetic Krish voice or likeness. It is refused unless it names a clone (`<tool>.<capability>:<name>`) that krish-clone's registry approves and the spec carries the matching `approvals[gate=synthetic]` (his words, the date and the scored record sha256, exactly). The registry is read live from krish-clone main over raw GitHub, only when a spec uses one; unreadable or malformed refuses, never passes. lint.py is outside the engine hash, so no piece's engine moved. The registry is empty and not yet on krish-clone main, so today every synthetic use is refused. `tests/ve_synthetic_test.py`, 15 tests. (2026-11-15)
- Eight Codex device cards are written through `ve card` and ready to dispatch, none sent: the kit verbs (`ve-kf-2`, its type check and read list fixed), `cursor_path` moved to the living-ui style (`ve-kf-5`: it waits, presses with a mint ripple, glides, and shows it is busy after a send, with engine verbs only), and four living-ui cards in `docs/ve/cards/living-ui/`: `answer_stream` (a real captured answer streams in, a citation pops, its real source lights up; never re-typed), `checklist` gains a one-shot work state on a `dim` event and a check pop drawn only under a motion style, `code_card` (real code typed line by line, reporting its line to the camera), and `headline` gains an opt-in `assemble` reveal. The character cards are up to date: the library is drawn and approved (9 to 10 Nov), so `ve-kf-6` now reads, checks and stages it and draws nothing, and `ve-kf-7` holds never in the hook, 9:16 only and built poses only, with each pose picked by the rule in `.agents/skills/motion-designer/references/character.md`. Every device card keeps the house golden: new keys only, nothing existing moves. The six devices are in `docs/ve/sprints/ledger.json` so his Gate 2 words can be recorded with `ve sprint gate2`. `docs/ve/STATUS.md` and `docs/ve/sources/keyframes.md` no longer say the character waits on his photo. (2026-11-15)
- the branch sweep takes an approved list (branch@sha) on a hand run and deletes each named branch only at that exact commit, skipping and logging anything else; the weekly run is unchanged. Copied from ai-harness's canonical script and workflow. (2026-11-15)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). From 9 Nov one production round: `ve proof` shows the hardest beat moving on his own take, and `ve render` refuses a whole cut until he presses Approve proof; the day tab carries four presses (Sign storyboard with a `ve expect` sheet, Pick a style, Approve proof, Approve cut) in `meta.making.gates`. Five lessons of the killed Thursday 5 Nov cut are guards in `scripts/velib/guards.py`, binding from 9 Nov. (2026-11-04)

## What changed recently

- 2026-11-15 scripts/codex_thread.mjs, scripts/velib/cards.py, scripts/velib/codex_lane.py, ve doctor, the ve skill, docs/ve/RUNBOOK.md, docs/ve/ENGINE.md, AGENTS.md.
Older lines: `docs/history/2026-11-15-NOW-moved-7.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-15): his PC's recordings pass builds the queued card in WSL; a Claude session checks the pushed `ve-card/ve-motion-2b-mark-clear-every-layout` branch by re-running its acceptance.
- House close (2026-11-10): kit and ve close on the statement card, "Built to help you decide." (`docs/production/CLOSING.md`). Krish approved the engine change for Wed 11 Nov (`docs/plans/2026-11-11-wednesday/ve/engine-exceptions.json`). He hears the first cut with it at full size.
- Wed 11 (2026-11-11): approved in Krish's own words (picks/yes-wed-words); the board reads it as ready to post, both cuts and the pack in its 3 Posts folder.
- Eye contact (2026-11-09): Wednesday runs `ve eyeline` per take (each has its own Maxine copy); visible contact needs the recording fix in EYE_CONTACT.md.
- Fri 13 Nov pre-production sheet (2026-11-07): both takes on the making record (Recorded: done); takes heard against the script (`docs/plans/2026-11-09-week/fri-takes-vs-script.md`: short take says "delegate" for "delete" and adds an unsupported "AI costs halved"; long take calls Hanoi "exaggerated" and changes the close line); the held 4 Nov send closed honestly (sent 06:46 on his words, no reader read-back ever passed). Sheet A to G sent to Krish as files and written as `docs/plans/2026-11-09-week/fri-preproduction/creative.json`. Waiting on Krish: Sign creative (`creative.json`, `signed: null` on 12 Nov); the pickup for "delete" was recorded on 9 Nov.
- 16 Nov week (2026-11-09): board picked and published (Mon Oracle widened, Wed build vs buy, Fri AI after the midterms). Monday's lock signed 10 Nov: its long cut runs a few minutes over 5 and the article longer, to carry the midterm data-centre backlash. Next: one session per day from `docs/plans/2026-11-16-week/HANDOVER.md`.
- Waiting on Krish (checked 2026-11-12, 14:00 UTC): his Approve on Thu 12's `beststicker` on the live board (the Home Depot rethink he signed off in a session, filed in 3 Posts and carrying Tue 17's `auditrule`; the live view reads "Idea: waiting on your Approve"), and an answer on `frenemies` (Tue 17) and `ownref` (Thu 19), which have no outcome in `idea_outcomes`; a sound-effect set (`config/sfx-approved.json` approves none); golden frames (all 10 slots of `config/ve/golden-frames.json` empty, at least 5 wanted); Gate 2 on face-with-proof at 16:9 (`config/ve/design-lock.json`) (each still needs its review card on his Publish Board, with samples he can see and hear; not built yet). The music levels are no longer waiting: he approved them as they are on 12 Nov. `docs/STATE.md`, "Waiting on Krish".
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): `auto-merge.yml` merges every PR on green CI; no hand merges (2026-11-03).
- North Star check (2026-11-15): holds.

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
