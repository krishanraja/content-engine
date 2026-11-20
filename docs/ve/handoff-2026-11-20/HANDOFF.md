# Handoff: one-shot video production (20 Nov 2026)

For a Claude session on another account picking this up cold. Read this file first, then `PLAN.md` beside it. Everything the old session knew that is not in the repository is in this folder or named below. Nothing here needs the old account.

Repositories: `krishanraja/content-engine` (the engine; almost all of the work), `krishanraja/control-center` (the board UI; one open piece of work), `krishanraja/ai-harness` (doctrine and skills, read-only here). Start the session the way `AGENTS.md` says: `python3 scripts/check_failures.py`, `python3 scripts/floor.py --format short_video`, `WORKBENCH.md`, `NOW.md`, `docs/NORTH_STAR.md`. This handoff moves the North Star's quality side (every piece at 10/10, under an hour a week deciding); the count is at U4 (4 of 12 assets that week).

## 1. Why this exists

In the week of 17 to 21 Nov Krish produced three videos and all three missed their dates and were painful: Tue 17 "AI Midterms" (piece b019dbf8), Wed 18 "Build or Buy" (db9f9f6a), Fri 20 "AI Auditor" (c00cd4e0). About 50 hours of session time, 30 to 45 actions from him per piece, and two finished cuts he refused to publish ("a zero out of ten"). He asked for production that is "as seamless, one-shot, high-quality, and world-class as possible", with the fewest clicks and the fewest tiny-error fixes.

The audit (nine agents, transcripts plus code, each cause checked by a sceptical verifier) is in `evidence/audit-*.md`. The ranked root causes:

1. The engine and its rules changed under an in-flight piece (about 5 to 7 h a video): new rules bound to unshown cuts, every renderer fix moved a whole-tree hash that needed a typed approval (17 on Wed 18 alone).
2. Styles combined with no proof they work together (about 4 h a video): 27 caption styles over 14 motion styles, almost none tested.
3. Facts typed by hand or checked only after render (vertical takes on 16:9, titles, beds, logo bounds).
4. Checks after render that duplicated the renderer's geometry and failed its own output (OCR, plain-frame guard, 61 pre-critic runs).
5. Learnings kept as prose came back; learnings that became code held.

What he actually likes and dislikes came out of the shot study (`evidence/shot-study.md`): the good cuts use ONE staging for the whole cut, his face on screen 91 to 97.5% of the time, real images that fill their region. The rejected cuts used 3 to 4 layouts, 14 to 18 face switches, tiny cards on blur, 100 s of generated stills, empty panels. His diagnosis of the recipe approval: "I don't actually think these are the problem. I think how we integrate title cards and real-world images and motion animation is the issue."

## 2. His rulings this week (all recorded in commit bodies as `Ruling (Krish, date): ...`; exact words are in the taste ledger via `get_approved_taste` / `report_to_taste_engine`)

