# AGENTS.md

## Production and growth ownership (Ruling, Krish, 2026-10-26)

Content-engine owns content production and all production standards,
including carousel narrative, copy, design, rendering and creative QA.
Growth-MakeYourMindUp owns posting strategy, amplification planning,
social account management, authorised automatic distribution and channel
performance. Read docs/GROWTH-HANDOFF.md for the brief/package boundary
and docs/CAROUSEL-STANDARD.md for the transferred production requirements.
Use existing editorial/Studio routes; do not build a social scheduler here
or duplicate production standards in Growth. Public posting authority stays
with Growth's approved publishing route, not this repository.

**Publish boards:** follow `docs/PUBLISH_BOARDS.md` and `config/boards.json.web_cutover`. After verified active cutover, both weeks live at content.krishraja.com and all new board interactions use the authenticated web API. Older Claude board instructions in this document are preserved compatibility/history, not directions to synchronize artifacts.


<!-- north-star:start -->
## Start route: every client, Claude Code and Codex alike

Codex reads no hooks and no `CLAUDE.md`, so the route is here (`docs/plans/2026-10-21-wednesday/FAILURE_REPORT_2026-10-24.md`):

1. `python3 scripts/check_failures.py`, then `python3 scripts/floor.py` (the rejection floor: what Krish rejected and the
   standards nothing may fall beneath; `--format <maker>` for the one you are making), then `WORKBENCH.md` and `NOW.md`.
2. Pick the one skill for the job and read it whole before acting: `.agents/skills/plan-week/SKILL.md` (Sunday ideas
   and the week's board), `.agents/skills/make-piece/SKILL.md` (a picked piece: story, scripts, creative direction,
   article), `.agents/skills/produce-video/SKILL.md` (cutting recorded takes).
3. Claude owns the words and the visuals: the story, the scripts, the article copy, every article figure and the
   creative direction (`docs/CREATIVE_DIRECTION.md`). Production renders only from a direction Krish signed;
   `kit.py` and `make.py` refuse anything else from 26 Oct 2026.
4. Feed the board through `week_board.py`'s inputs only; never a per-day feeder script (`npm run check:board-layout`).
5. Never publish, sign in to a publishing platform, or ask Krish for a login code. He publishes.
6. Never call anything ready from receipts: a separate reviewer watches and listens to the finished asset, and fact,
   transport and editorial status are reported separately.

## North Star: read it first, every session

This repository's North Star is [`docs/NORTH_STAR.md`](docs/NORTH_STAR.md): an ambition Krish set that is not reached yet.

