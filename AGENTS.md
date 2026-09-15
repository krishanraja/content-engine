# AGENTS.md

## Product invariants

- Public series names are The Money of AI and Built With AI. `paid` and `built` are import aliases only.
- Control Center is the governed mobile review surface. Codex may orchestrate the same versioned contracts, but the Windows runner must operate without a Codex session and must never depend on model availability.
- Do not add another production dashboard or a second media source of truth. Control Center stores only redacted projections, commands, review metadata, and private proxy references; local job artifacts remain authoritative.
- A Control Center review decision is not durable until the runner has validated its exact lineage and appended the domain-separated signed local decision event. Replays must finish idempotently and must never append a second decision or approval.
- A terminal cloud review becomes decidable again only after a signed `review_recovery_record` clones the exact authenticated local review identity. Recovery must prove the declared terminal reason from a failed receipt, signed claim journal, or the verified absence of both, and must never mutate active media.
- GitHub owns code and configuration. Never commit media, credentials, OAuth state, job data, archives, or derived indexes.
- Public publishing is never automatic. YouTube is private-only; LinkedIn, TikTok, and Instagram Reels output remains local draft packages.
- Truth, rights, confidentiality, meaning preservation, and canonical naming are hard gates.
- Every durable taste or performance rule needs explicit user approval.
- Free-form magic-edit directions may compile only into schema-bounded presentation operations. Meaning, claims, evidence content, story structure, and unsupported changes return to the full editorial route.
- Use plain English and no em dashes in public copy.

## Portable engine sessions

- This repository is a client-neutral engine, not a Codex-only workflow. Read `docs/ENGINE_SESSION.md` before using any Studio tool or recording feedback.
- A repository checkout provides instructions, not production authority. Mutations and durable learning are supported only when the Mindmake Studio remote MCP gateway reports a tracked session with the required capability.
- Never claim that an ordinary chat turn was captured. The gateway records structured engine actions, exact feedback excerpts supplied to a feedback tool, and artifact differences. It never stores whole third-party chat transcripts.
- If the gateway is unavailable, remain read-only and say that the session is untracked. Do not create local shadow memory.
- The global `video-engine` launcher retains its exact first-message trigger. Opening this repository makes engine tools discoverable but must not make unrelated video questions invoke the production workflow.

## Verification

Run `npm run verify` before pushing. Validate all repo-scoped skills with `npm run skills:validate`.

<!-- krish-canon:start release=v2026.09.15.2 sha=2c6e96d98cc8 rendered=2026-09-15 -->
## Krish canon

Rendered from `krishanraja/ai-harness` at release v2026.09.15.2. Nothing inside these
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

**Where the rest lives.** The operating contract, the routing contract and the
29 curated skills are in `krishanraja/ai-harness`. On a machine with the
harness installed the same skills are under the user skills root, and the local copy is
authoritative for reading; the repository is authoritative for what is correct.

**This repository's own rules:** `AGENTS.md`, `CLAUDE.md`, `docs/CAROUSEL_ENGINE_STATE.md`
<!-- krish-canon:end -->
