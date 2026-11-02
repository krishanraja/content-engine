---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-02
head: de5b942
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

The content engine is the production team behind makeyourmindup, the publication at makeyourmindup.ai: it finds what is worth saying, judges it with a blind panel, drafts it to the right subchannel's mandate, and turns it into videos, articles and carousels, while Krish makes every decision that matters and nothing publishes itself. It is a Make Your Mind Up product, not a Mindmake one (Ruling, Krish, 2026-10-28); its `plan-week` is the one ideation path, and it runs makeyourmindup's kill list from a pinned copy (`vendor/makeyourmindup/kill-list/`). Two halves share one Supabase database: the content engine (`apps/control-plane`, its own Vercel project: the judges, drafting, the fact gate, the publish board, the ledger) and production (`scripts/ve.py`, the video engine; `scripts/quick-edit`, the fallback; `apps/renderer`; the Studio in `packages/` and `apps/runner`). Control Center is the desk Krish works at; the web publish board (content.krishraja.com) is the one surface he presses on. The publication has three subchannels, follow.the.money, mind.the.gap and under.the.hood, each held to a mandate in the database (`docs/NORTH_STAR.md`). This repository owns production, its standards and the hero assets; Growth-MakeYourMindUp owns posting, distribution and the derived carousels, Notes and memes (`docs/GROWTH-HANDOFF.md`, rulings of 26 and 28 October).

## Who it is for and why it matters for Mindmake

The engine is internal: it is how the publication reaches its reader, the face in `apps/control-plane/api/_mission.ts` ("a senior leader who will not admit to anyone that they are not ready for what is happening... leaders of PE and VC backed media, adtech and data businesses Krish already knows"). What it proves to that reader is that one person can run a publication with an AI production team and stay the editor: the machine proposes and shows its working, the person decides, and the machine learns only from what the person decided.

Stories a writer can carry without asking Krish:

- **Nobody was grading the judges.** The view comparing each judge with Krish's decision returned zero rows for two weeks, because no screen sent the panel's run id with his decision (`docs/STATE.md`).
- **Every mechanical check passed and the video was still rejected.** Eleven QC checks passed on the first ve proofs; Krish: "the visuals look like Microsoft Excel from 20 years ago". Design became a gate of its own (`config/failures.json`, F19).
- **Fewer rules, not more.** After weeks of one-piece rules, Krish asked for the engine to "know what kind of thing doesn't fly with me": the hard blocks shrank to eight nevers he confirmed, and everything else guides or is tested on engagement (`docs/production/THE_BAR.md`).

Objection it answers: "AI content is slop." Here is an engine that grades its judges against the editor, refuses to ship beneath his recorded rejections, and never counts its own actions as taste.

## Where it is right now (as of 2026-11-02)

<!-- north-star-state {"week_of":"2026-11-02","week_target":4,"current":0,"current_as_of":"2026-11-02","current_source":"Control Center content_ideas in the publication's series (0 published in the last 7 days)","urgency":5,"urgency_reason":"under 40% of the week's target two weeks running (0% now)"} --> **North Star number: U5, stalled.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 0, against 4 this week, on the way to 30 by 30 November 2026. Everything else pauses unless it moves the number.

