# Architecture

## State model

Each job freezes its current studio configuration and complete skill directories under `pinned/`. `job.json` is the materialized state; `events.jsonl` is append-only. Every stage artifact is schema-validated, content-addressed from semantic inputs, and immutable. Timestamps are audit metadata and do not affect semantic hashes.

Extracted work follows:

```text
ingest -> normalize -> transcript -> candidates -> claims -> treatment -> render -> QA -> package
```

Short-native work adds the pre-recording path:

```text
radar/brief -> script candidates -> recording brief -> recorded ingest
```

The approved candidate wording is aligned to the existing word-timed transcript before treatment. A shortlisted clip is not transcribed again for each treatment. A changed caption treatment invalidates render, QA, and package; it does not invalidate transcription or candidate selection. Short-native re-ingest does not invalidate the approved script.

## Editorial gates

Hard blocks cover truth, rights, confidentiality, meaning, and canonical naming. The approval command refuses to override them. Soft clarity, novelty, engagement, or audience-fit blocks require an explicit override reason tied to the exact candidate hash.

The system stores facts, inferences, and judgments separately. Proper nouns, products, legal wording, numbers, and consequential factual claims enter `needs_review` and block treatment until the candidate ledger is edited with evidence and re-approved. Series fit requires both AI context and the series-specific commercial or implementation mechanism. It is not inferred from transcript length.

## Deterministic media decisions

- Input timing is normalized to constant 30 fps and 48 kHz audio.
- The manifest records exact trim, crop, caption cues, asset rights, series colour, and fixed seed.
- Inter 800 is pinned through npm rather than relying on a host font.
- Source audio is transcribed once with faster-whisper INT8 and word confidence. Project vocabulary is passed as transcription context. Approved wording reuses those timings across treatments.
- Final audio is normalized toward -14 LUFS and -1 dBTP.
- QA checks dimensions, frame rate, sample rate, loudness, true peak, duration, caption limits, caption provenance and semantic alignment, canonical copy, frame perceptual hashes, and audio characteristics.

MP4 bytes are not expected to match across different hardware. Functional equivalence is assessed from the edit manifest, cue timing/text, perceptual frame hashes, and audio measurements.

## Learning boundary

Feedback is captured from approvals, explicit comments, exact structured diffs, and re-imported external finals. Every event records whether it came from the user, Codex, or the system. Codex and system diagnostics remain observations and cannot become taste rules. External-video comparison records transcript, scene cuts, crop-sensitive frame fingerprints, duration, and loudness; optional SRT, EDL, and FCPXML sidecars preserve exact editor decisions.

Feedback moves through `observed -> inferred -> confirmed -> trial -> eligible -> user_approved -> active -> retired`. Runtime observations and rule proposals are derived state. Activation requires an explicit command with an approver and writes the rule into versioned `config/studio.json`, ready for GitHub review. A broader scope requires three confirmed instances across at least two jobs.

Performance experiments must name one primary variable. Views cannot make a rule eligible. Three comparable control and treatment observations must improve the target without degrading qualified action; the result remains a proposal until user approval.

## Radar boundary

The studio does no gathering. It reads `RadarFeedV1` from the existing mm-ctrl public pool and Control Center owned/operator patterns. Offline JSON fixtures use the same schema. Internal sanitized patterns are research prompts only and are hard-blocked from factual scripting until replaced with public evidence or approved case material.
