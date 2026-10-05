---
station_id: qa
station_version: 1
status: active
---

# QA station

## Responsibility
Test the finished masters against technical, editorial, brand, evidence, rights and lineage requirements. QA does not repair output silently.

## Inputs
Use exact masters, render manifests, claims, assets, captions, approvals and platform requirements.

## Outputs
Produce a machine-readable pass or fail artifact with every check and measurement.

## Quality gates
Hard-block any failed truth, rights, naming, transcript, safe-zone, audio, video, identity or lineage check. Soft quality concerns return to their owning station with evidence.

## Failure and fallback
Route each failure to the lowest correct upstream owner, then rerun only invalidated descendants.

## Handoff
Final approval and package creation require the exact passing QA artifact for each platform master.

## Learning boundary
QA failures improve validators and fixtures. QA cannot decide Krish's taste or activate performance rules.

## Change control
A weaker threshold needs explicit justification, adversarial regression coverage and a version bump.
