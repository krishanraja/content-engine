---
station_id: render
station_version: 1
status: active
---

# Render station

## Responsibility
Execute exact manifests into media. Own reproducible manufacture, not editorial interpretation.

## Inputs
Use the treatment artifact, exact source and asset hashes, pinned fonts, tool versions and fixed seed.

## Outputs
Produce platform masters, render measurements and content-addressed render artifacts.

## Quality gates
Hard-block missing inputs, hash mismatches, source-audio corruption and manifest divergence. Soft-block avoidable performance costs that do not improve the output.

## Failure and fallback
Preserve all upstream artifacts and resume from this station. Never rebuild editorial work to hide a render failure.

## Handoff
QA receives the rendered masters plus the manifests and ledgers needed to verify them independently.

## Learning boundary
Operational telemetry may improve render defaults through reviewed code. It cannot become an aesthetic rule.

## Change control
Renderer, font or codec changes require perceptual and audio equivalence tests plus a version bump.