- **Rules and engine freeze at Sign storyboard** (19 Nov). A new rule or fix binds from the next piece; `bind_unshown` is gone. New rules bind only to pieces frozen on or after 2026-11-23 (`scripts/velib/floor.py` `RECIPE_FROM`).
- **No approvals during production** (19 Nov): "We need to eliminate the 4 million approvals like this that I'm required to make... the engine refuses to move on." Only four asks are allowed (`config/ve/asks.json`): lock, scripts+storyboard, final, publish. Filing to his own post folder is not an approval. `scripts/validate-skills.py` refuses a skill that tells a session to wait mid-production.
- **A 0/10 cut must never reach him again** (19 Nov): the quality floor (section 3).
- **Nothing is ever drawn over his face**, captions and generated animation come only from the recipe.
- **Style menu is proven recipes plus one named experiment slot**; third-party logo cards are allowed as evidence; our own mark only on the title and close.
- **All 10 recipes approved** (20 Nov, `style-board-verdicts.json`). One staging per cut (BAND, STAGE or ANCHOR), the shot grammar approved (20 Nov).
- **Generated imagery is wanted, art directed** (20 Nov): "we actually do use AI to generate a lot of striking imagery... The AI music video is a really good example." Allowed when clearly a metaphor and art directed (`depicts: metaphor`); fake documents, signs, real people and places are refused.
- **The tall close is the 9:16 intro sting with "Built to help you decide." layered on** (19 Nov, artifact FnDVNoCk1CqxGKTHRYENKH), built 20 Nov as outro direction A: "A, with Built to help you decide, and then Subscribe free at makeyourmindup.ai".
- **Title slide: direction A** (20 Nov): "the audio waveform imagery behind it was built specifically for the AI Music piece, so that would change accordingly to the piece in a similar style. Also... this is one of those examples of things we can make more classy/premium." The title lands as he says the title words, within the opening 30 s.
- **New colours approved** (ember, ember_deep, plum, plum_deep, peach): big moments, gradients and duotone cut-outs only, Mon/Wed/Fri only.
- **Keep what he liked** (20 Nov): the Character.ai top-half style (tall cut sha 39f1039c, Drive 1Ll0n3YD8sqzUWHP6h5sI8helefOgVtRV; wide 1A8mx4YTcgchPLbmvBuFzde2_hCZ9H6Mh) as the default for platform walkthroughs, and the additive badge grid (Mon 2 Nov, card `docs/ve/styles/eating-jobs-ladder.card.json`) as the default for any share or count on follow.the.money. Both are marked `liked` in `config/style-references.json`.
- **Spend:** one credit ceiling signed at the lock covers a piece. One approved RunPod GPU matte comparison, about $0.10, hard cap $0.50.
- **Heavy visual work goes to Codex** (20 Nov), model `gpt-6.2-astra` set per card; the engine's default pin stays `gpt-6.1-sol` (`scripts/velib/cards.py`).
- His misunderstanding to avoid: "my comment above was for you to MAKE SURE" (he told me the board and pipeline were stable; he meant: verify, do not just assume). Verify before claiming stability.

## 3. What is built and merged (content-engine, all on main)

| PR | What |
|---|---|
| #941 | Wave 1: no-approvals route, `asks.json`, freeze at storyboard, Drive review route |
| #942 | Quality floor: `scripts/velib/floor.py` (pace floor, body-only; face keep-out `keepout.py`; dead-panel lint; recipes rated or approved; blind judge `ve judge` at 8/10); board view ETag stable |
| #944, #945 | Overnight preflight fixes (`$Pinned`, Codex lookup) |
| #946 | Home-copy self-heal (`scripts/home-copy.ps1`, `checkout_tidy.mjs` prints realign commands) |
| #947 | 10 recipes (`config/ve/recipes/*.json`) and `ve recipe rate` |
| #950 | Shot grammar: stagings BAND, STAGE, ANCHOR; shots PLATE, IN-WORLD NUMBER, CHAPTER, TITLE LOCKUP (full frame at most 2 s), END CARD; seven checks (`scripts/velib/grammar.py`, `shots.py`, `config/ve/shot-grammar.json`) |
| #951 | The three own-cut styles marked liked |
| #952 | Sting close (from 23 Nov), accent colours, platform-walkthrough devices and unit-chart parts (event tape on `marquee`, tiled UI wall on `video_wall`, per-word headline colour, loops on `photo_plate`, badge grid on `unit_field`) |
| #953 to #955 | RunPod matte pod runner and workflow `matte-trial.yml` (two runs failed at $0 and the work stopped; no comparison exists) |
| #956 | Depth: `ve matte` (MediaPipe, offline, cached by take sha256), words behind him, in-world numbers, chapter marks, anchor rebuilt, stage fixed, `grammar.title_timing`, `panel.fill`, the generated-imagery rule |

`krishanraja/control-center`: #986, #987 (the board's read sheet whole on phones, Move to... restored). Nothing for the four-press board yet.

Drive review of any video over 10 MB (the Drive connector refuses it): `python3 scripts/post-pack/drive_review.py <Drive link>`.

## 4. Open, and honest about it

