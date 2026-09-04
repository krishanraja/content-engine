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

## Verification

Run `npm run verify` before pushing. Validate all repo-scoped skills with `npm run skills:validate`.