- Krish approved the v3 cursor buddy and typing bubble at Gate 2 ("I agree", 2 Nov); both are merged into the engine. The logo orbit goes back to Codex as v4: its rings did not show and the Meta and xAI marks were smaller than the rest. (2026-11-02)
- Off-day cards can now carry a finished file as a Download link (`download` {url, label}, read through `read_offdays`). Tuesday's translator video is on the 2 Nov board as a download, build 696dc375, and the link serves bytes identical to the local file (sha256 42e02585). (2026-11-02)
- Thursday's three new ve devices (cursor_buddy, logo_orbit, typing_bubble) are built by the Codex lane, pass their acceptance (132 device tests) and are merged into one branch; their stills went to Krish for Gate 2. (2026-11-02)
- The Codex lane now follows every queued card live (ve lane wait), refuses a device card whose verbs main does not accept, and makes a re-queued card take in main before it builds (F22). Thursday's three device cards are re-issued as -v2 and building. (2026-11-02)
- Krish signed off Friday's last three fact lines ("sign off all three Friday lines"); the gate passes. The 2 Nov board is republished as build 57b5c6a1. It carries Friday's clear status line, the revised Tue, Thu and Sat off days, and the idea queue, with all 22 assets kept by sha256. Thursday's recording is in the Inbox. (2026-11-02)
- Thursday 5 Nov is now the No-Spending, No-Sending rule, written by Krish and trimmed to 193 words with his pick. Teleprompter A55B6A69 was updated in place and read back identical. The art direction is set to his steer: the assistants' logo wall and three simulated fails. His prompt is the pinned comment for every post. (2026-11-02)
- Krish's feedback on the 2 Nov week's off days is acted on. Sunday is a rest day permanently (Ruling, Krish, 2026-11-02), on the board and the server, and in Growth. Buffer holds nothing for Sun 8 Nov. The Thursday merged to-camera script is in docs/plans/2026-11-02-week/thu-acts-first-script.txt (story check clean but for the off-day article close; two of two fresh readers "nothing lost") and waits on his Approve. The Saturday revised options are in docs/plans/2026-11-02-week/sat-revised.md and wait on his yes. Improve now reaches a revision run for weeks Growth feeds (offday_pending reads offdays-growth.json). (2026-11-02)
- The off-day "Your words" box now says how his words were read, with the rule Growth uses (Ruling, Krish, 2026-11-02: "only where i specifically give a quote to use - i dont want requests put verbatim in the posts"). Quoted text goes on the picture or video exactly as written; the rest is direction, never printed; a quote that reads as what not to say is held. The page and Growth are tested on the same cases (fixtures/offday-note-cases.json). (2026-11-02)
- **No public word names Krish (rulings of 28 and 29 October).** House rule `NO_NAME` (`60b87ff`), the copy lint's `no_name`, the kill list's `personal_name` veto, the pack, the story check, the Studio, the publish check, ve's spec lint and quick-edit's caption check all refuse it. Articles speak as "we"; the article byline is "makeyourmindup" with no face; scripts keep "I"; his face stays in video, covers and thumbnails.
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). Friday 23's short and long cut were made whole in ve (#237, #240), each with a fresh Critic SEND; his Gate 2 verdict on them and on the re-rendered format H proof is his.
- **Known red check:** `npm run verify` passes on the session branch except `tests/quick-edit-mix.test.ts` (`mix_test`, this container's ffmpeg 6.1.1; the repository pins 8.1.2). Migrations `20261116090000_rejections.sql`, `20261116100000_ux_feedback_recordings.sql` and `20261117090000_taste_ventures.sql` are not recorded as applied as of 2026-10-28.

## What changed recently

- 2026-11-02 Krish approved the rebuilt openings and the words on screen, cleared the flagged pictures and two side-on sync windows ("1. accept. 2 clear"), and his eye may now clear a named sync window the scorer cannot read, never one it measures out of sync.
- 2026-11-01 off-day options carry their own creative direction and are approved, improved or rejected per option; the week's mix press is gone.
Everything to 29 October 2026 is in `docs/history/2026-10-29-NOW-changed-recently.md`, 30 October lines in `docs/history/2026-10-30-NOW-moved-3.md` and `-4.md`, `-5.md` and `-6.md`, and `docs/history/2026-10-31-NOW-moved-1.md`, and `docs/history/2026-11-02-NOW-moved-2.md`, all verbatim (W2.12); `npm run check:workbench` holds the byte cap. The 28 October waiting line is in `docs/history/2026-10-31-NOW-moved-4.md`.


## What is next and what is waiting on Krish

- Next (2026-11-02): Codex builds the logo orbit v4; then its stills go to Krish for Gate 2.
- Waiting on Krish (as of 2026-10-29): Control Center's `GITHUB_TOKEN` needs Contents: write and Actions: read on this repository for the make press; whether a make run's pull request auto-merges on green CI; whether the $15 cap gets a reader; the Buffer plan (due 31 October); approving the three one-opening, one-close floor standards through the Rejections route; OUR TEST or MY TEST on a video label he presents; "we" in article titles while video titles keep "I".
- Waiting on Krish (as of 2026-10-29, Wave 2 and 3 production): by ear, the levels and a sound-effect set; Gate 2 on face-with-proof frames and six devices; 5 to 10 golden frames; 20 minutes on 9 Nov scoring shadow cuts. His 29 Oct answers and the home-computer steps: the handover above.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): CI stays advisory, so a session waits for green before it merges.
- North Star check (2026-11-02): holds.

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

- `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT.md`, `docs/ENGINE_SECRETS_HANDOVER.md` and `docs/CAROUSEL_ENGINE_STATE.md` in the passages `docs/STUDIO.md` lists as stale (audited 2026-09-25).
- `docs/STATE.md` below its 29 October section, and `docs/SYSTEM_MAP.md`, `docs/GLOSSARY.md` and `docs/STUDIO.md`, where they predate the code: none was checked against the commits from 2026-10-22 on (ve, the floor, taste by venture, the Sunday loop, zero routines).
- `.agents/skills/mindmake-video` where it routes work into The Money of AI or Built With AI: correct for the Studio's series, wrong as a description of the publication.
- Any document that names Descript as the script reader (teleprompter.com since 2026-10-12), a 3-minute long cut (5 minutes since 2026-10-19), a series line or a weekly deep cut (retired 2026-10-21), or a publish board built as a Claude artifact (the web board since 2026-10-19).
- Any document that calls the publication or this engine Mindmake's (superseded 2026-10-28), gives it two channels (2026-09-25), or names a Claude routine as a scheduler (2026-10-29).
- Everything in `docs/history/`.
