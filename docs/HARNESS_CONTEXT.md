<!-- krish-repo-context:start brain=2ad79d5cf4f3 sha=5060dd066b03 -->
# content-engine: operating context

Generated from the central ai-harness brain. This is a route inventory, not a certification of current architecture. Read the section for the work at hand; repository-owned sources establish current facts. The nightly publisher rechecks source paths and named commands. This file grants no product action or spending authority.

## Sources and system boundaries

- Purpose and system boundaries (orientation): `README.md`.
- Current repository state (state): `NOW.md`.
- CAROUSEL ENGINE STATE (state): `docs/CAROUSEL_ENGINE_STATE.md`.
- WORKBENCH (state): `WORKBENCH.md`.
- NORTH STAR (orientation): `docs/NORTH_STAR.md`.
- 2026 10 14 handoff (orientation): `docs/plans/2026-10-14-handoff.md`.
- CONTENT ENGINE (orientation): `docs/CONTENT_ENGINE.md`.
- STUDIO (orientation): `docs/STUDIO.md`.
- ENGINE SESSION (workflow): `docs/ENGINE_SESSION.md`.
- SYSTEM MAP (orientation): `docs/SYSTEM_MAP.md`.
- SKILL (workflow): `.agents/skills/make-piece/SKILL.md`.
- SKILL (workflow): `.agents/skills/produce-video/SKILL.md`.
- SKILL (workflow): `.agents/skills/plan-week/SKILL.md`.
- title verdicts (learning): `config/title-verdicts.json`.
- failures (learning): `config/failures.json`.
- boards (orientation): `config/boards.json`.
- check failures (learning): `scripts/check_failures.py`.
- Repository commands (verification): `package.json`.
- Required bootstrap source (workflow): `docs/REPO_MAP.md`.

## Workflows

### content: Ideation, drafting, iteration and publication preparation

Read: `docs/NORTH_STAR.md`, `docs/CONTENT_ENGINE.md`, `.agents/skills/make-piece/SKILL.md`, `config/title-verdicts.json`, `config/failures.json`, `WORKBENCH.md`.
Checks: `python3 scripts/check_failures.py`; `npm run verify`.
Run only within existing authority. Check inputs, the owning stage, and the downstream artifact actually consumed.

### production: Tracked Studio and media production

Read: `docs/STUDIO.md`, `docs/ENGINE_SESSION.md`, `.agents/skills/produce-video/SKILL.md`.
Checks: `npm run verify`.
Run only within existing authority. Check inputs, the owning stage, and the downstream artifact actually consumed.

### board: Weekly decisions, all account links and feedback continuity

Read: `.agents/skills/plan-week/SKILL.md`, `config/boards.json`, `WORKBENCH.md`.
Checks: `python3 scripts/check_failures.py`.
Run only within existing authority. Check inputs, the owning stage, and the downstream artifact actually consumed.

## Accepted operating knowledge

- Preserve the accumulated goal and accepted decisions when a revision changes one dimension. Identify the requested delta and explain material trade-offs among soft goals; only an explicit scoped owner decision supersedes an accepted requirement. [administration.preserve-intent@1; family]
- Locate the authoritative sources, stage owner and verification route for the work. Verify the downstream result actually consumed, and diagnose the owning layer when a failure repeats. [administration.verify-owning-system@1; family]
- Preserve an experiment's conditions, observed outcome and uncertainty. An unsuccessful trial is evidence for that setting; it does not automatically prohibit a tactic, audience or another repository's work. [administration.experimental-learning@1; family]
- Record verified outcomes and corrections with source identity and scope. Keep observations, assistant claims and inferred preferences separate from accepted requirements. An observation cannot approve itself or expand operating authority. [administration.evidence-and-acceptance@1; family]

## Learning and decisions

Keep an accumulated working brief: goal, accepted decisions, requested delta, conditions, unresolved questions and observed outcome. A narrow revision preserves other decisions. Distinguish an explicit owner instruction from an interpretation, and a failed experiment from an operational defect. Read native feedback/experiment records for the specific task; a result for another audience or stage is not a prohibition here.

The brain retains evidence and proposals separately. Newly observed evidence never approves itself. When a failure repeats, diagnose missing knowledge, interpretation, retrieval, stale instructions, ignored guidance or the owning code before adding another rule.

Acceptance: brain-repository-administration-v1. Effective knowledge IDs and their acceptance references are in ai-harness `brain/knowledge.jsonl`. Source inventory revision: `8b016abce2e61660b7a723f8fb387a975ac1d9b8`.
<!-- krish-repo-context:end -->
