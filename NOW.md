---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-11-01
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

## Where it is right now (as of 2026-11-01)

<!-- north-star-state {"week_of":"2026-10-26","week_target":1,"current":0,"current_as_of":"2026-11-01","current_source":"Control Center content_ideas in the publication's series (0 published in the last 7 days)","urgency":4,"urgency_reason":"at 0% of this week's target"} --> **North Star number: U4, far behind.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 0, against 1 this week, on the way to 30 by 30 November 2026. A bold swing every day; work that does not move the number waits.

- Day tabs on the publish board say where each day is (made, in review, picked) instead of "7 steps" (Krish, 1 Nov: "sort day tabs out"). Monday 9 Nov's publish page is rebuilt from the original page Krish shared, word for word, plus the receipts figure under WHO IS LEFT WITH THE SHELL (docs/plans/2026-10-26-monday/pack); the 9 Nov board (ebcf031c) and the 2 Nov board (e90cff91) are republished and read back, Monday's Approve for publish still bound to dbb311e1. (2026-11-01)
- Both boards are rebuilt on main after #310 (1 Nov): 2 Nov build 2e141052 (Krish's fri-publish and wed-feel presses kept), 9 Nov build b2bae4a3 (re-pitched ideas, every Inspiration ask used or accounted, one topic per off day). (2026-11-01)
- Monday 2 Nov (follow.the.money, "Claude's AI is eating the jobs of its own humans. What does that signal for the rest of us?") and Wednesday 4 Nov (under.the.hood, "AI used to reply. Now it acts first. Claude Duet is the start.") are made days on the 2 Nov board (build c93a5b41): both cuts per day passed independent review (Wednesday privacy first), both articles pass the fact gate and the spine judge, packs are in the library, the off-days plan from growth is on the board. Engine fixes: make.py opens on the first picture and closes straight to the end card; week_board.py's off-days build no longer needs ideas.json and its Today lines fit; the thumbnail check shows the real length. (2026-10-31)
- Friday 6 Nov is approved and sealed. The 2 November board is on layout v3 and opens on Today (build b080bee6; a remembered day tab had hidden the Needs you queue and Friday's Approve). Krish told the session to log his approval ("log my approve for publish yourself this time around"); the press was made from his signed-in board session (picks/fri-publish, updated_by Krish, bound to 40a83bc8) and the sealed manifest (a0f1144b) is in the post's 0 Publish folder for Growth. The 9 November board is rebuilt from the Sunday ideas run's own ideas.json (branch sunday-ideas/2026-11-09-41061348740): the same Wed and Fri options, plus the off-day options and the week's mix the live tab had lost, and Monday's Approve for publish bound to manifest dbb311e1 (build a3d4bc5d). The week's mix ask no longer breaks v3 builds (its detail ran past 26 characters). (2026-10-31)
- Clips Krish links to a piece reach post-production (2026-10-31): `GET /api/content-ideas/<id>/routed-clips` and `making.py <piece> clips` list them, `show_with_sound` only with his quoted words on the making record; `making.py video` warns on a cut that has not placed each one (a hard stop waits on his call). No renderer can yet play an outside clip with its own sound.
- Krish approves the week's filler mix once (picks/mix, Ideas, Off days) and Growth fills it, posting only within an approved mix it reads from the week's pieces; a piece he records keeps its own press. (2026-10-30)
- **The Sunday loop is built, not yet run (2026-10-29).** `.github/workflows/sunday-ideas.yml` (Saturday, 12:17 and 20:47 UTC, idle once the week's Ideas tab is live) runs plan-week's ideas stage; `.github/workflows/make-piece.yml` makes one signed piece per run (from the Sunday room or `repository_dispatch` `make-piece`). Both run Claude Code on Krish's subscription (`CLAUDE_CODE_OAUTH_TOKEN`) and fail at their first step until that secret exists. On the board he presses five ways on each idea, approves scripts (the server sends them to Teleprompter), sets titles and rejects with a reason; the narrative lock gates `making.py`.
- **No public word names Krish (rulings of 28 and 29 October).** House rule `NO_NAME` (`60b87ff`), the copy lint's `no_name`, the kill list's `personal_name` veto, the pack, the story check, the Studio, the publish check, ve's spec lint and quick-edit's caption check all refuse it. Articles speak as "we"; the article byline is "makeyourmindup" with no face; scripts keep "I"; his face stays in video, covers and thumbnails.
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). Friday 23's short and long cut were made whole in ve (#237, #240), each with a fresh Critic SEND; his Gate 2 verdict on them and on the re-rendered format H proof is his.
- **Codex lane built, not proven live (2026-11-01):** a session without Codex queues the card; the PC with `MINDMAKE_CODEX_WSL_REPO` builds it in WSL.
- **Known red check:** `npm run verify` passes on the session branch except `tests/quick-edit-mix.test.ts` (`mix_test`, this container's ffmpeg 6.1.1; the repository pins 8.1.2). Migrations `20261116090000_rejections.sql`, `20261116100000_ux_feedback_recordings.sql` and `20261117090000_taste_ventures.sql` are not recorded as applied as of 2026-10-28.

## What changed recently

Everything to 29 October 2026 is in `docs/history/2026-10-29-NOW-changed-recently.md`, 30 October lines in `docs/history/2026-10-30-NOW-moved-3.md` and `-4.md`, `-5.md` and `-6.md`, `docs/history/2026-10-31-NOW-moved-1.md` and `2026-11-01-NOW-moved-5.md`, all verbatim (W2.12); `npm run check:workbench` holds the byte cap. The 28 October waiting line is in `docs/history/2026-10-31-NOW-moved-4.md`.


## What is next and what is waiting on Krish

- Next (2026-11-01): Krish picks Wed 11 and Fri 13 and approves the off-day mix on the 9 Nov board.
- Then: the dry run on Saturday 31 October, 18:00 New York (read both machines' preflight blocks first), and the first Sunday loop on 1 November, recording `production_choices` for each piece made. After that the plan is Wave 2 (`docs/plans/2026-11-07-wave-2.md`: unattended overnight cuts, calibrated gates, ve in shadow, Growth posting what he approved, by 7 November) and Wave 3 (`docs/plans/2026-11-14-wave-3.md`: the ve cutover, one inspiration source, the retrospective, by 14 November).
- Waiting on Krish (as of 2026-10-29): Control Center's `GITHUB_TOKEN` needs Contents: write and Actions: read on this repository for the make press; whether a make run's pull request auto-merges on green CI; whether the $15 cap gets a reader; the Buffer plan (due 31 October); approving the three one-opening, one-close floor standards through the Rejections route; OUR TEST or MY TEST on a video label he presents; "we" in article titles while video titles keep "I".
- Waiting on Krish (as of 2026-10-29, Wave 2 and 3 production): by ear, the levels and a sound-effect set; Gate 2 on face-with-proof frames and six devices; 5 to 10 golden frames; 20 minutes on 9 Nov scoring shadow cuts. His 29 Oct answers and the home-computer steps: the handover above.
- Waiting on Krish (2026-11-01): set `MINDMAKE_CODEX_WSL_REPO` on the Codex PC.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): CI stays advisory, so a session waits for green before it merges.
- North Star check (2026-11-01): holds.

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
