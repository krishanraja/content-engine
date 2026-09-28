---
station_id: styleframes
station_version: 1
status: active
---

# Styleframes station

## Responsibility
Make visual hierarchy and composition decidable before motion. Own representative frames, not the final timeline.

## Inputs
Use the visual plan, exact approved assets, source analysis, captions, brand theme and platform safe zones. For a Short in the makeyourmindup house style on a live subchannel, also the piece's call from the job's approved production brief, as `studio v2 call --job <job> --beat <beat_id>` prints it.

## Outputs
Produce phone-size review frames bound to the current plan and assets.

## Quality gates
Hard-block face collisions, unreadable proof, truncated text, unsafe captions, fake wordmarks and asset substitution. Hard-block a house style manifest for a live subchannel with no call, or with a call that differs from the approved text by a character. Soft-block flat hierarchy, generic layout and weak series character.

## Failure and fallback
Return to visual planning or asset selection with the precise collision or hierarchy failure.

## Handoff
The animatic station receives the approved frames and their exact plan lineage, not a loose visual mood.

## Learning boundary
Style preference feedback remains scoped to the relevant series, format, mode or treatment until explicitly promoted.

## Change control
Layout-system changes need phone-size comparisons, collision fixtures and a version bump.
