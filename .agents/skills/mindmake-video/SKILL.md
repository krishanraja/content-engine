---
name: mindmake-video
description: Operate Mindmaker's deterministic video studio from an approved Control Center production brief through editorial selection, visual direction, approvals, rendering, platform packaging, analytics, and controlled learning. Use only inside an already valid Mindmake Video Engine workflow.
---

# Mindmake Video

Use the repository CLI as the system of record. Do not improvise job state in chat or edit generated artifacts without recording the change.

## Route the request

- For evidence-feed diagnostics or offline import, read [references/radar.md](references/radar.md). Idea discovery and weekly editorial planning belong to Control Center.
- For ingest, candidate selection, treatments, rendering, QA, or platform packages, read [references/production.md](references/production.md). For any clip-selection or transcript-edit decision, also read [references/editorial-selection.md](references/editorial-selection.md).
- For narrative beats, dense visual stories, virtual-camera decisions, styleframes, animatics, or cinematography, read [references/visual-direction.md](references/visual-direction.md).
- For screenshots, archives, licensed media, sketches, generated assets, likeness changes, rights, provenance, or disclosure, read [references/asset-safety.md](references/asset-safety.md).
- For podcasts, guests, multiple cameras, identity, diarisation, active speakers, or reaction shots, read [references/conversation-direction.md](references/conversation-direction.md).
- For revisions, preferences, external edits, analytics, or rule changes, read [references/learning.md](references/learning.md).

Read only the references relevant to the current operation. Apply `$krish-voice` to public wording and `$content-corpus` to series and channel decisions.

## Non-negotiable boundaries

- Krish is always named Krish. Public series names are The Money of AI and Built With AI. Never publish Paid or bare Built as a series name.
- Hard-block unsupported truth claims, unclear rights, exposed private information, meaning-changing edits, naming violations, or generated media presented as evidence.
- Soft-block weak clarity, audience fit, novelty, engagement, enjoyment, or visual contribution. Proceed only with a recorded override reason.
- Give every visual beat one primary attention target and a declared purpose. Reject decoration that competes with the argument.
- Use a stable conservative fallback when identity, active-speaker, gesture, mask, or crop confidence is low.
- Never publish publicly. YouTube uploads are private-only. LinkedIn, TikTok, and Instagram outputs are local packages.
- Record every approval against the exact artifact hash. New or experimental visual language requires exact styleframe and animatic review.
- Treat platform titles, copy, covers, captions, disclosures, and delivery settings as one package artifact. Archive or private-upload it only after Krish approves that exact package hash.
- Capture every user change as feedback, infer the likely reason, and ask for concise confirmation. Never activate a durable rule without explicit user approval.
- Publish no candidate unless it has an authored edit plan and editorial assessment that pass deterministic gates. Heuristic windows are discovery material, not approval-ready recommendations.
- Do not turn a raw radar signal into production copy. New short-native work requires an exact approved `ProductionBriefV1` from Control Center.

## Operating shape

Use `scripts/studio.ps1` from the repository root. Return important artifact paths, hashes, blocks, confidence fallbacks, and the next approval gate. Open phone-size styleframes, contact sheets, animatics, and final previews in Codex when visual comparison helps.
