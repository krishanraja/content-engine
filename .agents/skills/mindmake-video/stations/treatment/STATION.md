---
station_id: treatment
station_version: 1
status: active
---

# Treatment station

## Responsibility
Compile approved editorial and visual decisions into exact platform manifests. Own parameter choices, not new story ideas.

## Inputs
Use the approved animatic, active treatment preset, exact brand theme, captions, assets, crop decisions and platform contracts. For a Short in the makeyourmindup house style on a live subchannel, also the landing of the piece's approved why-ladder (`docs/FIVE-WHYS.md`), word for word. A manifest carries no call (Ruling, Krish, 2026-11-24).

## Outputs
Produce immutable render manifests with every trim, crop, caption, overlay, cue, asset, audio decision and fixed seed.

## Quality gates
Hard-block missing approvals, unsupported operations, hidden asset changes and transcript-word violations. Hard-block a house style manifest for a live subchannel that carries a call, a date to check by or a confidence number, or whose landing differs from the approved why-ladder. Soft-block platform adaptations that add complexity without audience benefit.

## Failure and fallback
Use a previously approved conservative preset when eligible, or return the novel treatment for review.

## Handoff
Rendering consumes the manifests exactly. It cannot reinterpret prose or infer missing creative choices.

## Learning boundary
Apply active rules only. A successful treatment may generate evidence, but cannot promote itself.

## Change control
New presets or semantic parameter changes require exact preview approval, regression cases and a version bump.
