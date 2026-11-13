# AGENTS.md

## Ownership (Rulings, Krish, 2026-10-26 and 2026-10-28)

This repository is the Make Your Mind Up content engine (Ruling, Krish,
2026-10-28: "content-engine, which is not a mindmake product, it's a
makeyourmindup product"; "Content-engine produces content for
makeyourmindup.ai, which is hosted at makeyourmindup repo"). Its `plan-week`
is the one ideation path: makeyourmindup's Watch, Score, Assemble and
Dispatch machine and its intake runner are superseded, and this engine runs
makeyourmindup's kill list from a pinned copy
(`vendor/makeyourmindup/kill-list/`). Package, environment and credential
names keep their `mindmake` spelling.

Content-engine owns content production and all production standards,
including carousel narrative, copy, design, rendering and creative QA.
Growth-MakeYourMindUp owns posting strategy, amplification planning,
social account management, authorised automatic distribution and channel
performance. Read docs/GROWTH-HANDOFF.md for the brief/package boundary
and docs/CAROUSEL-STANDARD.md for the transferred production requirements.
Use existing editorial/Studio routes; do not build a social scheduler here
or duplicate production standards in Growth. Public posting authority stays
with Growth's approved publishing route, not this repository.

Carousels changed hands on 28 October (Ruling, Krish, 2026-10-28: "take over
posting as well as creating new assets like carousels"). Growth now makes the
derived carousels, Notes, memes and off-day posts itself, to this
repository's `docs/CAROUSEL-STANDARD.md`, the rejection floor and the copy
lint. Content-engine keeps the standard and makes the hero assets: the
article, both cuts, thumbnails and covers.

**Publish boards:** the one live board is Control Centre's Content tab (`python3 scripts/post-pack/live_board.py <Monday> [day]` prints its link); the old board pages at content.krishraja.com/board are retired for good and redirect to it (Ruling, Krish, 2026-11-13: the old publish boards are retired for good, and everything old in content-engine is retired). How every actor feeds it, reports to it and files on it: `docs/PUBLISH_BOARDS.md`. Older board instructions in this repository are history.


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
4. Feed the live board by writing what its view reads, and report and file on the piece as you work (`docs/PUBLISH_BOARDS.md`, "One live board" and "Sessions and materials"); never build or publish a board page (`tests/one-live-board.test.ts`).
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

**Every video script opens straight on its hook, closes on the one thing he would do, and a slow listener can follow it heard once; every article ends with "3 things you can do tomorrow".** ([detail](docs/AGENTS-REFERENCE.md#rule-11))

**Each script goes to Krish's teleprompter.com account once he approves its exact words, and nothing there is ever deleted.** ([detail](docs/AGENTS-REFERENCE.md#rule-12))

**Web publish board migration (19 October 2026).** ([detail](docs/AGENTS-REFERENCE.md#rule-13))

**The week's publish board is where Krish ticks; the piece's making record is where it counts.** ([detail](docs/AGENTS-REFERENCE.md#rule-14))

**Every board item says how it ends; record the fact and the check closes it.** ([detail](docs/AGENTS-REFERENCE.md#rule-15))

**`manual` means Krish's words; never write it.** ([detail](docs/AGENTS-REFERENCE.md#rule-16))

**Codex on a Windows home computer:** ([detail](docs/AGENTS-REFERENCE.md#rule-18))

**His feedback on ideas is kept as cues, permanently** ([detail](docs/AGENTS-REFERENCE.md#rule-19))

**Every opening, close, icon, wordmark and sting comes from `config/brand-palette.json` and nowhere else; `scripts/brand_palette.py` refuses a cut that differs (Ruling, Krish, 2026-11-12).** ([detail](docs/production/BRAND_PALETTE.md))

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
- **Drive folders are load-bearing.** Read `docs/DRIVE.md`; use IDs. Brand assets come only from `1 Brand kit (permanent)`, music included, never `_Archive` (Krish, 2026-11-11; `docs/DRIVE.md`, "The brand kit").
- **Leave the knowledge in the repository.**
- Never commit media, credentials, OAuth state, job data, archives or derived indexes. Never expose secrets.

[Detail](docs/AGENTS-REFERENCE.md#rules-for-every-agent).

## Video production

Video is made with `python scripts/ve.py`: read `docs/ve/ENGINE.md`, follow `docs/ve/RUNBOOK.md`. One signed spec (`creative-direction.json`, `schema_version: 2`); no per-piece compositions or render scripts. Codex is a visual asset maker (Ruling, Krish, 2026-10-28: "Visual asset maker"): it builds library devices from cards (`card`, `dispatch`, `verify-card`) and makes visual plates for named slots, and it never edits a cut. Every cut is held to the signed motion standard (`docs/ve/MOTION_STANDARD.md`). Motion styles live in one bank, the `motion` layer of `config/style-references.json`; Claude picks one per piece (`style.motion`, which `ve lint` requires from 9 Nov 2026), and every card for that piece carries it as its own `## Motion style` section. Codex builds to that section's rules and never-list, under the brand tokens and the design lock, and never picks or mixes a style itself. ve has no publish verb. Quick-edit stays the fallback until ve passes Phase 3. Local runs use `. scripts/ve-env.sh` (Bash). Licensed music lives only at `MINDMAKE_MUSIC_ROOT` with `config/music-library.json`; never browse Drive for audio.

Code check (28 Oct 2026): compile/render lint first and use shared FormatMaster. The schema makes `signed` optional; sign-off remains an operator gate. `docs/ve/RUNBOOK.md` is the procedure and `docs/ve/STATUS.md` says what ve can and cannot do today. Phase 3 fallback is policy, not a CLI switch. [Legacy route](docs/AGENTS-REFERENCE.md#rule-17).

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

Run `npm run verify:quick` before pushing (every guard of `npm run verify`, the tests related to the change and the publishing-safety tests, in minutes); CI runs the same on the pull request, and the full `npm run verify` on Linux and Windows with the browser jobs runs after merge in `.github/workflows/full-verify.yml`, which never blocks a merge and opens one issue when main goes red (Ruling (Krish, 2026-11-11): quick checks on pull requests, the full verify after merge; merge fast and he tests live.). Validate skills with `npm run skills:validate` (`python scripts/validate-skills.py`). After skill edits run `python scripts/validate-skills.py --sync-claude`: Claude's copies must be real identical files. Content engine: `npm run typecheck:control-plane` and `npm run check:control-plane`. Known main failures: `docs/STATE.md`; fix anything else. [Detail](docs/AGENTS-REFERENCE.md#verification).

## Commit and closeout

Commit code/config/specs/small data before stopping; file media through the authorised library route. Verify before pushing. Pushing straight to main is allowed (Krish, 2026-11-09: "change content engine settings to allow pushes to main and force pushes"); the usual route is still a session branch and a pull request. Engine work never waits on a hand merge: run `npm run verify:quick`, push the session branch, open a pull request, and `.github/workflows/auto-merge.yml` merges it to main once CI is green (CI is the quick checks; the full verify runs after the merge and a red main is fixed fast from its issue). Every pull request merges itself, ve included; nobody merges by hand (Ruling, Krish, 2026-11-03: "Change everything to auto-merge all the time. No manual merging"). Fix red CI on the branch. Zero Claude routines (Ruling, Krish, 2026-10-29: "FYI, I want zero Claude routines. No Claude schedules of any kind in this architecture"): no claude.ai scheduled or fired trigger, and no headless Claude on a home-computer timer. GitHub Actions is the scheduler ("Could you not get Github to trigger Claude subscription to do something and then update the content.krishraja.com board?"): judgment work runs as Claude Code inside a GitHub Actions job on his subscription (`CLAUDE_CODE_OAUTH_TOKEN`, never an API key) and writes to the board only through the engine API; `tests/no-claude-routines.test.ts` refuses anything else. Exactly two scheduled jobs may touch a publish board: the Sunday ideas board and the Monday final board (Ruling, Krish, 2026-10-28: "on a Sunday, Claude Code proactively brings me ideas"; "an overnight Codex run will actually produce me the final assets and the final publish board first thing Monday morning"). Ruling (Krish, 2026-11-11): the ideas board fills once a week in full, Saturday's good news included; the Thursday good-news schedule is retired. The first is `.github/workflows/sunday-ideas.yml`, which finds Saturday's good-news stories with the rest of the week's ideas; the second is no built page since 11 November: the live board reads the week's records, and the overnight runner reports each cut made or held on its piece (Wave 2; until then the first session on Monday), never Claude on a timer (`docs/CADENCE.md`). `.github/workflows/saturday-goodnews.yml` stays, by hand only, to find the stories again. No session creates a scheduled task (a routine, a trigger, a cron) that builds, updates or publishes a publish board, other than those two. Every scheduled job proposes; only Krish's Approve puts an idea on a publish board (the ideas gate, `docs/PUBLISH_BOARDS.md`). The timed API calls (the engine's Vercel crons, inspirationhouse's daily runs, the fact gate) stay, held under $15 a week for this chain (Krish, 2026-10-29: "happy with $15 a week"). So, until Krish says otherwise, any other scheduled job (the Monday repair round, the titles default when he has not pressed) writes records only, and the live board shows them at its next read.

Guarded rules. When Krish asks for files, hand him the files themselves. When he asks for something in Drive, put it in its post's `3 Posts` folder (Ruling, Krish, 2026-11-03: "everything ready for post goes in the posts folder, not the growth folder"), read it back, and reply "Done" with the link; nothing else ("WHEN I ASK YOU TO PUTTHINGS IN DRIVE IT SHOULD JUST BE REPLIED TO WITH 'DONE'", 2026-11-03; `config/failures.json` F29). Before designing a cut, open the inspiration board's cards for it and name them in `brand.references` (F26). His words are exact typed quotes; a paraphrase stays an observation; a question his feedback already answers is not asked ("If you read what I am feeding back, it's pretty obvious what it is"). Inspiration links go to `Production Inspo` or `Content Inspo` ([detail](docs/AGENTS-REFERENCE.md)).

Closeout: never edit NOW.md on a branch (`scripts/check_now_untouched.py` fails the pull request; steward branches excepted). Two pull requests editing it at once conflicted, auto-merge could merge neither, and they sat open while main moved on (2026-11-10). Write `now-notes/YYYY-MM-DD-<slug>.md` instead, with `Status:`, `Next:` (the single next action), optionally `Changed:`, and one dated line, starting with the words themselves, no dash or bullet in front:

```
North Star check (YYYY-MM-DD): holds.
```

(or `recalibration proposed. <why>`). The dash belongs to NOW.md's copy of the line, which the fold writes; a note's line with a dash never folds (three sat on main unfolded, 11 and 12 Nov). `npm run check:now-notes`, part of verify and so of CI, runs the fold's own code over every note before the merge, so a note that passes it always folds. Auto-merge folds the note into NOW.md on main and `scripts/now_trim.py` keeps the page under 14,000 bytes there; never trim it by hand. A change that needs no closeout says `Closeout: not needed, <reason>` in its commit body.

Only Krish changes the North Star. Task-specific restrictions override routine commit, board and closeout actions.

<!-- krish-repo-admin:start brain=379ce05f4241 sha=33ec6eef2668 -->
## Administer this repository

Use `docs/HARNESS_CONTEXT.md` for the owning workflow, source of truth and checks. Preserve the goal and accepted decisions when a revision changes one part; explain material trade-offs. Verify the downstream result. Record corrections and observed outcomes through the existing capture path. Experimental results retain their conditions; inferred requirements remain proposals.

Before any work run `python3 scripts/check_failures.py`. At session start read this week's comments on the one live board in Control Centre, as `docs/PUBLISH_BOARDS.md` says. Studio work requires `docs/ENGINE_SESSION.md`, `studio.session.open` and its tracked capability set; cloud Studio sessions stay read-only. Preserve observer attribution and Krish's actual decisions, keep exact feedback excerpts and never whole transcripts. `Video engine` remains the exact external launcher.
<!-- krish-repo-admin:end -->

<!-- krish-canon:start release=v2026.10.31.4 sha=49ccfe98b287 rendered=2026-10-31 -->
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
router. One primary writer; validators may stack after it, competing writers may not. **North Star:** before any work, read the North Star linked from the `north-star` block in `AGENTS.md` or `CLAUDE.md`, say which part of it the task moves, and say so first when it moves nothing; only Krish changes it, and a repository with none asks him for one. Then read the number's urgency (U1 to U5) in `NOW.md` and push at the intensity `contract/north-star-metric.md` sets for it; urgency never widens authority. A growth engine also follows that file's Engines section. **Close out:** before a session that changed the repository ends, write `now-notes/YYYY-MM-DD-<slug>.md` (`Status:`, `Next:` the single next step, and one dated North Star check line: holds, or recalibration proposed for Krish), folded into `NOW.md` on main. **One home per fact:** read a venture's state from its repository, doctrine from ai-harness; never keep a copy. **Taste:** where the Control Center connector offers them, before writing or designing for Krish read his approved rules with `get_approved_taste` (form only; empty means none yet, never invent one; without the connector, the `krish-voice` and `krish-design` copies), giving the repository you are in (owner/name) and, from a repository that serves several ventures, the venture the work is for; it returns only that venture's rules, never another's (Ruling, Krish, 2026-10-28: the taste ledger is keyed by venture, not repository), and when he corrects voice, design, a piece or an idea, send his exact typed words to `report_to_taste_engine` with where and when he typed them and the repository you are in (naming the venture from a repository that serves several); anything else you noticed goes only as an observation. A report writes only to his own taste ledger and is exempt from the approval wall above (Ruling, Krish, 2026-10-26: "reports to my taste ledger are exempt from the approval wall"); it is never a send, post or publish to anyone. Never answer a card or approve a rule for him.

**Who Krish is.** Purpose: "I see what is coming before it is obvious and make it
legible to people while it still counts." Mindmake is his mission and his one company;
Heartside, Full Time, Legibility, CTRL and Pulse roll into it. One queue: the mission
leads, and product work is ordered beneath it by the live priority ladder. Profile,
decision rules and standing rulings: `skills/krish-principles/references/who-krish-is.md`
in the harness. What he works on is live, never copied here; read it from Control Center at
https://controlcenter.krishraja.com/api/canon/KRISH.md (and `PORTFOLIO.md` beside it).

**Where the rest lives.** The operating contract, the routing contract and the
30 curated skills are in `krishanraja/ai-harness`. On a machine with the harness installed the same skills are under the user skills root, and the local copy is
authoritative for reading; the repository is authoritative for what is correct. Where none is installed (claude.ai, a cloud session), read each skill live with Control Center `get_skill`.

**This repository's own rules:** `AGENTS.md`, `CLAUDE.md`, `docs/CAROUSEL_ENGINE_STATE.md`
<!-- krish-canon:end -->
