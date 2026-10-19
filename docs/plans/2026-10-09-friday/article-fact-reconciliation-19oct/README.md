# Friday article: fact-gate reconciliation and approved prediction exception

## Scope and verification

Target: `krishanraja/content-engine`, based on main `e2a7b6b`.
Decision: identify and resolve the reported article fact failure without changing
approved copy or repeating paid checks. Read the current engine endpoint and its
implementation first; external factual research is needed only for an unresolved
claim. Stop when the exact body, sign-offs and remaining checks are reconciled.
No paid model run, publication, video change or article rewrite is authorised here.

Source of truth: the live piece and `/fact-check` response, captured in the adjacent
JSON files on 19 October 2026. The full body SHA-256 is
`1cf78c949a47c0da196bcd2cff31e8d8970e92ee982fcc73012f073fcfab6f52`.
The gate's confidence-normalised body hash is
`601d8558668e496a89c43ce62232c60b8c25d49218645186f81189aa65549a72`.
These are different hash contracts; neither indicates changed copy.

## Findings and correction

- The raw automated result says `passed: false`, with 11 blockers.
- All 11 have Krish's recorded sign-offs from 18 October. `gateStatus` and the
  live endpoint return `gate.ok: true` for this exact body.
- The repair handover incorrectly described the raw result as the effective
  fact gate. That statement is superseded here. Archived video evidence and its
  hash-bound receipts remain unchanged.
- The only blocking publication check is `CALL_HORIZON`: 30 June 2027 is 254
  days after 19 October 2026. The 92-day rule arrived in PR #107 after the
  article's approval. The plain-words warning is nonblocking.
- PR #107 already corrected making records to respect signed-through fact
  gates. No duplicate repair of that implementation is required.

## Krish's decision and implementation

Asked whether to retain the approved forecast as an exception or revise it,
Krish answered: **"Keep the approved forecast; allow an exception for this piece"**.
The article keeps 30 June 2027 and 85% confidence, with its falsifier unchanged.

The exception is versioned in `_publishChecks.ts` and requires both this piece's
UUID and the SHA-256 of its complete prediction section. It waives only the
maximum horizon, not an expired date, fact checks, confidence, or other rules.
Both the read endpoint and approval/publication guard pass the authoritative
piece ID. Missing identity and changed prediction text fail closed.

Pass signals: recorded body and fact-check hashes match; effective fact gate
passes; all blocking publish checks pass for this piece; negative tests cover
copied text, altered statement/date/confidence/falsifier, expiry and other failures.
After release, read back the same live body and all checks. Publication remains
a separate user decision. No paid rerun is needed.

Rollback: revert this exception commit through the normal reviewed PR path;
the 92-day blocker returns and the source article remains unchanged.

## Verification log

The first focused run passed 201 of 202 tests. One existing source-shape assertion
expected the former two-argument call; it now requires the explicit date and piece
ID at the approval guard. No production failure was suppressed.

## Release target and recovery

The authenticated Vercel connector verified project `content-engine`
(`prj_fDRrOHcBrGTdrdrwS7W6OBzLuelX`) at
`content-engine-flame-nu.vercel.app`, production, READY on main `e2a7b6b`.
Baseline deployment: `dpl_HgeYQydb6zvZ5F9GpMA2rQLFsAaw`.
Use the repository's required PR/CI/auto-merge workflow; its existing Git
integration publishes the merged code. No database edit or publication-state
transition is needed. Rollback is a reviewed revert of the exception commit,
then read back the prior horizon failure and unchanged body hash.

The corrected focused run passed all 202 tests. The full `npm run verify` run
passed both type checks, all 1,790 tests (one skip), and every subsequent check
through skill-core. Its final repository-map check found the changed function
signatures missing from the generated map. Regenerated `docs/REPO_MAP.md` and
reran `check:repo-map` successfully; no code changed after the passing tests.
CI must pass again on the final commit before merge.
