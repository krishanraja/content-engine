---
name: mindmake-video
description: Operate Mindmaker's deterministic video studio for idea radar, clip selection, short-native scripts, approvals, rendering, packaging, analytics, and controlled learning. Use for The Money of AI or Built With AI video work; do not use for unrelated video editing.
---

# Mindmake Video

Use the repository CLI as the system of record. Do not improvise job state in chat or edit generated artifacts without recording the change.

## Route the request

- For idea discovery or weekly planning, read [references/radar.md](references/radar.md).
- For ingest, candidate selection, treatments, rendering, QA, or platform packages, read [references/production.md](references/production.md). For any clip-selection or transcript-edit decision, also read [references/editorial-selection.md](references/editorial-selection.md).
- For revisions, preferences, external edits, analytics, or rule changes, read [references/learning.md](references/learning.md).

Always apply `$krish-voice` to public wording and `$content-corpus` to series/channel decisions.

## Non-negotiable boundaries

- Public names are The Money of AI and Built With AI. Never publish Paid or bare Built as series names.
- Hard-block unsupported truth claims, unclear rights, exposed private information, meaning-changing edits, and naming violations.
- Soft-block weak clarity, audience fit, novelty, or engagement. Proceed only with a recorded override reason.
- Do not manufacture counterevidence. Say when no credible contradiction was found.
- Never publish publicly. YouTube uploads are private-only; LinkedIn output is a local draft package.
- Record every approval against the exact artifact hash.
- Capture every user change as feedback, infer the likely reason, and ask for concise confirmation. Never activate a durable rule without explicit approval.
- Publish no candidate unless it has an authored edit plan and editorial assessment that pass the deterministic gates. Heuristic windows are discovery material, not approval-ready recommendations.

## Operating shape

Use `scripts/studio.ps1` from the repository root. Return the important artifact paths, hashes, blocks, and next approval gate. Open previews in Codex when visual comparison helps.