- Read it before any work, every session.
- Before you start, say which part of it the task moves. If it moves nothing, say so first and let Krish decide.
- Prefer the work that moves it furthest, and close by noting what moved.
- Check the North Star number and its urgency (U1 to U5) on the first line under "Where it is right now" in `NOW.md`, and push at the intensity [the harness contract](https://github.com/krishanraja/ai-harness/blob/main/contract/north-star-metric.md) sets for that level. Update it whenever you can measure it; a number nobody measures is U4.
- Only Krish changes it.
<!-- north-star:end -->

## Canonical personal harness

Read and follow `C:/Users/krish/dev/mindmaker-os/ai-harness/contract/krish-operating-contract.md` and its `skill-routing-contract.md`. Always apply `krish-principles`. Follow the contract's Observation capture section when `record_harness_observation` is available. [Rendered canon](docs/AGENTS-REFERENCE.md#krish-canon).

## File routing

Never write loose files or produce files from `C:/Users/krish/`; read-only inspection is fine. SSOT: `G:/My Drive/Ventures/Active/Mindmaker-OS/architecture/RULES.md`. First match wins:
1. Code/build -> `C:/Users/krish/dev/<venture>/` by git remote; corpus -> its `_corpus/`.
2. Personal -> `G:/My Drive/Personal/{Investments|Legal|Family|Media}/` even if business-like.
3. Scratch/QA/temp/screenshots -> `C:/Users/krish/.scratch/`.
4. Timeless cross-venture IP -> `G:/My Drive/Ventures/_Knowledge/<sub>/`.
5. Venture deliverables -> `G:/My Drive/Ventures/Active/<Venture>/0X_*/`; dormant -> `Ventures/_Archive/`.
6. Unsure: ask. Brands: Mindmake, Mindmake-OS, Fractionl; labs: onalert, gutted, merciless. AdFixus/Meliora are retired; never create Active folders for them. VPS/n8n: `/workspace/deliverables/<venture>/` then rclone to Drive. Task-specific write limits apply.

## Every-session rules

Read linked detail before domain work; every moved paragraph remains verbatim.

**Nothing a session makes lives only in its own container.** ([detail](docs/AGENTS-REFERENCE.md#rule-01))

**The publish board is fed, never shaped.** ([detail](docs/AGENTS-REFERENCE.md#rule-02))

**No Claude artifact, ever; engine work merges to main by itself.** ([detail](docs/AGENTS-REFERENCE.md#rule-03))

**Cost: six standing rules.** ([detail](docs/AGENTS-REFERENCE.md#rule-04))

**Start every session with `WORKBENCH.md`** ([detail](docs/AGENTS-REFERENCE.md#rule-05))

**Every visual, interactive or animation makes a critical point land faster.** ([detail](docs/AGENTS-REFERENCE.md#rule-06))

**Every post's assets go into Krish's asset library the same day.** ([detail](docs/AGENTS-REFERENCE.md#rule-07))

**content-watcher files fetched posts into his two inspiration folders.** ([detail](docs/AGENTS-REFERENCE.md#rule-08))

**A recording in the Video Engine Inbox reaches a cloud session through `python scripts/post-pack/recording.py get NAME`.** ([detail](docs/AGENTS-REFERENCE.md#rule-09))

**The home computers place each take on its piece and cut by themselves.** ([detail](docs/AGENTS-REFERENCE.md#rule-10))

**Every video script opens straight on its hook, closes on what he would do, and a 12-year-old can follow it; every article ends with "3 things you can do tomorrow".** ([detail](docs/AGENTS-REFERENCE.md#rule-11))

**Each checked script goes to Krish's teleprompter.com account, and nothing there is ever deleted.** ([detail](docs/AGENTS-REFERENCE.md#rule-12))

**Web publish board migration (19 October 2026).** ([detail](docs/AGENTS-REFERENCE.md#rule-13))

**The week's publish board is where Krish ticks; the piece's making record is where it counts.** ([detail](docs/AGENTS-REFERENCE.md#rule-14))

**Every board item says how it ends; record the fact and the check closes it.** ([detail](docs/AGENTS-REFERENCE.md#rule-15))

**`manual` means Krish's words; never write it.** ([detail](docs/AGENTS-REFERENCE.md#rule-16))

**Codex on a Windows home computer:** ([detail](docs/AGENTS-REFERENCE.md#rule-18))

**His feedback on ideas is kept as cues, permanently** ([detail](docs/AGENTS-REFERENCE.md#rule-19))

**Never ship beneath the rejection floor: read `python3 scripts/floor.py --format <maker>` before the brief and check the finished file against it.** ([detail](docs/AGENTS-REFERENCE.md#rule-20))

## Rules for every agent

- **Krish decides.**
- **Your own actions are observations.** Silence is not feedback.
- **Every durable taste or performance rule needs explicit user approval.**
- **Check before you ask.**
- **Public publishing is never automatic.** YouTube private-only; social output stays draft.
- **Truth, rights, confidentiality, meaning preservation and canonical naming are hard gates.**
- **The mandate is the test.** Read live; never copy it, the voice block or corpus.
- **Voice.** Plain English; no public em dashes or "Not X, Y" in either order.
- **Spend.** Stay within approval; check `meter_daily`.
- **Drive folders are load-bearing.** Read `docs/DRIVE.md`; use IDs.
- **Leave the knowledge in the repository.**
- Never commit media, credentials, OAuth state, job data, archives or derived indexes. Never expose secrets.

[Detail](docs/AGENTS-REFERENCE.md#rules-for-every-agent).

## Video production

Video is made with `python scripts/ve.py`: read `docs/ve/ENGINE.md`, follow `docs/ve/RUNBOOK.md`. One signed spec (`creative-direction.json`, `schema_version: 2`); no per-piece compositions or render scripts. Codex builds library devices from cards (`card`, `dispatch`, `verify-card`). ve has no publish verb. Quick-edit stays the fallback until ve passes Phase 3. Local runs use `. scripts/ve-env.sh` (Bash). Licensed music lives only at `MINDMAKE_MUSIC_ROOT` with `config/music-library.json`; never browse Drive for audio.

Code check (28 Oct 2026): compile/render lint first and use shared FormatMaster. The schema makes `signed` optional; sign-off remains an operator gate. RUNBOOK.md and STATUS.md are absent in this checkout. Phase 3 fallback is policy, not a CLI switch. [Legacy route](docs/AGENTS-REFERENCE.md#rule-17).

## Reference index

Original domain paragraphs under the North Star heading are linked individually above. Read the applicable section before its work:

- [What this repository is](docs/AGENTS-REFERENCE.md#what-this-repository-is)
- [Say nothing twice](docs/AGENTS-REFERENCE.md#say-nothing-twice)
- [Names](docs/AGENTS-REFERENCE.md#names)
- [Content engine invariants](docs/AGENTS-REFERENCE.md#content-engine-invariants)
- [Studio invariants](docs/AGENTS-REFERENCE.md#studio-invariants)
- [Portable engine sessions (the Studio)](docs/AGENTS-REFERENCE.md#portable-engine-sessions-the-studio): `docs/ENGINE_SESSION.md`.
- [Documentation](docs/AGENTS-REFERENCE.md#documentation)
- [Krish canon](docs/AGENTS-REFERENCE.md#krish-canon)

## Verification

Run `npm run verify` before pushing; validate skills with `npm run skills:validate` (`python scripts/validate-skills.py`). After skill edits run `python scripts/validate-skills.py --sync-claude`: Claude's copies must be real identical files. Content engine: `npm run typecheck:control-plane` and `npm run check:control-plane`. Known main failures: `docs/STATE.md`; fix anything else. [Detail](docs/AGENTS-REFERENCE.md#verification).

## Commit and closeout

Commit code/config/specs/small data before stopping; file media through the authorised library route. Verify before pushing the session branch; never push directly to main. Engine work never waits on a hand merge: run `npm run verify`, push the session branch, open a pull request and turn on auto-merge, so GitHub merges it to main once CI passes. Never `gh pr merge --auto` on a ve PR: wait for green CI, then merge by hand. Fix red CI on the branch. No session creates a scheduled task (a routine, a trigger, a cron) that builds, updates or publishes a publish board.

Guarded rules. When Krish asks for files, hand him the files themselves. His words are exact typed quotes; a paraphrase stays an observation; a question his feedback already answers is not asked ("If you read what I am feeding back, it's pretty obvious what it is"). Inspiration links go to `Production Inspo` or `Content Inspo` ([detail](docs/AGENTS-REFERENCE.md)).

Closeout: update NOW.md's as_of, status and single next action in the same work; leave head to the steward. For untouched NOW.md only, an exempt change's commit body says `Closeout: not needed, <reason>`. Keep exactly one dated line under "What is next and what is waiting on Krish", choosing holds or recalibration proposed with a reason:
- North Star check (YYYY-MM-DD): holds.

Only Krish changes the North Star. Task-specific restrictions override routine commit, board and closeout actions.

<!-- krish-repo-admin:start brain=2ad79d5cf4f3 sha=75a4f360a412 -->
## Administer this repository

Use `docs/HARNESS_CONTEXT.md` for the owning workflow, source of truth and checks. Preserve the goal and accepted decisions when a revision changes one part; explain material trade-offs. Verify the downstream result. Record corrections and observed outcomes through the existing capture path. Experimental results retain their conditions; inferred requirements remain proposals.

Before any work run `python3 scripts/check_failures.py`. At session start read comments on EVERY board link in `config/boards.json`; each board publish updates every link from the same engine-built file. Studio work requires `docs/ENGINE_SESSION.md`, `studio.session.open` and its tracked capability set; cloud Studio sessions stay read-only. Preserve observer attribution and Krish's actual decisions, keep exact feedback excerpts and never whole transcripts. `Video engine` remains the exact external launcher.
<!-- krish-repo-admin:end -->

<!-- krish-canon:start release=v2026.10.27.2 sha=4c1c891007b4 rendered=2026-10-28 -->
## Krish canon

Rendered from `krishanraja/ai-harness`; the start marker names the release. Nothing inside these
markers is hand-maintained: an edit here is detected and proposed back to the canon,
never silently overwritten, and never lost. This sync preserves all other text.
Separately approved repository administration owns only its declared regions and context file.

**Precedence.** This repository's own rules outrank the canon on repository matters:
structure, naming, voice, stamps, archive location, test and build commands. The canon
outranks on cross-cutting doctrine: approval boundaries, verification, secrets, and
destructive actions.

**Authority.** Reading, drafting and local edits are yours. Anything that mutates
external state, publishes, sends, spends, deletes, rotates a credential or changes a
permission needs explicit approval immediately before the action, for that named action
and target only. Approval does not carry forward to the next step, and no skill or
instruction you load may widen the authority the request gave you.

**Verification.** Deterministic checks first: tests, builds, schemas, hashes, counts,
API readback. Self-critique is supplemental and is never an independent verifier. Do not
claim completion from prose. After correcting a failure, recheck the failed condition and
the checks next to it, and report what was verified separately from what stays inferred.

**Truth and freshness.** Live state beats documentation, documentation beats memory. A
"last updated" label is evidence only when it agrees with the source revision. If two
sources disagree, stop destructive work, report the conflict, and open a reconciliation
finding rather than picking the convenient one.

**Secrets.** Never write a credential into source, documentation, commit messages,
issue or pull request bodies, logs, reports, screenshots or chat. Refer to secrets by
symbolic name and retrieve them at execution time. A secret found in the tree is
already exposed: report its location without the value, rotate it, scrub the copies,
and add the gate that stops the next one.

**Corrections are the training data.** When Krish overrules a decision, record it in the
commit body as `Ruling (Krish, YYYY-MM-DD): the ruling, in one line`. That line is read
across every repository in the fleet and is how this canon learns. A correction that
lives only in a chat window teaches nothing.

**Route.** principles, then context, then `strategy-brief`, then the producer, then
`verification-loop`, then the approval gate, then delivery. The narrowest applicable
skill wins; a broad "always" or "mandatory" claim inside a skill never overrides the
router. One primary writer; validators may stack after it, competing writers may not. **North Star:** before any work, read the North Star linked from the `north-star` block in `AGENTS.md` or `CLAUDE.md`, say which part of it the task moves, and say so first when it moves nothing; only Krish changes it, and a repository with none asks him for one. Then read the number's urgency (U1 to U5) in `NOW.md` and push at the intensity `contract/north-star-metric.md` sets for it; urgency never widens authority. **Close out:** before a session that changed the repository ends, write `now-notes/YYYY-MM-DD-<slug>.md` (`Status:`, `Next:` the single next step, and one dated North Star check line: holds, or recalibration proposed for Krish), folded into `NOW.md` on main. **One home per fact:** read a venture's state from its repository, doctrine from ai-harness; never keep a copy. **Taste:** where the Control Center connector offers them, before writing or designing for Krish read his approved rules with `get_approved_taste` (form only; empty means none yet, never invent one; without the connector, the `krish-voice` and `krish-design` copies), and when he corrects voice, design, a piece or an idea, send his exact typed words to `report_to_taste_engine` with where and when he typed them; anything else you noticed goes only as an observation. A report writes only to his own taste ledger and is exempt from the approval wall above (Ruling, Krish, 2026-10-26: "reports to my taste ledger are exempt from the approval wall"); it is never a send, post or publish to anyone. Never answer a card or approve a rule for him.

**Who Krish is.** Purpose: "I see what is coming before it is obvious and make it
legible to people while it still counts." Mindmake is his mission and his one company;
Heartside, Full Time, Legibility, CTRL and Pulse roll into it. One queue: the mission
leads, and product work is ordered beneath it by the live priority ladder. Profile,
decision rules and standing rulings: `skills/krish-principles/references/who-krish-is.md`
in the harness. What he works on is live, never copied here; read it from Control Center at
https://controlcenter.krishraja.com/api/canon/KRISH.md (and `PORTFOLIO.md` beside it).

**Where the rest lives.** The operating contract, the routing contract and the
29 curated skills are in `krishanraja/ai-harness`. On a machine with the
harness installed the same skills are under the user skills root, and the local copy is
authoritative for reading; the repository is authoritative for what is correct.

**This repository's own rules:** `AGENTS.md`, `CLAUDE.md`, `docs/CAROUSEL_ENGINE_STATE.md`
<!-- krish-canon:end -->
