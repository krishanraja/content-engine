# History log

Newest first. Entries are written by the docs steward (see the steward link in
`NOW.md`) and by people doing the same job by hand. Nothing in this file
describes current behaviour; `NOW.md` and `docs/STATE.md` do.
Files moved here keep their body verbatim under a Historical banner.

## 2026-10-06

- decision (Krish, 2026-10-06): "Can you ensure all videos are always archived properly in folder with data/subject/where I can post it in the folder name?" Done at `03f22ee` (walk log F67, H40).
- feedback (Krish, 2026-10-06), of a subscriber's Outlook showing the launch email with no pictures: "is there any way around this?" Done at `ef93e67` (walk log F66, H39); the welcome email line is in makeyourmindup.
- report (Krish, 2026-10-06): "Article 1 was published as was launch post" and "done all the things waiting on me". Read back the same morning: the description and About page carry the new schedule; article 1's share image is still the old 1200 x 630 cover.
- reconciled at `9c4ae58`: NOW.md takes the launch, the archive naming, the email check and a new waiting list. "Where it is right now" was not re-verified beyond those.

## 2026-10-05

- reconciled at `427691a`: merged `main`, which had gained the canon block sync (#66, `AGENTS.md` only); nothing in NOW.md changed with it.
- feedback (Krish, 2026-10-05), with a phone screenshot of the published article 1 in his feed: "Also bear in mind what happens to your artwork when I'm looking at the article in Substack once it's posted." House rule `SUBSTACK_FIT` (live, stage visual) at `16dbd8d` and `687f1a6`; the Substack title and subtitle in the `package` step at `2ea277a`; walk log F64, F65, H37, H38 at `c1e04f7`. The address move shipped the same night in all four repositories (walk log F62).
- reconciled at `c1e04f7`: NOW.md takes the shipped address move, article 1 live, the Substack-fit tools and the new waiting-on-Krish list.
- decision (Krish, 2026-10-05): "lets close this session out by ensuring everything I have asked for in terms of the content engine (like a viral youtube title and description) becomes a part of the durable engine. Log anything else I've missed. Improve the content engine as much as you can". Done at `761e85f` (the `package` step and house rule `YOUTUBE_PACKAGE`, after "whats a viral video title for this"), `b69a464` (`scripts/pages`, `scripts/channel-kit`) and `4cb6b1e` (`scripts/quick-edit`); findings F58 to F63 and rows H33 to H36 in the walk log at `159224f` and `b20eae3`.
- decision (Krish, 2026-10-05): "mindmakerlive.substack.com is now replaced with home.makeyourmindup.ai as the substack homepage. should I call it something different? if not, sub this out absolutely everywhere". Asked whether "read" fit better, he said "there are loads of videos planned, is read still the right word?", and the name stays "home". The engine counts both addresses at `13dd2be`. The cover's links and Control Center's tracking wait on Substack serving the new address (walk log F62).
- reconciled at `b20eae3`: NOW.md takes launch day's tools, the address move, piece 3 as Wednesday's post (database readback: `approved`), and a new waiting-on-Krish list; the old next step (piece 1's capped fact check) was done on 2026-10-05.
- scripts (2026-10-05) at `4cb6b1e`: `scripts/quick-edit` turns one recording into a finished tall and wide video; it edited both launch videos, whose settings are in `editions/2026-10-launch/video-kit/`. The hello README now points there.
- editions (2026-10-05) at `3e259b9`: end cards and the edit recipe for the launch hello video, which is edited outside the Studio.
- workbench (2026-10-05) at `8b87aee`: the latest handoff records the Monday schedule, working in the agent session, and article 1's launch set.
- decision (Krish, 2026-10-05): "Let's just make follow the money permanently a monday thing, and swap it out." Then: "ok, make sure absolutely everywhere reflects this swap in scheduling, including the site, everywhere". In `4675ef8`: `config/studio.json` house style days (follow_the_money Mondays, under_the_hood Wednesdays), the thumbnail, carousel and render-v2 tests, the North Star cadence table, the who-picks-your-ai footer, and `docs/STUDIO.md` pointing at brand kit v1.5. Control Center migration `20261005170000` changed `venture_formats.cadence_label`. The 2026-09-26 entries, the walk log and NOW.md's 2026-09-26 bullet keep the days they were written with.
- decision (Krish, 2026-10-05): "I would rather work in here and have the pieces and their artwork produced in html and assets like we are doing now - control center editing feeling super fiddly to me right now while we are building the engine". Pieces and artwork are made in the agent session; Control Center stays the record for locking and publishing.
- fix (2026-10-05) at `ace7249`: the fact check caps new claims per run, not total claims, so a long piece finishes across runs (walk log F57).
- walk (2026-10-05): piece 1's launch version passed the fact gate on run 5 (59 claims, 0 blocking) at `eabafd3`; F56 records why runs 1 to 4 blocked. `NOW.md` piece 1 line updated.
- decision (Krish, 2026-10-05): "this is better - and yes, real world examples someone would do in real life are gold. yes to the article too. happy with the 3". House rule `REAL_LIFE` (live). Piece 1: the deeper version is approved for its wording and the engine fact check is run on it; the official lock follows a passing check. Visuals for piece 1: three, one per point (what each company is paid for, the same request asked of two AI agents, who pays when an AI agent gets it wrong); the fourth (a merchant order comparison) is left out.
- decision (Krish, 2026-10-05): "be clearer and refer to 'robot' as \"AI agent\"". House rule `AI_AGENT` (live): writers, draft judges, the final pass and visuals.
- feedback (Krish, 2026-10-05) on piece 1: "the whole article isn't very deep either, it doesn't really explain in plain english why they get paid for different things and what those different things are, what the incentives are for each company to make that decision, and where the consumer or merchant could get stung", then "that feedback applies to the video, article and artifact". House rule `MONEY_MECHANICS` (trial, follow.the.money): writers, draft judges and visuals. Piece 1 is being deepened before launch.
- decision (Krish, 2026-10-05): "The visuals need to explain something critical in the article in a way that would help them understand the point quicker. this needs to be a permanent rule, right now the visuals just feel like gimmicks - who cares about a person walking to a box that says \"till\"?" House rule `VISUAL_EXPLAINS` (live, stage visual), read by the video script and channel cut planners; `AGENTS.md` carries it for sessions that build visuals by hand. Said about the first launch interactive for piece 1 (a person and a robot walking an aisle to a till), which is withdrawn.

## 2026-10-04

- reconciled at `39225c8`: `NOW.md` gained piece 1's practical-value revision, the capped paid fact check and the three cron fixes; `docs/STATE.md` "Recent cron failures" now records the 2026-10-03 fixes (stamp left at 2026-09-25 because only that bullet was checked). `docs/CONTENT_ENGINE.md` already carried the fact-check scope change.
- decision (Krish, 2026-10-04): "Article 1's true value is the practical implication for business leaders and consumers: what to build, which features matter, and what to watch." Recorded in `docs/walks/2026-09-three-piece-walk.md`; not yet a house rule.
- report (Krish, 2026-10-04): the GitHub key in the engine's Vercel project is fresh (per `WORKBENCH.md`).

## 2026-10-03

- reconciled at `b59f395`: `docs/GLOSSARY.md` said the judge sweep runs every 10 minutes; the cron is daily at 05:00 UTC since `25c6f4f`, so the line was corrected (stamp left at 2026-09-25 because only that line was checked). NOW.md gained the clarity rulings, the sweep change and the route-gate fix, and its piece 1 and piece 3 status now follows `WORKBENCH.md`.
- decision (Krish, 2026-10-03): "Never use phrases that sound smart but can be misinterpreted; say what happened in crystal-clear words." Now house rule CRYSTAL_CLEAR.
- decision (Krish, 2026-10-03): "Every article must have one clear reading and use factual parallels, relatable analogies or clearly labelled comic exaggeration where they help." Now house rule RELATABLE_EXPLANATION.
- decision (Krish, 2026-10-03): "I will use codex on one of the two machines set up as the video runner, either or. sort the engine key." and "feel free to use KeePass in the H drive which stores all the other creds for the video runner". The engine key now lives in Windows Credential Manager on the home machines (`scripts/engine-key.ps1`), in KeePass, in Vercel and in the Claude environment (`docs/ENGINE_SECRETS_HANDOVER.md`, "The engine key for agent sessions").
- decision (Krish, 2026-10-03): "yes I need the boards to not be Claude pages, but accessible by Codex too and workable using Codex too". The board lives in the database (`/api/workbench`) and in Control Center at #/board; the Claude page is retired.
- report (Krish, 2026-10-03): "key done". The engine was redeployed so it takes the new key.
- report (Krish, 2026-10-03): "done, I overwrote the ENGINE_OPERATOR_TOKEN that was already in there and redeployed". Checked after that deployment: the old engine key is refused and the new one accepted; the board item closed.
- report (Krish, 2026-10-03), relaying Codex on a home computer: "The board read is blocked because this machine's engine key is not currently available to the helper." Cause: Codex's Windows sandbox runs commands as a separate Windows user that cannot read his Credential Manager or reach the internet. The helper now says so, and Codex runs it outside the sandbox with his approval (`AGENTS.md`).

## 2026-10-02

Krish answered thirteen items on the work board (claude.ai/artifact/BytBqVcDsswyFaoyntQwEf) at 08:20 to 08:23 UTC.

- decision (Krish, 2026-10-02): "Yes, this is the standby". Runner `e4e562cc` is the cold standby (`video_studio_set_runner_role`, audited in the role events); `656ae98c` stays the only active runner.
- decision (Krish, 2026-10-02): "yes" to adding the dated prediction to all three channel mandates. Each live mandate gained one "THE CALL" sentence (`supabase/migrations/20261002090000_mandates_dated_prediction.sql`, applied and read back).
- decision (Krish, 2026-10-02): "Yes, or cut the opinion lines" to letting a checked sentence keep its verdict until it changes. Built: `meta.fact_ledger` (walk log F52).
- decision (Krish, 2026-10-02): "yes" to piece 2's Short storyboard, and with it moves 1 to 4 of the reference grammar (`fixtures/feedback/piece2-short-storyboard-20261002.json`).
- decision (Krish, 2026-10-02): piece 1's ruling note "Yes"; on the angle, "We need to dig further as Muse gets more usage". Piece 3: "Keep" (under.the.hood), and "Yes, 55%. And vary it up". Relayed with `decided_by: 'Krish'` (ledger sequences 129 to 133); the walk log has the detail.
- decision (Krish, 2026-10-02): the four credentials pasted on 2026-09-24 are rotated ("done"); the makeyourmindup repository stays public ("no"); the site line saying he writes every piece stays ("keep it as is").
- decision (Krish, 2026-10-02): "can you give me the script to run on this machine, fully self contained script", for the standby's Studio MCP token: `scripts/standby-studio-mcp-token.ps1`.
- decision (Krish, 2026-10-02): "Piece 1 approved". "Same agent, opposite answers" (follow.the.money) is `approved` on the exact text that passed the fact gate (run 5, v18), relayed with `decided_by: 'Krish'`; the walk log has the detail. Nothing is published.
- report (Krish, 2026-10-02, about 09:40 UTC): the Studio MCP token is stored on both machines, and both runner checkouts are on the same commit with every check passing. The cloud read the primary `656ae98c` active on `cc0657e` (`docs/STATE.md`, "The Studio's runners, 2026-10-02").
- decision (Krish, 2026-10-02): "yes" to approving a Studio render of the house style. No Studio render exists yet (no job or projection since 2026-09-05), so the switch-on steps in `docs/STUDIO.md` still start with rendering the proof on his machine.

## 2026-09-28

- decision (Krish, 2026-09-28): "approve". Piece 2, "Who picks your AI?" (mind.the.gap), approved at the exact text that passed the fact check, with his 75%. Relayed with `decided_by: 'Krish'`; nothing is published.
- decision (Krish, 2026-09-28): "fact check as much as possible until is no longer needed." The fact gate stays at full strength: both checks on every fact, any contradiction blocks, and a piece is re-run as often as it takes. The proposal to re-ask the web checker once before blocking is declined. The gate is relaxed only when the record shows the checking is no longer needed.
- decision (Krish, 2026-09-28), on the Studio's makeyourmindup branding as rendered: "this is awful, and embarrasing. it does not even look like the makeyourmindup site in design aesthetic." The candidate theme stays switched off and is redesigned in the makeyourmindup look before any approval is sought.

## 2026-09-26

- decision (Krish, 2026-09-26): "Just get in line with what those updates are at the live website", then "Correct the engine's table and anywhere else, its out of date." under.the.hood is due every Monday, one a week, as the makeyourmindup cover page promises (Mon, Wed, Fri). It had no fixed day at 0.5 a week. `venture_formats` and `content_cadence` changed live and read back; Control Center migration `20260926150000` records it.
- decision (Krish, 2026-09-26): "The Fork is good, go on the edits, placement approved." mind.the.gap's format is The Fork (then, now, the fork, our call); piece 2 takes the proposed line edits; the Studio lockup sits at the start of the timeline on every beat and in full once at the end, with no title card (walk log H27, F25, F26).
- decision (Krish, 2026-09-26): "Make your mind up, Mark, plus the channel name. You've got the logos as per the website for all of that." Branded Shorts and carousels on the three channels take the makeyourmindup mark plus the channel name set in mono (`fixtures/feedback/studio-branding-mark-channel-20260926.json`). Where the lockup sits is shown in the piece 2 storyboard and waits on his verdict; the render pipeline is not changed yet.
- decision (Krish, 2026-09-26): piece 2's prediction is set at 75%. "In general I think I'd rather take a clearer stance than sit on the fence all the time and say 60%." Relayed to the engine as his edit; rule CLEAR_STANCE, and a confidence no longer forces a fact re-check (`e4f1394`).
- decision (Krish, 2026-09-26): "I agree with all your four except for number one." Shorts take sentence-case captions with at most one loud word, and close on the dated prediction (`fixtures/feedback/proof-short-captions-close-20260926.json`); the Studio is to learn the three subchannel names (walk log F21).

## 2026-09-25

- decision (Krish, 2026-09-25): "Once this engine is built and the machinery is in place, run a prompt caching pass over the system. Only once the pieces are capable of being produced with minimal fix passes." Sequenced, not started: the trigger, the reason and the method are in `docs/CONTENT_ENGINE.md` ("Waiting: the prompt caching pass").
- decision (Krish, 2026-09-25): "Think about the GitHub engine as a modular set of components that work together to come alive. You should be updating and upgrading each relative or relevant component part as you go across the entire engine, whether that be: - brainstorming an idea and judging it - implementing gates and checks prior to publish that have come from some of the guidelines I've given, etc. Be strategic." His rulings now live once in `api/_houseRules.ts` and reach writers, both judge gates and the final pass; approval needs the machine checks in `api/_publishChecks.ts` (`a032649`, `d574a8e`; walk log H20 to H23).
- preference (Krish, 2026-09-25): "I really like this Instagram ad, the way it's designed and styled. I think it's really impactful." Recorded as a proposal, with two conflicts against his 2026-09-08 Studio standard left for his ruling (`docs/REFERENCE_INSTAGRAM_AD.md`); receipts for proof panels built (`d408e11`, H24).
- decision (Krish, 2026-09-25): "This requires more frequent merging, documentation, logging, and building the bricks of the system as you go, as opposed to just doing this one article by article." Every fix made for one piece is now built as a capability with a test, merged to `main` and logged (walk log H15 to H19).
- decision (Krish, 2026-09-25): "We do say no jargon everywhere and I don't just mean technical jargon. I mean words that someone needs to interpret." Rule R6, live in `VOICE_GUARDRAILS` and the final pass (`494d4f4`), recorded in the ledger on piece 2.
- decision (Krish, 2026-09-25): "This entire media channel needs to be radically simplistic with an average reading age of 12 and a huge sense of humour and fun and personality." Rule R7, live in the same places (`494d4f4`).
- decision (Krish, 2026-09-25): "Stats and facts needs to probably be passed through a separate verification gate using perplexity or something, we cannot afford even a chance of factual errors slipping in." The fact gate (`a843cc8` onward; walk log H12 to H14); piece 2 passed it on its tenth run.
- decision (Krish, 2026-09-25): "Can we change split.the.bill to follow.the.money, and lift.the.lid to under.the.hood, everywhere? every single instance front and back end, with zero exceptions? those two and mind.the.gap are my FINAL FINAL choices for the 3 channels." Renamed in every tracked file of this repository and control-center, in the live `venture_formats`, `content_cadence` and `format_aliases` rows (slugs cascade through every foreign key), in the text of every mutable row that carried either name, and in the n8n content factory (control-center migrations `20260925120000` and `20260925123500`, the second catching one thesis a judge sweep on the previous code wrote while the first was being prepared). The old names now appear only in `format_aliases`, this entry, `docs/GLOSSARY.md` and ten append-only rows that cannot be edited (seven ledger events, three judge verdicts). Earlier entries in this log were rewritten to the new names as part of the same instruction.
- decision (Krish, 2026-09-25): rewrite the repository's documentation so that no agent can misread the objective, what the repository is or what it does, and scrub everything old into history. Done by hand in one session, following the steward's schema, because the steward itself only reconciles and never restructures.
- moved `README.md` to `docs/history/2026-09-25-README.md`, replaced by a new `README.md` plus `docs/NORTH_STAR.md`, `docs/SYSTEM_MAP.md` and `docs/STUDIO.md`, because it described the repository as the Video Studio alone, under the names Mindmaker, The Money of AI and Built With AI, and never mentioned the content engine in `apps/control-plane`.
- moved `NOW.md` to `docs/history/2026-09-25-NOW.md`, replaced by a new `NOW.md` for the whole repository, because it described only the Studio and said so in its own Do not trust section. Its "What changed recently" bullets from 2026-08-28 to 2026-09-07 are not carried into the new file; they are preserved verbatim in the moved copy.
- moved `docs/PILOT.md` to `docs/history/2026-09-25-PILOT.md`, not replaced, because the four-week two-series pilot never started and was written for the retired series grid and the retired Mindmaker Live channel.
- moved `apps/control-plane/README.md` to `docs/history/2026-09-25-control-plane-README.md`, replaced by `docs/CONTENT_ENGINE.md` and a short pointer README, because its route table left out the judge ladder, learning, trends, claims, AEO, inspiration and the edit ledger, and it misdescribed which routes are guarded.
- archived copies of `AGENTS.md` and `CLAUDE.md` as they stood, at `docs/history/2026-09-25-AGENTS.md` and `docs/history/2026-09-25-CLAUDE.md`, before both were rewritten in place. The generated krish-canon block in `AGENTS.md` was left byte-identical and is not copied.
- new current documents: `docs/NORTH_STAR.md` (the objective in Krish's words), `docs/STATE.md` (the new state doc; `NOW.md` and control-center's `docs/steward/fleet.json` now name it instead of `docs/CAROUSEL_ENGINE_STATE.md`), `docs/SYSTEM_MAP.md`, `docs/CONTENT_ENGINE.md`, `docs/STUDIO.md`, `docs/GLOSSARY.md`.
- every detailed Studio document (`ARCHITECTURE`, `OPERATIONS`, `DEPLOYMENT`, `ENGINE_SECRETS_HANDOVER`, `CAROUSEL_ENGINE_STATE`, `ART_DIRECTOR_REPERTOIRE`, `OPENING_LOOP_CALIBRATION`, `REFERENCE_VIDEO_CALIBRATION`, `ENGINE_SESSION`, `FILM_CREATIVE_JURY`) gained a one-line scope banner; their bodies are unchanged, several are pinned by `tests/repository-contracts.test.ts`, and their known stale passages are listed in `docs/STUDIO.md` rather than rewritten without a check.
- this log's preamble now names `docs/STATE.md` as the state doc.

## 2026-09-24

- reconciled at `fd467e1`: 36 non-steward commits since `242ac30`, all but one in `apps/control-plane`, the editorial spine outside this repo's `docs_roots` on the same standing gap recorded on 2026-09-17, 2026-09-19, 2026-09-20, 2026-09-21 and 2026-09-23. Two of those commits (`b61a461`, `fd467e1`) landed on `main` after this reconciliation had already started against `30b42af`; the run rebased onto them rather than push a stale head. The one documentation commit, `7b30348`, opens `docs/walks/2026-09-three-piece-walk.md`, a live engineering log of one idea per subchannel walked from a Claude Code session through the content-ideas pipeline: auth, models and spend, the path an idea takes, twelve findings (F1 to F12) and ten hardening changes (H1 to H10). It is the first document under `docs_roots` to describe any part of `apps/control-plane` directly, so the "Do not trust" note about that gap is corrected rather than repeated verbatim; the note still says no state doc covers the subsystem. Piece 1 of the walk reached `state:'review'` and waits on Krish; pieces 2 and 3 were still open. Added one "What changed recently" bullet for the walk itself: unlike the prior four re-heads, this range had a document with real findings, numbers and a Krish ruling (rule R2, "cut it everywhere") to weigh. Added `ENGINE_OPERATOR_TOKEN` to `never_publish` as the credential name H1 introduced. Moved `head` from `242ac30` to `fd467e1`; `as_of` moved from 2026-09-23 to 2026-09-24.
- `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`, flagged again by the digest; no commit in this range touches carousel or video engine code or config, so the stamp was left as is rather than bumped without a check.
- decision (Krish, 2026-09-24): "Cut it everywhere", on the "Not X, Y" construction (rule R2), later confirmed to cover the stored voice block and both orders. The voice block and the channel corpus in `system_config` were edited the same day by exact position; the replaced passages were not copied into this repository.
- decision (Krish, 2026-09-24): on piece 1, follow.the.money over the router's mind.the.gap; the ad-revenue motive labelled as the hypothesis; the money leads; signature sections trialled (rule R3, proposed).
- decision (Krish, 2026-09-24): fast turnaround and cost efficiency both, so the judge sweep runs live by default (`d153021`).

## 2026-09-23

- reconciled at `242ac30`: three non-steward commits since `33fb5ec`. Two, `c72e8dc` (a raw RSS description was written straight into `content_ideas.thesis` as markup, cleaned at the point a pool card becomes a typed `PoolStory`) and `242ac30` (a `not_interesting` verdict, recorded and not enforced, added to the shared relevance classifier and wired into the Feed's pool lane for the first time), are both in `apps/control-plane`, the editorial spine moved into this repo from `krishanraja/control-center` in PR #42 and still not described by any document under this repo's `docs_roots`, the same standing gap recorded on 2026-09-17, 2026-09-19, 2026-09-20 and 2026-09-21. The third, `73fbd2a`, adds a two-beat fixture to `tests/visual-plan.test.ts` proving the already-documented loop rule (`docs/OPENING_LOOP_CALIBRATION.md`, "open_question, structural and blocking") against a plan shape the suite had not exercised; it changes no production code, no contract and no documented rule, so it is a test with no documentation consequence. No "What changed recently" bullet for any of the three. Moved `head` from `33fb5ec` to `242ac30`; `as_of` and the "Where it is right now" heading stay 2026-09-23, the same day. `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`, flagged again by the digest; no commit in this range touches carousel or video engine code or config, so the stamp was left as is rather than bumped without a check.
- reconciled at `33fb5ec`: `NOW.md` carried `head: c62ac34` and `as_of: 2026-09-21` while `2666761` (merged `4688f83`, trend observations and three control-plane jobs) and then `88fadf3` (merged `33fb5ec`, the opening contract) had landed on `main` as non-steward commits, so the ancestor check was failing by two merges. Moved `head` to `33fb5ec`, `as_of` to 2026-09-23 and the "Where it is right now" heading to match. Added two "What changed recently" bullets and two "Where it is right now" bullets: the opening contract, read from `packages/core/src/editorial.ts`, `packages/contracts/src/v2.ts`, the three bumped station contracts and `docs/OPENING_LOOP_CALIBRATION.md`; and the trend-observation record, read from `2666761`'s own reasoning rather than restated from the diff. Extended the Verification bullet with the 616 and 620 test counts and, for the first time in this file, the standing FFmpeg caveat: `caption-analysis` and `evidence` cannot run in a container without the binaries and fail there with `spawn ffmpeg/ffprobe ENOENT`, which `2666761` had already recorded as pre-existing in its own commit message. Added `docs/OPENING_LOOP_CALIBRATION.md` to "Read next" as item 10.
- indexed: `docs/OPENING_LOOP_CALIBRATION.md`, the opening contract's decision record. It follows the form of `docs/REFERENCE_VIDEO_CALIBRATION.md`: an external reference held at `analysis_only` with only its hash in the repository, what the engine adopted, what it refused, where each check is enforced and how to roll it back. Not superseded. It was first committed at `8411555` as a proposal explicitly marked "observed, not confirmed", and rewritten at `88fadf3` once Krish approved it; the proposal text is superseded by the decision text in the same file and is recoverable at `8411555`.
- decision (Krish, 2026-09-23): the opening contract is active. `fixtures/feedback/opening-loop-contract-20260923.json` holds the record, with the confirmation excerpt and the capture boundary that keeps it from widening into the reference's thirty-second intro budget or the existing human-led-opening allowance. Two calls inside the approval are worth keeping visible because they narrow it: single-beat visual plans are exempt from the open-question rule, since a one-beat Short has no story after the hook and requiring a loop there would demand a structure the format does not have; and narrator standing stays a soft report rather than a gate, for the reason `docs/REFERENCE_VIDEO_CALIBRATION.md` already gives about camera motivation and countercase fairness, that a hard gate on a proxy blocks good work for a reason the engine cannot defend.

## 2026-09-21

- reconciled at `c62ac34`: three non-steward commits since `c8fdee3`, all in
  `apps/control-plane`, the editorial spine rather than the Video and Carousel
  Studio this file describes. `061d6fd` fixed a meter that swallowed its own
  write failures (`meter_add`'s returned error was discarded in a try/catch,
  so every Anthropic agent in `meter_daily` went dark on 2026-09-15 while the
  cron-written rows carried on, and the dashboard read "we spent nothing"
  instead of failing loudly) and ported prompt caching from control-center,
  opt-in per call site because a cache write costs more than an ordinary
  input token and pays off only when a prefix is genuinely re-sent inside the
  TTL. `67c3299` gave the AEO research engine a measured spend path through
  the same `anthropicCall` primitive rather than a second price table, adding
  `calls` and `day` so a batched reporter cannot make `runs` read 1 against a
  correct dollar total. `2ad04fd` fixed the same discarded-error shape in both
  `content_edit_events` writes, the PATCH choke point that is the only place
  the product sees a person's edit over the machine's, and unpinned
  `check-judges` from the literal wording of a comment, the same class of
  fault named in `AGENTS.md` that had already kept main red once this month.
  `c62ac34` is the merge of all three onto `main`.
- no "What changed recently" bullet, same reasoning as 2026-09-17, 2026-09-19
  and 2026-09-20: no document under this repo's `docs_roots` describes that
  subsystem.
- `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`,
  flagged again by the digest; no commit in this range touches carousel or
  video engine code or config, so the stamp was left as is rather than
  bumped without a check.

## 2026-09-20

- reconciled at `c8fdee3`: three non-steward commits since `2b3ddb2`, all in
  `apps/control-plane`, the editorial spine rather than the Video and Carousel
  Studio this file describes. `5a9fb88` stopped `research-topic` writing new
  rows in retired vocabulary: reads already resolved a retired slug to its
  live one before use, so a write in the retired spelling looked fine on
  every read afterwards while breaking the house rule that an unknown slug
  fails the write rather than degrading; fixing it also exposed that the
  research queries branched on the literal string `paid`, which a live slug
  can no longer match, so mind.the.gap would have been researched as a
  teardown with no dig of its own, and that `corpusForChannel` did not know
  the two renamed formats, so a piece written under a new name would have
  fallen through to the whole-corpus synopsis instead of its playbook.
  `d0513bc` fixed the reason main had been red since 2026-09-19:
  `check-inspiration-lane` asserted the exact wording of a status message
  instead of the invariant behind it, so the message's own improvement (
  distinguishing a quiet folder from an unreadable one, both of which used
  to report as one hedged sentence) broke the guard that was supposed to
  protect it. `c8fdee3` is the merge of both onto `main`.
- no "What changed recently" bullet, same reasoning as 2026-09-17 and
  2026-09-19: no document under this repo's `docs_roots` describes that
  subsystem.
- `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`,
  flagged again by the digest; no commit in this range touches carousel or
  video engine code or config, so the stamp was left as is rather than
  bumped without a check.

## 2026-09-19

- reconciled at `2b3ddb2`: three non-steward commits since `a32d571`, all in
  `apps/control-plane`, the editorial spine rather than the Video and Carousel
  Studio this file describes. `f413109` made an aborted investigation say why
  (`classifyRun` had discarded a reason the run already carried, so 2026-09-10
  recorded `http_200` while the body said no claim survived G3) and made a
  systemic composer failure fail the run instead of becoming a per-arc skip.
  `3007ec5` gave the engine the retry policy and the `app_secrets` key fallback
  the dashboard already had. `2b3ddb2` made the inspiration scan distinguish a
  quiet Drive folder from an unreadable one: both listed zero and the job had
  been printing one hedged sentence covering both for eleven days.
- no "What changed recently" bullet, same reasoning as 2026-09-17: no document
  under this repo's `docs_roots` describes that subsystem. That is now recorded
  as a standing gap in "Do not trust" rather than re-derived each time.

## 2026-09-17

- reconciled at `a32d571`: the only non-steward commit since `915d697` fixed a production incident in `apps/control-plane` ("stop the weekly surfacing killing itself on its own bulk upsert": every weekly arc-card write since 2026-08-26 died on a not-null violation caused by PostgREST's key-union behaviour on a bulk upsert, and a 200 response with `ok: false` and no `error` field was misreported to Krish as the literal string `http_200`). That subsystem is the editorial spine (`content-ideas`, `arcs`, `shifts`, the weekly brief) moved into this repo from `krishanraja/control-center` in PR #42, not the Video and Carousel Studio that `NOW.md`, `README.md`, `AGENTS.md` and `docs/CAROUSEL_ENGINE_STATE.md` describe; no doc in this repo's `docs_roots` names `arc_cards`, `classifyRun` or the weekly surfacing job, so no prose or stamp needed a change. `NOW.md` gained no "What changed recently" bullet for this reason. Moved `head` from `915d697` to `a32d571`, `as_of` to 2026-09-17 and the "Where it is right now" heading to match. `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`, flagged again by the digest; the commit touches no carousel code or config, so the stamp was left as is, same reasoning as 2026-09-13 and 2026-09-15. The repeated `SKILL.md` and `STATION.md` basenames the digest lists as duplicate candidates are one file per skill or per station by the repo's own directory convention (`.agents/skills/mindmake-video/stations/`), not an unlabelled duplicate of a single current file; no move.

## 2026-09-15

- reconciled at `915d697`: `NOW.md` carried `head: 5f2db20` and `as_of: 2026-09-13` while PR #70 ("Prove station artifact handoffs", `aaf97d5`, `d03e27c`, `39ee455`, merged `915d697`) had already landed as non-steward commits, failing the validator's ancestor check. Moved `head` to `915d697`, `as_of` to 2026-09-15 and the "Where it is right now" heading to match. Added a "What changed recently" bullet and a "Where it is right now" bullet for the new station artifact topology check (`external_inputs`, `terminal_outputs`, one producer per artifact, no orphaned output) and the ingest station's new `recording_brief_artifact` input, both read from `packages/core/src/station-harnesses.ts`, `packages/contracts/src/station-harness-v1.ts` and the PR body. Updated the Verification bullet with the PR's reported 62 test files, 575 tests, and noted the CI toolchain change (FFmpeg now downloaded from this repository's own authenticated release mirror rather than the upstream BtbN autobuild, `.github/workflows/ci.yml`). Reconciled `docs/ARCHITECTURE.md`, "Station machinery": added one paragraph describing the artifact topology check, since `npm run check:stations` now does more than the paragraph described. Checked `docs/OPERATIONS.md` and `.agents/skills/mindmake-video/SKILL.md` for FFmpeg or station-registry claims that the code changed; both already describe the machinery generically and needed no edit. `docs/CAROUSEL_ENGINE_STATE.md` still carries `Last verified: 2026-09-07`, flagged again by the digest; no commit in this range touches carousel-engine code or config, so the stamp was left as is rather than bumped without a check.

## 2026-09-13

- reconciled at `5f2db20`: `NOW.md` carried `as_of: 2026-09-13` and `head: 34a085a` while the "Where it is right now" heading still read "(as of 2026-09-07)", failing the validator's heading check. Moved `head` to `5f2db20` and the heading to 2026-09-13. Updated the art director bullet in "What changed recently" from "awaiting PR" to its merge (PR #68, `e33c181`) and added a bullet for PR #69 ("govern production as station harnesses", `20bf147`, `c51f080`, merged `5f2db20`), which carries Krish's 2026-09-13 ruling that production machinery must use independently governed station harnesses rather than one accumulating Markdown file. Added matching items to "Where it is right now" and "Read next" for the new `.agents/skills/mindmake-video/stations/` cards and `docs/ART_DIRECTOR_REPERTOIRE.md`. Checked the changed skill references (`SKILL.md`, `production.md`, `asset-safety.md`, `visual-direction.md`) and `docs/ARCHITECTURE.md`/`docs/OPERATIONS.md` against the PR diffs: already reconciled by the PR authors, no drift found. `docs/CAROUSEL_ENGINE_STATE.md` carries a `Last verified: 2026-09-07` stamp that the digest flags as older than the newest code change; no commit in this range touches the carousel engine, so the stamp was left as is rather than bumped without a check.

## 2026-09-07

- reconciled at `c90397b`: `NOW.md` carried `head: 8477f04` while `867a88e` (portable confirmation refs at every gate, radar as importer, one carousel doc) and `8e42b15` (a test fix) had already landed on `main` as non-steward commits, so the validator's ancestor check was failing. Both commits had already reconciled `NOW.md`, `README.md`, `docs/CAROUSEL_ENGINE_STATE.md`, `docs/DEPLOYMENT.md` and `docs/ENGINE_SESSION.md` by hand; this run added the missing "What changed recently" bullet for PR #40, noted the portable confirmation extension in "Where it is right now", moved the `docs/CAROUSEL_ENGINE_STATE.md` verification stamp to `c90397b` after checking its confirmation_ref and appendix claims against `packages/core/src/carousel.ts` and `packages/contracts/src/carousel.ts`, and moved `head` from `8477f04` to `c90397b` (`as_of` stayed 2026-09-07, the same day).
- folded (2026-09-07): `docs/CAROUSEL_DECISIONS.md`, `docs/CAROUSEL_FEEDBACK_PROPOSALS.md` and `docs/CAROUSEL_RESET_TRACE.md` were merged into `docs/CAROUSEL_ENGINE_STATE.md` as Appendix A (Decisions), Appendix B (Feedback proposals) and Appendix C (Reset trace), every fact and date kept verbatim, and the three files were deleted. The `indexed` lines below name those files at their former paths. Same change: radar became a feed importer only (`rankRadarOpportunities`, `selectWeeklyBrief` and `RankedOpportunity` removed because they hard-coded `editorial_eligible: false`), the dead `cadence` block left `config/studio.json`, every approval gate accepts `studio-user-confirmation:<client>:<gate>:<hash>:<receipt>` beside the legacy prefixes through one shared `confirmationRefMatches` helper, and carousel approvals now require a `confirmation_ref` bound to the same gate and story hash.
- decision (Krish, 2026-09-07): the docs steward is adopted for this repo. `NOW.md` at the root is the one file agents are promised is current at its `head`; this log is the repo-wide chronology and where superseded material goes instead of being deleted. Procedure: control-center `docs/steward/RUNBOOK.md`. This repo's own rules (`CLAUDE.md`, `AGENTS.md`, `docs/ENGINE_SESSION.md`) outrank it.
- indexed: `docs/CAROUSEL_DECISIONS.md`, the append-only carousel decision record (seven decisions, all dated 2026-09-07, from "shared engine, separate director" to "publisher signature moved left"). Not superseded and not moved; it stays beside the state doc as the model for any future decision record in this repo.
- indexed: `docs/CAROUSEL_RESET_TRACE.md`, the dated trace of visual reset `2026-09-07-01`: rejected `built-editorial-gates-v1`, three generators, two blinded judges, selected `built-approval-interlock-v2`. Not superseded; scoped to the carousel engine only.
- reconciled at `efb3f80`: `docs/CAROUSEL_ENGINE_STATE.md` gained one `Last verified` line because it declares itself the single current-state artifact. Its body was checked against `config/carousel-visual-direction.json`, `docs/CAROUSEL_DECISIONS.md` and PR #36 and found accurate. No other document in this repo carries a date stamp and none was added; the repo describes status by contract and gate.
- reconciled at `efb3f80`: `README.md` said rendering "remains policy-blocked until Remotion licence eligibility is explicitly recorded". That sentence was written in PR #1 (2026-08-28) before PR #7 recorded the eligibility in `config/studio.json` the same day. It now describes the check as `packages/core/src/doctor.ts` performs it: rendering fails closed unless the record is present, and `studio doctor` reports the check.
- note: this bootstrap also adds `.github/workflows/docs-steward.yml` (a copy of control-center `docs/steward/caller-workflow.yml`, cron 20:30 UTC) and `.steward/` to `.gitignore`. Both are outside the steward's `**/*.md` allowlist and were added by hand, once, for the bootstrap.
- reconciled at `8477f04`: `origin/main` moved to PR #39 ("Consume approved Control Center production briefs") while the bootstrap was written against `efb3f80`. The bootstrap commit was rebased onto it; `NOW.md` now carries `head: 8477f04`, a bullet for #39 and the runner intake path in "Where it is right now". #39 changed `docs/OPERATIONS.md` (new "Control Center production intake" section, typical runs start from a brief) and two bullets in `.agents/skills/mindmake-video/SKILL.md`; both were read and neither contradicts the state doc or README. The `Last verified` line on `docs/CAROUSEL_ENGINE_STATE.md` was moved to `8477f04` because its body is unchanged by #39.
- reconciled at `48a2a68` (2026-10-01): `NOW.md` gained piece 3's fact-gate status and the F52 proposal from `docs/walks/2026-09-three-piece-walk.md`. No other document changed; no bullet was old enough to roll.
