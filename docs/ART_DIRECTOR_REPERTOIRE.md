# Art Director Repertoire

## Purpose

The repertoire gives every studio client one governed visual vocabulary. It is not an effects catalogue. Each device has a narrative job, eligibility rules, required inputs, a deterministic score, an executable render path, QA checks and a conservative fallback. GitHub owns approved definitions in `config/techniques.json`. Job artifacts own exact selections and usage history. Control Center shows redacted review projections only.

The supplied Instagram Reel is retained in the governed Drive location named by `inspo/README.md`; an older Git commit remains historical provenance only. Its exact pointer, hash and observations are recorded in the registry. Its frames, composition, timing, copy and creator likeness are prohibited production inputs.

The repertoire selects visual mechanisms before treatment. The permanent film creative jury evaluates the resulting style test, animatic, rough cut or final. These are one chain, not competing taste systems. A jury evidence packet includes the exact registry hash and device-selection traces, then the independent art-direction, cinematography, editing, finish, accessibility, integrity and prosecution verdicts judge what actually appeared. A strong jury result cannot activate or broaden a device rule by itself.

## Selection sequence

For each approved narrative beat:

1. Reject devices whose series, source mode, editorial format, narrative function, viewer task, truth role, rights, inputs or treatment lane do not fit.
2. Score eligible devices out of 100: narrative fit 30, proof value 25, available coverage 20, series and format fit 10, novelty 10, cost and risk 5.
3. Resolve equal scores by stable device ID.
4. Choose one primary device and at most two support devices.
5. Enforce one signature hero and one experimental device at most across a Short.
6. Persist every candidate, rejection, score, choice, fallback and rationale as `DeviceSelectionTraceV1` on the visual plan.

Production visual plans using registry v2 require one trace per beat. A trace selection must appear in the shot directives for that beat. The renderer still obeys the exact manifest, so a model cannot smuggle an unregistered device into prose.

## New devices and recipe

- `noun-to-proof-cut`: answer a meaningful spoken noun with the exact approved person, place, object, interface, document or event. Generic stock imagery fails the device.
- `tracked-object-label`: bind one restrained label to an ordered object track. Missing tracking keyframes fail the visual plan.
- `progressive-value-reveal`: reveal a verified quantity or comparison in at least two timed stages. Runtime entrances start from each layer's own reveal time.
- `embodied-closing-action`: finish on a real action or visual consequence inside the final payoff or ending beat.
- `evidence-walkthrough`: noun-to-proof, guided inspection, progressive value and a clean return to Krish. It is a recipe, not a default house style.

These devices compile to the existing camera, source, asset, annotation and timing primitives. Tracking keyframes are now a versioned layer property. This keeps the render engine deterministic and avoids a second effects runtime.

## Sharp alternative

If no eligible existing device clears the configured threshold, the selector may create exactly one `DeviceInventionProposalV1` for the Short. It cannot silently select or render it.

The proposal must:

- identify the exact narrative gap;
- describe one bounded visual mechanism;
- name an existing conservative fallback;
- use the experimental lane;
- produce phone-size styleframes and a timed animatic;
- receive exact approval from Krish before treatment;
- remain job-local until separately promoted through reviewed Git configuration.

An invention never becomes a durable device because it performed well once. Usage feedback, taste and performance remain separate evidence classes.

## Review and learning

Treatment and final projections can include a compact `art_direction` packet. Control Center presents this inside the existing Video Engine reviewer as Visual choreography. Each beat distinguishes its primary device, selected supporting devices and no more than two unselected alternatives, plus a simplify action. Long labels wrap. Mobile buttons remain thumb-sized. No transcript, media path, raw source or private artifact enters the projection.

Every proposed, approved, replaced, removed, shortened, repositioned, praised or rejected device can be recorded as `DeviceUsageEventV1`. Each event carries its job, session, scope and confirmation state. Replacements and negative decisions require a reason. The engine produces a scoped inference and sets `activation_allowed: false`.

The weekly aggregation emits deterministic `DeviceLearningProposalV1` records. A strong correction can become eligible immediately only at its narrow job or treatment scope. A broader pattern needs three confirmed events across at least two jobs and two sessions, with no counterexample. Eligible still does not mean active. Control Center asks Krish to approve or reject the proposal, and only a reviewed Git change can activate a broader rule or registry entry.

## CLI

```powershell
.\scripts\studio.ps1 v2 repertoire inspect
.\scripts\studio.ps1 v2 repertoire recipe --recipe evidence-walkthrough --series built_with_ai --lane premium --inputs approved_asset approved_evidence claim_link focal_regions narrative_beats verified_values subject_tracks shot_boundaries
.\scripts\studio.ps1 v2 repertoire propose --beat beat-one --series money_of_ai --mode solo --narrative-function evidence --viewer-task verify_evidence --narrative-job prove --lane premium --inputs approved_asset narrative_beats
.\scripts\studio.ps1 v2 repertoire record-feedback --input <device-usage.json> --ledger <job-device-usage.jsonl>
.\scripts\studio.ps1 v2 repertoire learning-proposals --ledger <device-usage.jsonl>
```

CLI output is JSON. Diagnostics remain on stderr. Identical registry and context inputs produce the same ordered trace.
