---
repo: krishanraja/content-engine
product: Make Your Mind Up content engine
as_of: 2026-10-30
head: 262af4b
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

## Where it is right now (as of 2026-10-30)

<!-- north-star-state {"week_of":"2026-10-26","week_target":1,"current":1,"current_as_of":"2026-10-30","current_source":"Control Center content_ideas in the publication's series (1 published in the last 7 days)","urgency":1,"urgency_reason":"at 100% of this week's target"} --> **North Star number: U1, on pace.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 1, against 1 this week, on the way to 30 by 30 November 2026. Steady, and one proposal a week that would raise the ceiling.

- a made day's board materials can fill its Download first video and thumbnail rows (`"fills"`) when the making record holds no such cut, and a moved day says where it went on boards before the fixed layout too. Friday 6 Nov is made on the 2 November board (build c8060ff2) with its music-fixed cuts as private board downloads, and the 19 October board (build be3bc7f1) says Friday moved to Fri 6 Nov. (2026-10-30)
- ve dispatch runs Codex cards under the Studio's own Codex home (runtime\codex-home, built by scripts/overnight/codex_home.py): no MCP server, no plugin, sign-in and sessions shared with ~/.codex. Krish keeps buffer and teleprompter in his everyday Codex. LORIMER (standby) has it built and passes preflight 9/9. (2026-10-30)
- **SURFACE calibration (2026-10-30).** Gate roots from `studio.json`, `.srt` caption pages, the Critic wired. Krish ruled: near-homophones pass, a word with no room in the final is unmeasured, mon26's unfiled joins and captions are accepted missing, wed21's lost words are real, short cross-fades pass the Critic.
- Krish approves the week's filler mix once (picks/mix, Ideas, Off days) and Growth fills it, posting only within an approved mix it reads from the week's pieces; a piece he records keeps its own press. (2026-10-30)
- **The Sunday loop is built, not yet run (2026-10-29).** `.github/workflows/sunday-ideas.yml` (Saturday, 12:17 and 20:47 UTC, idle once the week's Ideas tab is live) runs plan-week's ideas stage; `.github/workflows/make-piece.yml` makes one signed piece per run (from the Sunday room or `repository_dispatch` `make-piece`). Both run Claude Code on Krish's subscription (`CLAUDE_CODE_OAUTH_TOKEN`) and fail at their first step until that secret exists. On the board he presses five ways on each idea, approves scripts (the server sends them to Teleprompter), sets titles and rejects with a reason; the narrative lock gates `making.py`.
- **Zero Claude routines (Ruling, Krish, 2026-10-29).** GitHub Actions is the scheduler; `tests/no-claude-routines.test.ts` fails on any workflow, skill, script or route that creates or fires a Claude routine or runs Claude Code on an API key. The Saturday preflight (`scripts/overnight/preflight.ps1`, both home computers, no window) checks Codex, allowance and tools and starts no Claude turn. Timed API spend is held to $15 a week, but nothing reads `meter_daily` against that cap yet.
- **No public word names Krish (rulings of 28 and 29 October).** House rule `NO_NAME` (`60b87ff`), the copy lint's `no_name`, the kill list's `personal_name` veto, the pack, the story check, the Studio, the publish check, ve's spec lint and quick-edit's caption check all refuse it. Articles speak as "we"; the article byline is "makeyourmindup" with no face; scripts keep "I"; his face stays in video, covers and thumbnails.
- **The production bar is three layers (`docs/production/THE_BAR.md`, 2026-10-29).** Only the eight nevers he confirmed may hard-block on taste (no name; nothing made up, numbers credited; his words never cut or out of sync; no AI notes, eyebrows, asterisks or take tags; nothing posted, sent or spent without his yes, never Full Time or Heartside; real logos and images with rights; one opening, one close; no em dashes, no preaching). Aims guide; choices under test (the hook as the intro, the lead picture per piece, one sound on the big moment) are recorded per piece with `making.py <piece> choices`. `floor.py` prints the eight for every video maker.
- **Every cut opens on its hook, with music under the whole of it (2026-10-29).** House rule `HOOK_IS_THE_INTRO` retires the story card and sting; quick-edit and ve both open on the hook with the wordmark and series tag in the corners from the first frame, and record the opening used. ve no longer draws ILLUSTRATION, SAMPLE, KRISH'S TEST or the Studio v2 chips; a test label reads OUR TEST. The music bed loops under a two-second crossfade so it never drops out.
- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). Friday 23's short and long cut were made whole in ve (#237, #240), each with a fresh Critic SEND; his Gate 2 verdict on them and on the re-rendered format H proof is his.
- **Known red check:** `npm run verify` passes on the session branch except `tests/quick-edit-mix.test.ts` (`mix_test`, this container's ffmpeg 6.1.1; the repository pins 8.1.2). Migrations `20261116090000_rejections.sql`, `20261116100000_ux_feedback_recordings.sql` and `20261117090000_taste_ventures.sql` are not recorded as applied as of 2026-10-28.

## What changed recently

- 2026-10-30 Codex cards no longer inherit the everyday Codex's MCP servers and plugins (on LORIMER 38 plugins, GitHub, Supabase, Stripe, Vercel and Gmail among them); Krish, 30 Oct, "do the separate settings folder fix".
Everything to 29 October 2026 is in `docs/history/2026-10-29-NOW-changed-recently.md`, 30 October lines in `docs/history/2026-10-30-NOW-moved-3.md` and `-4.md` and `-5.md`, all verbatim (W2.12); `npm run check:workbench` holds the byte cap.

## What is next and what is waiting on Krish

- Next (2026-10-30): fix the caption QC gates so the music-fixed cuts can earn a validation receipt and go on Friday's making record and into the library.
- Then: the dry run on Saturday 31 October, 18:00 New York (read both machines' preflight blocks first), and the first Sunday loop on 1 November, recording `production_choices` for each piece made. After that the plan is Wave 2 (`docs/plans/2026-11-07-wave-2.md`: unattended overnight cuts, calibrated gates, ve in shadow, Growth posting what he approved, by 7 November) and Wave 3 (`docs/plans/2026-11-14-wave-3.md`: the ve cutover, one inspiration source, the retrospective, by 14 November).
- Waiting on Krish (as of 2026-10-29): Control Center's `GITHUB_TOKEN` needs Contents: write and Actions: read on this repository for the make press; whether a make run's pull request auto-merges on green CI; whether the $15 cap gets a reader; the Buffer plan (due 31 October); approving the three one-opening, one-close floor standards through the Rejections route; OUR TEST or MY TEST on a video label he presents; "we" in article titles while video titles keep "I".
- Waiting on Krish (as of 2026-10-28): his Gate 2 verdict on the format H proof and Friday 23's cuts; his yes to the Bessen line for Friday 30; his recordings of Wednesday 28 and Friday 30; applying the three migrations above; the floor's Drive access and `FLOOR_SYNC_TOKEN`.
- Waiting on Krish (as of 2026-10-29, Wave 2 and 3 production): by ear, the levels and a sound-effect set; Gate 2 on face-with-proof frames and six devices; 5 to 10 golden frames; 20 minutes on 9 Nov scoring shadow cuts. His 29 Oct answers and the home-computer steps: the handover above.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): CI stays advisory, so a session waits for green before it merges.
- North Star check (2026-10-30): holds.

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
