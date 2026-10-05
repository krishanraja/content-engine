---
station_id: transcript
station_version: 1
status: active
---

# Transcript station

## Responsibility
Produce faithful words, speakers and timings. Own what was said, not which portion deserves publication.

## Inputs
Use normalized audio, source captions when available, project vocabulary and verified participant identity.

## Outputs
Produce a word-timed transcript with confidence, diarisation and explicit human-verification state.

## Quality gates
Hard-block unverified consequential wording, invented tokens and guessed identity. Soft-block timing or diarisation too weak for precise selection.

## Failure and fallback
Use source captions for coarse discovery only. Retranscribe shortlisted windows and ask for verification of names, products, numbers and consequential claims.

## Handoff
Candidate selection receives the verified transcript. Caption treatment may delete words but can never add or reorder them.

## Learning boundary
Corrections can update vocabulary and recognition fixtures. They cannot become voice preferences.

## Change control
Model, vocabulary or alignment changes require benchmark evidence and a station version bump.
