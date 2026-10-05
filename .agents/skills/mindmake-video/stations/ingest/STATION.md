---
station_id: ingest
station_version: 2
status: active
---

# Ingest station

## Responsibility
Bind accepted source components to a job while leaving media in governed scratch or Drive. Own content identity and source roles, not editorial selection.

## Inputs
Use the reviewed source bundle, intake proof, component hashes, rights, consent, synchronisation and participant labels.

## Outputs
Produce an immutable ingest artifact that names every included source and preserves prior source attachments.

## Quality gates
Hard-block unstable files, hash changes, ambiguous split sequences, missing rights, unsafe paths and uncertain source associations. Soft-block incomplete role or sync notes.

## Failure and fallback
Leave the source untouched and retry after stability returns. Never guess missing parts or silently drop a component.

## Handoff
Normalization consumes only the exact source identities recorded here. A replaced take invalidates media-dependent descendants, not the approved short-native idea.

## Learning boundary
Operational failures may improve intake checks, but never become editorial or taste rules.

## Change control
New file association rules require adversarial fixtures and a version bump because wrong associations contaminate every downstream stage.
