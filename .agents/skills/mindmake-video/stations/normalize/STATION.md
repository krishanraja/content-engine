---
station_id: normalize
station_version: 1
status: active
---

# Normalize station

## Responsibility
Create canonical editorial media without making creative decisions. Own timing and media compatibility only.

## Inputs
Use exact ingested sources and their synchronisation metadata.

## Outputs
Produce content-addressed 30 fps, 48 kHz intermediates and explicit capability states for missing streams.

## Quality gates
Hard-block broken timing, lost audio, incorrect lineage and corrupt outputs. Soft-block unnecessarily expensive intermediates that do not improve downstream analysis.

## Failure and fallback
Preserve ingest authority and retry locally. Do not let a partial intermediate become a valid artifact.

## Handoff
Transcript and source analysis may run from the same validated normalized artifact.

## Learning boundary
Normalization metrics may tune operational defaults only through reviewed configuration. They cannot encode taste.

## Change control
Codec, timing or sample-rate changes require media fixtures, perceptual checks and a version bump.
