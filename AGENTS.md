# AGENTS.md

Rules for any agent working in this repository: Claude Code, Codex, Claude.ai,
ChatGPT or anything else. Read `docs/NORTH_STAR.md` first; it says what the
whole system is for, and every rule below serves it. `README.md` says where
everything is.

**Start every session with `WORKBENCH.md`**: what is waiting on Krish, what is
in progress and what is next, and how he wants to be worked with (plain words,
no project shorthand). Update it before you stop, so the next session, in any
tool, picks up where you left off.

**Every visual, interactive or animation makes a critical point land faster.**
Krish, 2026-10-05: "The visuals need to explain something critical in the
article in a way that would help them understand the point quicker. this needs
to be a permanent rule, right now the visuals just feel like gimmicks". Before
you build one, write the point it carries and the reader's question it answers.
Build it from the piece's checked numbers, quotes and evidence, never from
figures or icons acting out an analogy. If a reader who sees only the visual
would not get the point, do not make it. The rule is `VISUAL_EXPLAINS` in
`apps/control-plane/api/_houseRules.ts`.

**Every post's assets go into Krish's asset library the same day.** Krish,
2026-10-06: "make sure the brand kit is always updated here [the library's
Drive folder]", then "I want every single asset in there, permanent and for
individual posts, categorized properly, clear what to use them for, and every
new post gets its own new folder with all assets including the article HTML I
can copy paste, video scripts, etc etc". Pack every post's launch set with
`scripts/post-pack/build.py` and send it with `scripts/post-pack/send.py` the
same day it is made, and send a brand kit change with `send.py --brand-kit`.
His always-on Windows machine writes them into the makeyourmindup folder on
Drive (`scripts/library-sync.ps1`). The architecture doc's rule 0a.5 says
agents never write into his Drive; this is his explicit instruction for that
one folder, carried out by his own machine, and it covers that folder only.
`scripts/post-pack/README.md` has the layout and the commands.

**A recording in the Video Engine Inbox reaches a cloud session through
`python scripts/post-pack/recording.py get NAME`.** The Drive connector caps
downloads at 10 MB, so never tell Krish a recording cannot be reached; if the
lane fails, say which step failed: the recording has yet to reach the Inbox,
neither runner machine has sent it, or the download broke.
`scripts/post-pack/README.md`, "Recordings:
from the Inbox to a cloud session".

**Codex on a Windows home computer:** run `scripts/engine.py` and `git pull` or
`git push` outside the sandbox, asking Krish to approve. The sandbox runs as a
separate Windows user that cannot see the engine key or reach the internet.

## What this repository is

The Mindmake content engine: the engine behind Krish's publication and the
Shorts and carousels made from it. Two halves share one purpose and one
database:

- **The content engine**, `apps/control-plane/`: ideation, curation, drafting,
  iteration, channel copy, production briefs and the learning ledger.
  `docs/CONTENT_ENGINE.md`.
- **The Studio**, `packages/`, `apps/runner/`, `apps/renderer/`: Shorts and
  carousels from approved briefs, on Krish's Windows machine.
  `docs/STUDIO.md`.

Control Center (`krishanraja/control-center`) is where Krish works. This
repository serves it and has no interface of its own.

## Rules for every agent

- **Krish decides.** Approve, drop, publish, and every choice of taste are
  his. The engine and its agents propose, show their reasoning, and leave him
  the decision.
- **Your own actions are observations.** On the content engine an operator
  session's rows are `observation_only` unless it relays a decision Krish made
  in words, with `decided_by: 'Krish'`. Never relay a decision he did not
  make, and never write that he expressed a preference he did not state.
  Silence is not feedback.
- **Every durable taste or performance rule needs explicit user approval.** A
  rule is proposed, may be trialled, and becomes active only when he approves
  it and it lands in code or configuration.
- **Check before you ask.** Before putting a question to Krish, check whether
  an earlier answer already covers it, read for its reach rather than its
  literal wording. On mobile, ask in a plain message.
- **Public publishing is never automatic.** YouTube is private-only; LinkedIn,
  TikTok and Instagram Reels output stays a local draft package; the content
  engine never posts.
- **Truth, rights, confidentiality, meaning preservation and canonical naming
  are hard gates.** Never invent a number, a quotation, a source or an
  attribution; label inference as inference.
- **The mandate is the test.** Each subchannel's mandate lives in
  `venture_formats.mandate` and is read live. Never copy a mandate, the voice
  block or the corpus into code, a prompt or a document.
