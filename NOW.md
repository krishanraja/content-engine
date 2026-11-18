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

- The weekly standards check-in opens its grouping pull request with CHECKIN_PR_TOKEN and writes its own closeout note, so the pull request runs CI and merges itself; without the secret it warns and waits for Krish's Approve and run as before. (2026-11-18)
- Wed 18 build-or-buy (db9f9f6a) post-production is part done on ve; the short's hook proof now moves. Both takes are edited by rule (restarts out, pauses to a breath, joins only in quiet gaps both aligners agree on): the short keeps 105.9 s, sped 1.22x to 86.8 s; the long keeps 4:55 with his two restarts clipped. The short's spec lints clean (16 beats, no SPLIT anywhere: at Krish's "Can't cut my head off and also ruin the visual above" every picture plays full frame and his lines play on his face full frame, one WINDOW beat for the third layout; hud-terminal, rack-focus phrase captions, Everything moves, bed Mind Bender because the ledger's Seize It breaks the bed shape). The hook is one continuous 5 s Higgsfield Seedance clip (80 credits, Krish: "go 80", on the ledger), its last frame held full frame and still pushing in under "a mad bag of cats"; the all-hands beat is a Codex layer clip (confetti over one push) and his punchline now plays on his face. Codex built the scene_plate device, 14 comic stills and three continuous layer clips; three Codex receipts are on the ledger. The face-with-proof design-lock key frames were frames of his rejected Thu 5 Nov take: deleted at his word, the lock records the withdrawal and the Critic is its design gate. A caption halo (a tight dark halo round themed caption letters on full scene plates only) is in, approved by Krish ("Approve halo", engine 5cf6e6c8, engine-exceptions.json). Rack-focus said words now soften to 1 px and 80% (Krish: "soften, and get this to completion now", engine a2d1c7e3); every hook page reads by eye, but tesseract still fails over the crocodile's scales. (2026-11-18)
- Krish ordered the four Thu 5 Nov key frames deleted from existence and said "scrub it". They were four JPEGs under fixtures/ve/design-lock/face-with-proof/, in history from 2026-11-03. Every branch (141) was rewritten with the four files removed from each commit descended from the first one, and force-pushed; main's tree is unchanged. Checked from a fresh clone: no branch reaches the files or the four blobs, and the old commits are not reachable from any branch. Not removable by a push: the pull request refs (refs/pull/*, about 540 PRs) and old commit shas still hold the old objects until GitHub Support removes them; the request is written in docs/proposals/2026-11-18-history-scrub-support-request.md for Krish to send. A near-miss: my first push put a plus sign in each refspec, which overrides --force-with-lease, so main was overwritten while PR #894 had just merged on it; I restored it (the merge re-created on the rewritten history, same tree and message) and every later push used a real lease. Two live branches and one new branch had moved after my snapshot and were rewritten on top of their newest commits. (2026-11-18)
- a made off-day post whose files are in its Drive folder now leads with a Publish button and lists every file (cut, slides, covers, thumbnails, captions) on the card; Publish opens a prompt that schedules exactly that list in Buffer through his connector and reports back, and Control Centre's 15-minute Buffer read moves the card to Scheduled. Scheduling from the button itself is not built. (2026-11-18)
- **StyleStill covers: 47 of 48 passed a separate review and are filed and recorded for the board's style pickers** (`config/ve/style-samples.json`). Eight came from Codex's second pass, 24 from its third, and 15 of the 16 held back from its fourth, after the reviewer's five named faults were fixed (`82360c9b`: line-boil passes too thick to read as three lines, receipt and living-ui labels ink on ink, the data story's chart now the sourced monthly sales indexed 100 to 107, flip-hinge sampled with its key word lit). slot-roll stays held: its uneven word gap is in the caption theme itself (`c631e0ac`). (2026-11-16)
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). From 9 Nov one production round: `ve proof` shows the hardest beat moving on his own take, and `ve render` refuses a whole cut until he presses Approve proof; the day tab carries four presses (Sign storyboard with a `ve expect` sheet, Pick a style, Approve proof, Approve cut) in `meta.making.gates`. Five lessons of the killed Thursday 5 Nov cut are guards in `scripts/velib/guards.py`, binding from 9 Nov. (2026-11-04)

## What changed recently

- 2026-11-18 scripts/velib/compile.py (generated assets only inside scene_plate with tool and job_id; a picked caption style keeps phrase pages), scripts/velib/designlock.py and qc_keyframes.py (withdrawn key frames), config/ve/design-lock.json, fixtures/ve/design-lock/face-with-proof (deleted), apps/renderer/src/engine/devices/scene_plate, FormatMaster.tsx (a full scene plate fills a STAGE frame), houseGolden.json (the new device only), config/ve/devices.json, config/ve/moves.json, config/logo-registry.json and seven official marks in assets/logos, scripts/post-pack/edit_cut.py, docs/ve/cards/w1118, docs/plans/2026-11-18-wednesday.
Older lines: `docs/history/2026-11-18-NOW-moved-26.md` (it names every earlier move) and `LOG.md`.


## What is next and what is waiting on Krish

- Next (2026-11-18): Krish creates a fine-grained token limited to content-engine (Contents and Pull requests: read and write) and adds it as the repository secret CHECKIN_PR_TOKEN.
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