- **Staging gaps (from the build report, not fixed):** stage 16:9 is held by the pace floor (2.81 events a second, floor 2.87); one stage 9:16 caption page touches the face margin after render; `channel.safe_zones` fails for mint-word captions on the seam band on stage 9:16; `captions.ocr` and `captions.render` fail on mint-word cuts; the anchor's devices are small and its title can hide "skeletons" behind his head and is cut at 6 s. Do not lower the floor; fix the cause.
- **Matte quality is unverified** on hair and hands. The GPU comparison never ran. If MediaPipe edges look cheap on his real takes, a rented-GPU model is the fix (RunPod key is a GitHub Actions secret; `scripts/velib/maxine_pod.py` and `matte_pod.py` show the pattern; cap spend; he must say yes to each run).
- **Title slide premium** is queued to Codex as card `ve-title-premium-a` (queue item `codex-ve-title-premium-a`, model gpt-6.2-astra). It builds on his home computer's lane; check with `python3 scripts/ve.py lane wait codex-ve-title-premium-a`. When it returns: re-run its acceptance, look at the stills at both ratios and the motifs (`bars`, `ledger`, `grid`, `none`), show him. The card has no mock frames (images are not committed); the look is in `polish-spec.md` and `polish-generators/`.
- **Platform logos:** the walkthrough header needs the platform's registered logo (`config/logo-registry.json`, hash-matched, never redrawn). Brandfetch credits were exhausted (error: plan has no API credits); Krish is topping up (key for Control Centre is the Vercel env `GATEWAY_BRANDFETCH_KEY`; the claude.ai Brandfetch connector may need a reconnect). Not needed until a platform piece is made.
- **Off days** have no sting, so keep the mint close until he decides. Quick-edit's kit does not film the sting close.
- **Recipe rating:** the plan wanted a recipe golden rated 9+ by him before use; he approved all ten as a menu but nothing is rated from a real cut yet. The first real cuts are the proof.
- **Open PRs not mine:** #948, #949 (rejection floor, standards check-in, Krish's answers), #943 (steward), #926 (Thu habits). Leave them.
- **The style-approvals board** is a claude.ai artifact owned by the old account; its verdicts are saved in `style-board-verdicts.json`. You do not need it. Claude artifacts are retired for this repo anyway (AGENTS.md rule 3).

## 5. Remaining plan, in order (`PLAN.md` has the full table; status as of this handoff)

