---
station_id: brief
station_version: 1
status: active
---

# Brief station

## Responsibility
Bind one approved Control Center production idea to an immutable production brief. This station accepts direction. It does not rediscover the topic or create a second ideas pipeline.

## Inputs
Use the exact approved `ProductionBriefV1`, its content address, series, format, intended audience change, evidence needs and production route.

## Outputs
Produce one validated brief artifact whose identity changes whenever semantic content changes.

## Quality gates
Hard-block invalid lineage, unsupported formats, legacy public series names, private leakage and a reused ID with changed content. Soft-block vague payoff, unclear route or missing proof intent for editorial correction upstream.

## Failure and fallback
Return precise invalid fields to Control Center. Never fill a missing editorial decision with plausible copy.

## Handoff
The script station receives the exact brief hash. Extract and solo jobs may retain skipped pre-recording artifacts, but cannot claim a short-native approval path.

## Learning boundary
Record corrections to brief interpretation as observations. The station cannot change the shared ideas pipeline or activate a preference.

## Change control
Bump `station_version`, update regression cases and prove graph parity before changing accepted brief semantics.