- **Voice.** Plain English and no em dashes in anything public. No "Not X, Y"
  construction in any piece, in either order (rule R2, Krish, 2026-09-24: "Cut
  it everywhere").
- **Spend.** Stay inside the amount Krish approved for the session and check
  `meter_daily`. Research through Perplexity, Exa and Brave is not metered, so
  count it yourself.
- **Drive folders are load-bearing.** Read `docs/DRIVE.md` before you put
  anything in Google Drive or move, rename or tidy a folder there. `Video
  Engine` and `makeyourmindup` are read by path and never move.
- **Leave the knowledge in the repository.** What you learn about the engine
  goes into `docs/STATE.md`, `docs/walks/` or the document it corrects, never
  only into a chat.

## Names

The publication's subchannels are **follow.the.money**, **mind.the.gap** and
**under.the.hood** (`follow_the_money`, `mind_the_gap`, `under_the_hood`). The Money
of AI and Built with AI were retired as subchannels on 2026-09-17 and survive
as aliases in `format_aliases`.

The Studio knows the three subchannels as series (`follow_the_money`,
`mind_the_gap`, `under_the_hood`) since 2026-09-26, and keeps **The Money of
AI** and **Built With AI** (`money_of_ai`, `built_with_ai`) valid for records
made under them: they sit inside hashed and signed records, so never rename,
drop or rewrite them (`packages/contracts/src/series.ts`, `docs/STUDIO.md`).
`paid` and `built` are its import aliases only. Wordmarks for the three
subchannels are Krish's decision; until he approves them a branded render
refuses. Every other retired name is in `docs/GLOSSARY.md`.

## Content engine invariants

- Every route that writes or spends is guarded: `guardEngine` for the idea,
  ledger and judge routes, the cron guards for scheduled jobs, the runner and
  MCP guards for the Studio. A new route never uses `preamble`, which checks
  nothing. The routes that still do are a known risk (`docs/STATE.md`).
- `content_edit_events` is append-only, enforced by a trigger. A wrong row is
  corrected by a new row or a note in the walk log, never by an update.
- Most routes read a row, call a model, then write the whole `meta` back. Run
  such calls one at a time, and guard new writes on `updated_at`.
- Draft, revise, final pass and the draft judges read the subchannel's
  mandate; a new drafting or checking stage must too.
- The content engine owns new DDL for content and Studio tables; add it under
  `supabase/migrations/`.

## Studio invariants

- Control Center is the governed mobile review surface. Codex may orchestrate
  the same versioned contracts, but the Windows runner must operate without a
  Codex session and must never depend on model availability.
- Do not add another production dashboard or a second media source of truth.
  Control Center stores only redacted projections, commands, review metadata,
  and private proxy references; local job artifacts remain authoritative.
- A Control Center review decision is not durable until the runner has
  validated its exact lineage and appended the domain-separated signed local
  decision event. Replays must finish idempotently and must never append a
  second decision or approval.
- A terminal cloud review becomes decidable again only after a signed
  `review_recovery_record` clones the exact authenticated local review
  identity. Recovery must prove the declared terminal reason from a failed
  receipt, signed claim journal, or the verified absence of both, and must
  never mutate active media.
- GitHub owns code and configuration. Never commit media, credentials, OAuth
  state, job data, archives, or derived indexes.
- Free-form magic-edit directions may compile only into schema-bounded
  presentation operations. Meaning, claims, evidence content, story structure,
  and unsupported changes return to the full editorial route.

## Portable engine sessions (the Studio)

- The Studio is a client-neutral engine that any supported client drives
  through the same contracts. Read
  `docs/ENGINE_SESSION.md` before using any Studio tool or recording feedback.
- A repository checkout provides instructions only; production authority
  comes from a tracked session. Mutations and durable learning are supported only when the Mindmake Studio
  remote MCP gateway reports a tracked session with the required capability.
- Never claim that an ordinary chat turn was captured. The gateway records
  structured engine actions, exact feedback excerpts supplied to a feedback
  tool, and artifact differences. It never stores whole third-party chat
  transcripts.
- If the gateway is unavailable, remain read-only and say that the session is
  untracked. Do not create local shadow memory.
- The global `video-engine` launcher retains its exact first-message trigger.
  Opening this repository makes engine tools discoverable but must not make
  unrelated video questions invoke the production workflow.

## Documentation

- The current documents and their order of authority are listed in
  `README.md`. `docs/history/` holds superseded documents and the dated log;
  nothing there is current.
- `NOW.md` and `docs/history/LOG.md` follow the docs steward's schema
  (control-center, `docs/steward/SCHEMA.md`); the steward reconciles them
  nightly. A superseded document moves to `docs/history/YYYY-MM-DD-<name>`
  under a Historical banner; nothing is deleted.
- When behaviour changes, update the document that describes it in the same
  commit. When Krish overrules a decision, record it in the commit body as
  `Ruling (Krish, YYYY-MM-DD): ...`.

## Verification

Run `npm run verify` before pushing. Validate all repo-scoped skills with
`npm run skills:validate`. For the content engine, `npm run
typecheck:control-plane` and `npm run check:control-plane`. Known failures on
`main` are listed in `docs/STATE.md`; anything else failing is yours to fix.

<!-- krish-canon:start release=v2026.10.05.1 sha=e5a0826723ee rendered=2026-10-06 -->
## Krish canon

Rendered from `krishanraja/ai-harness` at release v2026.10.05.1. Nothing inside these
markers is hand-maintained: an edit here is detected and proposed back to the canon,
never silently overwritten, and never lost. Everything outside the markers belongs to
this repository and is never read or rewritten by the harness.

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
router. One primary writer; validators may stack after it, competing writers may not.

**Who Krish is.** Purpose: "I see what is coming before it is obvious and make it
legible to people while it still counts." Mindmake is his mission; Heartside, Full Time,
Legibility, CTRL and Pulse are a separate product portfolio. Both are current: when they
compete for his own time, surface the trade-off and let him choose. Profile, decision
rules and paused plans: `skills/krish-principles/references/who-krish-is.md` in the
harness. What he works on is live, never copied here; read it from Control Center at
https://raw.githubusercontent.com/krishanraja/control-center/main/docs/KRISH.md (and `docs/PORTFOLIO.md` beside it).

**Where the rest lives.** The operating contract, the routing contract and the
29 curated skills are in `krishanraja/ai-harness`. On a machine with the
harness installed the same skills are under the user skills root, and the local copy is
authoritative for reading; the repository is authoritative for what is correct.

**This repository's own rules:** `AGENTS.md`, `CLAUDE.md`, `docs/CAROUSEL_ENGINE_STATE.md`
<!-- krish-canon:end -->
