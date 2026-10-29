---
repo: krishanraja/content-engine
product: Mindmake content engine
as_of: 2026-10-29
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
# Mindmake content engine: where it is right now

## What it is

The Mindmake content engine is the production team behind makeyourmindup, Krish Raja's publication: it finds what is worth saying, judges it with a blind panel, drafts it in his voice to the right subchannel's mandate, and turns it into videos, articles and carousels, while Krish makes every decision that matters and nothing publishes itself. One repository holds two halves over one Supabase database: the content engine (`apps/control-plane`, its own Vercel project: collectors, the judge ladder, drafting, the fact gate, the ledger the engine learns from) and the production side (`scripts/ve.py`, the spec-driven video engine; `scripts/quick-edit`, the fallback; `apps/renderer`; the Studio in `packages/` and `apps/runner`). Control Center is the desk Krish works at. The publication has three subchannels, follow.the.money, mind.the.gap and under.the.hood, each held to a mandate in the database (`docs/NORTH_STAR.md`). This repository owns production and its standards; Growth-MakeYourMindUp owns posting and distribution (`docs/GROWTH-HANDOFF.md`, ruling of 2026-10-26).

## Who it is for and why it matters for Mindmake

The engine is internal: it is how Mindmake's mission reaches its reader, the face in `apps/control-plane/api/_mission.ts` ("a senior leader who will not admit to anyone that they are not ready for what is happening... leaders of PE and VC backed media, adtech and data businesses Krish already knows"). What it proves to that reader is that one person can run a publication with an AI production team and stay the editor: the machine proposes and shows its working, the person decides, and the machine learns only from what the person decided.

Stories a writer can carry without asking Krish:

- **Nobody was grading the judges.** The view comparing each judge with Krish's decision returned zero rows for two weeks, because no screen sent the panel's run id with his decision (`docs/STATE.md`).
- **The engine taught the habit he had banned.** The stored voice block called "Not X, Y" his most consistent habit; fixing the prompt did not work, fixing the source did (walk log, H7 and H8).
- **The evidence judge could not see the evidence.** It had never been shown the sources; after the fix the same text went from kill 3 to pass 9 (walk log, H9).
- **Every mechanical check passed and the video was still rejected.** Eleven QC checks passed on the first ve proofs; Krish: "the visuals look like Microsoft Excel from 20 years ago". Design became a gate of its own (`config/failures.json`, F19).

Objection it answers: "AI content is slop." Here is an engine that grades its judges against the editor, refuses to ship beneath his recorded rejections, and never counts its own actions as taste.

## Where it is right now (as of 2026-10-29)

<!-- north-star-state {"week_of": "2026-10-26", "week_target": 1, "current": 1, "current_as_of": "2026-10-23", "current_source": "Control Center content_ideas (1 published in the last 7 days)", "urgency": 1, "urgency_reason": "at 100% of this week's target"} --> **North Star number: U1, on pace.** Finished assets published through the engine per week (essays, Shorts, carousels), each passing the 10/10 judges: 1, against 1 this week, on the way to 30 by 30 November 2026.

Lifecycle: building. Claims below are as the sessions of 27 and 28 October recorded them; the full earlier record is in `docs/history/2026-10-29-NOW.md`.