Believed done (the old session's account of it; check each against `git log` and its named test before relying on it): the stranded fixes, approval timestamps, dead caption lint, pre-critic binding, pin at `ve expect`, freeze at storyboard, pre-render lints, recipes and the shot grammar (plan 0 to 9), the close and one renderer (14), the depth recipe with an unverified matte (15), and the no-ask guard and ungated filing (17, 17a: `config/ve/asks.json`, `validate-skills.py`).

Not done:
- **QC reads the renderer's drawn boxes** (plan 10): delete the four hand copies of geometry in QC, make OCR advisory for picked styles, `ve doctor` refuses missing QC tools. Today's QC still false-fails art-directed captions.
- **`ve expect` prerequisites** (plan 11): beds, logo bounds, credit dry run, article, matte availability.
- **One route after recording, docs reconciled** (plan 12): `config/overnight.json`, produce-video skill, `PRODUCTION_PLAN.md`, `RUNBOOK.md`; forced alignment; speed-up only with his words.
- **`ve spec` from `plan.json`** (plan 13).
- **Control Centre board cut to four presses** (plan 16): lock, scripts+storyboard, final review (one screen with both cuts, article, the engine's chosen title, thumbnail and cover each changeable in one press, critic notes, seal bound to file sha), publish. Reuse the rebuilt UI's kit only; no new surface or data path (his ruling: "the board UI is stable. The data pipeline is stable as well."). His UI inspiration is Drive folder `1ylI3_g4gSFqW_Qm038i92vKiCDLidqeN` (stepper, attachment-states, cards-filing, accordion, side drawer, modal). The style picker shows the ten approved recipes first, others behind "Try as this piece's experiment", refused ones hidden. Plan 16's constraints are in `PLAN.md`.
- **Platform logo card, title premium, anchor/stage fixes**: see section 4.

## 6. What the system must do on its first real use (Mon 23 Nov, then Wed 25 and Fri 27)

Everything frozen on or after 2026-11-23 binds to the new rules (`RECIPE_FROM`), and a series cut from that date closes on its own intro sting. Before the first piece:

1. On whichever machine renders it, fetch the sting clips: `python scripts/quick-edit/intro.py fetch`. Without them `ve render` refuses the cut by design.
2. Both home computers must be clean: run the preflight (`scripts/overnight/preflight.ps1`) and confirm ffmpeg and Codex are found; `checkout_tidy.mjs` and `scripts/home-copy.ps1` self-heal copies after a rewrite of main. Do not touch the SURFACE machine's `runner-source` (it is pinned to a backup tag).
3. Pick a recipe at the lock (the ten approved ones in `config/ve/recipes/`; `data-story` for a follow.the.money count, `character-ai-receipts` for a platform walkthrough, `depth` for words behind him). One staging per cut.
4. Run it the allowed way: lock, then scripts plus storyboard in one press, then he records, then everything unattended to the final review. Record every default the engine chose on the final screen with `python3 scripts/post-pack/making.py PIECE final-review KEY "LINE"`; never ask mid-production.
5. Use `ve judge` (blind, against his references) and the floor before showing him anything. A held cut is rebuilt once on a stronger recipe, never patched beat by beat.
6. Heavy visual builds go to Codex as cards (`python3 scripts/ve.py card <fields.json>` then `ve lane queue <card.md> --ref <branch>`; `USERPROFILE` may need setting on Linux). Claude orchestrates, verifies, files; Codex's own report is never proof.

## 7. What it has to prove

Measure these on the first piece and write them into a `now-notes/` closeout (never edit NOW.md on a branch):

- Krish's presses from lock to publish-ready: **4**, plus the recording. Typed approvals: **0**. Mid-production asks: **0**.
- Whole renders per cut: **at most 2**. Publish-ready by its date.
- Every cut clears the quality floor: pace not below every reference, no dead panel, face keep-out, `ve judge` at or above 8/10, title starts on his spoken title words within 30 s.
- The sting close renders at 9:16 (exactly 2.0 s) and 16:9 (settled by 2.53 s, right 44% clear) and the brand guard passes.
- No engine or rule change reached the piece after its freeze.
- At the end, the count of fixes he had to make by hand: target none.

## 8. Then stabilise and lock down

Only after one clean piece:
1. Rate the recipe that was used from the real cut (his 9 or more); the unrated ones stay on the menu under the experiment rule until a real cut exists.
2. Fix the section 4 staging gaps with real cuts as the test, then add goldens for the two protected baselines (the Character.ai top half and the badge grid), so a later change cannot regress them. The repeat rule may refuse the badge grid if it comes back in more than three separate runs (unmeasured).
3. Convert every learning from the week into code where it can be: the failure and learning ids are in `config/failures.json` and `config/learnings.json` (this week's: `no-approvals-mid-production`, `one-staging-per-cut`, `style-recipes-approved`, `series-close-is-the-sting`, `accent-kit-big-moments-only`, `protected-baselines-walkthrough-and-unit-chart`).
4. Hide the rejected styles from the picker, keep them stored; no purge.
5. Keep the freeze: engine changes land between pieces, never during one. Update the North Star line from the real count. Report to Krish in one page.

## 9. Working rules and costs

- Never publish, send or spend beyond approvals. Never print or write a credential. RunPod and other keys are GitHub Actions secrets or network secrets, never in files.
- Record each ruling once in the acting commit body: `Ruling (Krish, YYYY-MM-DD): ...` plus a `Failure:` or `Learning:` id (CI `check_ruling_linked` fails without it). Send his exact typed words to `report_to_taste_engine` (check `date -u` first; `said_at` must not be in the future).
- `npm run verify:quick` before every push. PRs auto-merge on green; never merge by hand; never edit NOW.md on a branch.
- Usage: the old account hit its weekly Claude limit on Opus (resets 25 Nov) after long Opus agent runs. Prefer Sonnet for orchestration and Codex cards (`gpt-6.2-astra`) for heavy visual building; keep review agents (`ve-critic`, `reviewer`) on Opus only when judgment needs it.
- If you spawn agents, tell Krish each agent's name; do not run Opus agents unattended for hours.
- The audit transcripts were not copied (private chats). Everything they established is in `evidence/`.
