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

Discovery candidates are mechanical search windows and cannot be approved. Codex authors the publishable `CandidateV1` with an `EditPlanV1` and `EditorialAssessmentV1`. The edit may contain one continuous segment or a bounded set of stitched source segments; every cut, final order, source-order change, cold-open decision, throughline, and ending is explicit.

Caption treatment is deletion-only: captions may omit filler, false starts, accidental duplicates, and redundant setup, but every remaining token must occur in the verified selected transcript and original spoken order. Punctuation, capitalisation, and identity corrections backed by known speaker metadata are the only transformations. The approved caption script reuses the matched word timings. A changed caption treatment invalidates render, QA, and package; it does not invalidate transcription or source discovery. Short-native re-ingest does not invalidate the approved script.

## Editorial gates

Hard blocks cover truth, rights, confidentiality, meaning, canonical naming, transcript fidelity, identity, semantic coherence, publishable impact, audience value, and ending quality. The approval command independently recomputes them and refuses to override them. Soft clarity, novelty, engagement, or audience-fit blocks require an explicit override reason tied to the exact candidate hash.

The default is one continuous cut. Stitched edits must be materially stronger, non-overlapping, and coherent as one argument. A source-order change must be declared and justified. Longer-than-30-second work records whether a roughly five-second source-grounded cold open helps; it is never added mechanically. When no edit passes, `rerecord` requires an actionable hook, missing proof, structure, delivery, ending, and duration brief.

Short-native candidates pass the same quality floor before a recording brief exists. When every proposed script is blocked, the script and diagnoses remain recorded but the `recording_brief` stage stays pending. Cadence alone cannot advance the job into recording.

The system stores facts, inferences, and judgments separately. Proper nouns, products, legal wording, numbers, and consequential factual claims enter `needs_review` and block treatment until the candidate ledger is edited with evidence and re-approved. Series fit requires both AI context and the series-specific commercial or implementation mechanism. It is not inferred from transcript length.

## Deterministic media decisions

- Input timing is normalized to constant 30 fps and 48 kHz audio.
- The manifest records every source segment and final order, exact trim, crop, caption cues and personality, timed evidence overlays, asset rights and attribution, series colour, and fixed seed.
- Inter 800 is pinned through npm rather than relying on a host font.
- Source audio is transcribed once with faster-whisper INT8 and word confidence. Project vocabulary is passed as transcription context. Approved wording reuses those timings across treatments.
- Final audio uses measured two-pass normalization toward -14 LUFS with pre-codec headroom for a true peak at or below -1 dBTP.
- QA checks dimensions, frame rate, sample rate, loudness, true peak, duration, caption limits, caption provenance and semantic alignment, canonical copy, frame perceptual hashes, and audio characteristics.

MP4 bytes are not expected to match across different hardware. Functional equivalence is assessed from the edit manifest, cue timing/text, perceptual frame hashes, and audio measurements.

## Learning boundary

Feedback is captured from approvals, explicit comments, exact structured diffs, and re-imported external finals. Every event records whether it came from the user, Codex, or the system. Codex and system diagnostics remain observations and cannot become taste rules. External-video comparison records transcript, scene cuts, crop-sensitive frame fingerprints, duration, and loudness; optional SRT, EDL, and FCPXML sidecars preserve exact editor decisions.

Feedback moves through `observed -> inferred -> confirmed -> trial -> eligible -> user_approved -> active -> retired`. Runtime observations and rule proposals are derived state. Activation requires an explicit command with an approver and writes the rule into versioned `config/studio.json`, ready for GitHub review. A broader scope requires three confirmed instances across at least two jobs.

Performance experiments must name one primary variable. Views cannot make a rule eligible. Three comparable control and treatment observations must improve the target without degrading qualified action; the result remains a proposal until user approval.

## Radar boundary

The studio does no gathering. It reads `RadarFeedV1` from the existing mm-ctrl public pool and Control Center owned/operator patterns. Offline JSON fixtures use the same schema. Internal sanitized patterns are research prompts only and are hard-blocked from factual scripting until replaced with public evidence or approved case material.