- **ve is the video engine on main; quick-edit stays the fallback until ve passes Phase 3** (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`, `docs/ve/STATUS.md`). Phase 1 merged 2026-10-28 (#199). Format H (hand-held screen) and the two-passports module are built on a frozen design lock with composition QC, key-frame match and `ve packet`. On Krish's word (2026-10-28) format H draws no ILLUSTRATION tag, provenance stickers or marquee; the re-rendered proof needs a fresh Critic and his exact-file approval at Gate 2.
- **Friday 23 October's short "Two passports" is produced whole in ve (2026-10-28, #237):** 78.6 s tall, QC measured_pass, a fresh Critic SEND with no blocks, packet assembled (`docs/plans/2026-10-23-friday-two-passports-ve/`). His Gate 2 verdict and publishing are his. **The long cut (324 s, wide) is produced too (#240), and both videos carry a ducked music bed (about 18 dB under speech, about 10 dB in pauses, measured by a new QC row); each has a fresh Critic SEND, and both are on the 19 October board.**
- **Monday 26 October (follow.the.money, Character.AI) is ready to publish (2026-10-28, #236).** He watched both cuts in full: "yes, watched, I approve". Cuts, thumbnails and receipts are in the post's `3 Video`, the pack is in the library, and Monday is a made day on the board. Nothing is posted (`docs/plans/2026-10-26-monday/video/REVIEW.md`).
- **Wednesday 28 (under.the.hood, Claude Duet) and Friday 30 October (mind.the.gap, who trains your 2030 seniors) are ready to record (2026-10-27).** Articles pass the fact gate; all four scripts are in Teleprompter. One Friday line (James Bessen's IMF byline) waits on his yes as of 2026-10-27.
- **The rejection floor is built (2026-10-28, #222, #229, #232, #233):** `python3 scripts/floor.py --format <maker>` lists his rejections, patterns before one-offs, and every session reads it first (AGENTS.md rule 20). Migration `20261116090000_rejections.sql` is not recorded as applied as of 2026-10-28.
- **Taste is keyed by venture (2026-10-28, #226 to #228):** Make Your Mind Up is `publication`, apart from `mindmake`, and this repository reads only its rows. Migration `20261117090000_taste_ventures.sql` is not recorded as applied as of 2026-10-28. `taste_signals` was applied live on 2026-10-27; drafting still reads only approved claims.
- **Pasted links reach Drive and a reading with nobody opening a log (2026-10-28).** Both home computers keep content-watcher running and report its health to the engine; every console task runs with no window (read back `hidden: 7, left: 0` on each); a cloud backup (`.github/workflows/watch-cloud.yml`) took a link live.
- **UX feedback videos have their own lane (2026-10-28, #223):** a Drive link tagged by venture goes out to Ventures > Bugs & Issues with stills and a prompt. Migration `20261116100000_ux_feedback_recordings.sql` is not recorded as applied as of 2026-10-28.

## What changed recently

- 2026-10-28 **Friday's short was made whole on ve, then passed a second time** (`77434298`, `94e2d8e6`, #237). The second pass took out the ticker in the ending and the prompt chip, opened on the stakes, and applied the Critic's fixes; the engine gained whole cuts (extra beats, a module's beats, the ending, the call card) and the QC they exposed (`869f8515`).
- 2026-10-28 **Monday 26 went into the library with receipts** (`a7bb47b6`, `18240500`, `bb130c3f`). The Udio and ElevenLabs sentence was cut and every named company's logo put on the cuts and covers. Held in the receipts, not hidden: his ruling accepts six pictures in the 5-minute cut and one in the 90-second cut that the blind model review judged unclear, and the 5-minute cut's sync screen fails one window at 4:03 (-80 ms).
- 2026-10-28 **No ILLUSTRATION tag, provenance stickers or marquee on video, and no AI-generation notes anywhere** (`ebd19238`, `a039a22c`, #231). Krish's word; every element must serve the message, so the format H proof was re-rendered and its Critic approval no longer stands.
- 2026-10-28 **Mechanically valid, rejected on design (F19)** (#221, `5f3b47ce`). Krish rejected the first proofs ("The use of the screen is terrible") although all 11 checks passed, and approved the direction of the hand-held screen with hand-drawn scribbles. The guard is a frozen design lock, composition QC, golden key-frame match (SSIM) and a packet that refuses a file without a non-blocking Critic verdict bound to its hash.
- 2026-10-28 **The rejection floor, patterns first** (#222, #229, #232, #233). Krish: "find patterns, so we can cement certain rejections as much being more critical to follow than a one off complaint about one production". `scripts/floor.py` labels each standard PATTERN (two or more productions) or one-off; only patterns are put to him.
- 2026-10-28 **The taste ledger is keyed by venture** (`72219b17`, `09cdd6e4`, `be37abfd`). Krish: "The ledger is keyed by venture not repository. Makeyourmindup as a separate venture to mindmake". It keeps another venture's taste out of this engine's drafting and floor.
- 2026-10-28 **Feedback videos to Ventures > Bugs & Issues** (#223). Krish asked for feedback "in the right places inside the Ventures folder (not the inspiration folder)", from "the link to the MP4 or the video file, which is stored in my Google Drive". The migration was renumbered to sit after the rejection floor's (`d1fcd529`).
- 2026-10-28 **No window, ever, from anything a home computer runs by itself** (learning `no-console-window-ever`). Krish: "HIDE ALL CONSOLE POP UPS FOREVER FROM EVERY REPO AND LOCAL TASK", after black windows flashed "for about 2 minutes". Every console task now runs through `run-hidden.exe` (`scripts/windowless/RunHidden.cs`), proved on Windows CI.
- 2026-10-28 **A pasted link's reading can no longer be lost or doubled.** The other home computer had overwritten link readings by reading the filed files as hand drops (the Short's within 37 seconds), and Instagram's CDN gave a second fetch different bytes, which would have filed a `_v2` copy of everything. Link readings now win, a retry reuses what was filed, and a failed try waits 20 minutes times the tries so far.
- 2026-10-28 **Why the watchers stopped: Windows could not start their task.** Both answered 0x8007010B ("The directory name is invalid"; suspected cause, the repository rename of 24 October). Krish: "i should never really need to copy and paste log files to you like this, ever". The recordings pass now keeps the watcher, re-registers its task and reports its health to the engine.
- 2026-10-27 **Codex spend is measured, not estimated** (PR 191). The baseline any saving is measured against: Friday 23's production used 256.6M input tokens with its 19 child agents, 97.7% cached, 12.5 active hours over 62 wall-clock hours, and took the weekly allowance from 38% to 100% (`docs/COST_GUARDS.md`, "Measuring").
- 2026-10-27 **His feedback becomes countable taste signals.** Krish: "Does this engine take my long-form feedback and turn it into really robust metadata tags". `taste_signals` splits each answer into tags from a fixed vocabulary, refused by trigger unless the phrase is his verbatim; applied live on his "I approve you to apply everything to SupaBase" and read back.

## What is next and what is waiting on Krish

- Next (2026-10-28): Krish publishes Monday from the board (`https://content.krishraja.com/board/2026-10-26`); the publish kit lists every place in order.
- Waiting on Krish (as of 2026-10-28): his Gate 2 verdict on the re-rendered format H proof and on Friday 23's short; his yes to the Bessen line for Friday 30; his recordings of Wednesday 28 and Friday 30.
- Waiting on Krish (as of 2026-10-28): applying migrations `20261116090000_rejections.sql`, `20261116100000_ux_feedback_recordings.sql` and `20261117090000_taste_ventures.sql`; for the floor, the engine's Drive access, a first real run he sees and the `FLOOR_SYNC_TOKEN`.
- Krish declined required status checks on `main` (2026-10-25: "No merge checks."): CI stays advisory, so a session waits for green before it merges.
- North Star check (2026-10-28): holds.

## Read next

1. `AGENTS.md`: the rules for any agent here, and the start route. Read first.
2. `WORKBENCH.md`: where the last session stopped.
3. `docs/NORTH_STAR.md`: what the whole system is for, in Krish's words.
4. `docs/STATE.md`: what is live, built, broken and waiting on Krish.
5. `docs/SYSTEM_MAP.md`: the two halves, every system involved and who owns what.
6. `docs/CONTENT_ENGINE.md`: the content engine route by route.
7. `docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md` and `docs/ve/STATUS.md`: the video engine, its steps, and what it can and cannot do.
8. `docs/CREATIVE_DIRECTION.md` and `docs/CAROUSEL-STANDARD.md`: the signed direction every render needs, and the carousel standard.
9. `docs/PUBLISH_BOARDS.md` and `docs/CADENCE.md`: the web publish board and the weekly rhythm.
10. `docs/GROWTH-HANDOFF.md`: where production ends and Growth begins.
11. `docs/DRIVE.md`, `docs/INTEGRATIONS.md` and `docs/COST_GUARDS.md`: Drive by ID, outside services by symbolic secret name, and spend.
12. `docs/GLOSSARY.md`: every term, and every retired name with its live equivalent.
13. `config/failures.json` (`python3 scripts/check_failures.py`) and `scripts/floor.py`: every failure with its guard, and the rejection floor.

## Do not trust

- `docs/ARCHITECTURE.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT.md`, `docs/ENGINE_SECRETS_HANDOVER.md` and `docs/CAROUSEL_ENGINE_STATE.md` in the passages `docs/STUDIO.md` lists as stale (audited 2026-09-25).
- `docs/STATE.md`, `docs/SYSTEM_MAP.md`, `docs/GLOSSARY.md` and `docs/STUDIO.md` where they predate the code: they were not checked against the 390 commits from 2026-10-22 to 2026-10-28 (ve, the rejection floor, taste by venture, the pasted-link lane). `docs/history/2026-10-29-NOW.md`, "Do not trust", lists what they missed before that.
- `.agents/skills/mindmake-video` where it routes work into The Money of AI or Built With AI: correct for the Studio's series, wrong as a description of the publication.
- Any document that names Descript as the script reader (teleprompter.com since 2026-10-12), a 3-minute long cut (5 minutes since 2026-10-19), a series line or a weekly deep cut (retired 2026-10-21), or a publish board built as a Claude artifact (the web board since 2026-10-19).
- Control Center's own docs where they call the publication "Mindmake's publication" or give it two channels (superseded 2026-09-17 and 2026-09-25).
- Everything in `docs/history/`.
