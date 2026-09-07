# History log

Newest first. Entries are written by the docs steward (see the steward link in
`NOW.md`) and by people doing the same job by hand. Nothing in this file
describes current behaviour; `NOW.md` and `docs/CAROUSEL_ENGINE_STATE.md` do.
Files moved here keep their body verbatim under a Historical banner.

## 2026-09-07

- decision (Krish, 2026-09-07): the docs steward is adopted for this repo. `NOW.md` at the root is the one file agents are promised is current at its `head`; this log is the repo-wide chronology and where superseded material goes instead of being deleted. Procedure: control-center `docs/steward/RUNBOOK.md`. This repo's own rules (`CLAUDE.md`, `AGENTS.md`, `docs/ENGINE_SESSION.md`) outrank it.
- indexed: `docs/CAROUSEL_DECISIONS.md`, the append-only carousel decision record (seven decisions, all dated 2026-09-07, from "shared engine, separate director" to "publisher signature moved left"). Not superseded and not moved; it stays beside the state doc as the model for any future decision record in this repo.
- indexed: `docs/CAROUSEL_RESET_TRACE.md`, the dated trace of visual reset `2026-09-07-01`: rejected `built-editorial-gates-v1`, three generators, two blinded judges, selected `built-approval-interlock-v2`. Not superseded; scoped to the carousel engine only.
- reconciled at `efb3f80`: `docs/CAROUSEL_ENGINE_STATE.md` gained one `Last verified` line because it declares itself the single current-state artifact. Its body was checked against `config/carousel-visual-direction.json`, `docs/CAROUSEL_DECISIONS.md` and PR #36 and found accurate. No other document in this repo carries a date stamp and none was added; the repo describes status by contract and gate.
- reconciled at `efb3f80`: `README.md` said rendering "remains policy-blocked until Remotion licence eligibility is explicitly recorded". That sentence was written in PR #1 (2026-08-28) before PR #7 recorded the eligibility in `config/studio.json` the same day. It now describes the check as `packages/core/src/doctor.ts` performs it: rendering fails closed unless the record is present, and `studio doctor` reports the check.
- note: this bootstrap also adds `.github/workflows/docs-steward.yml` (a copy of control-center `docs/steward/caller-workflow.yml`, cron 20:30 UTC) and `.steward/` to `.gitignore`. Both are outside the steward's `**/*.md` allowlist and were added by hand, once, for the bootstrap.
- reconciled at `8477f04`: `origin/main` moved to PR #39 ("Consume approved Control Center production briefs") while the bootstrap was written against `efb3f80`. The bootstrap commit was rebased onto it; `NOW.md` now carries `head: 8477f04`, a bullet for #39 and the runner intake path in "Where it is right now". #39 changed `docs/OPERATIONS.md` (new "Control Center production intake" section, typical runs start from a brief) and two bullets in `.agents/skills/mindmake-video/SKILL.md`; both were read and neither contradicts the state doc or README. The `Last verified` line on `docs/CAROUSEL_ENGINE_STATE.md` was moved to `8477f04` because its body is unchanged by #39.
