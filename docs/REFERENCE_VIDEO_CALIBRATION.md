# Reference video calibration

## Decision

`feedback-reference-videos-20260908-01` is an owner-confirmed taste rule for The Money of AI investigative Shorts. It is active in `config/studio.json` as `pref-money-investigative-receipts-v1`.

The release starts at series scope because both supplied examples are presenter-led, claim-led stories that fit The Money of AI. It does not silently change Built With AI, carousels, Substack, or non-investigative formats. Broader application still requires three confirmed instances across at least two jobs, regression review, and a separate approval from Krish.

## What the references teach

The positive reference earns attention through an immediate promise, visible progression, concrete scenes and a script that keeps changing the viewer's mental model. Its unsupported predictions, generic overlays and coercive close are not adopted.

The negative reference contains a useful investigative spine: source claim, explanation, evidence, contradiction, incentive and verdict. Its execution weakens that spine by stripping qualifiers, overclaiming causality, using generic montage as proof, adding arbitrary punch-ins, interrupting the story with a follow request and ending on an empty comment prompt.

The governing rule is therefore:

> Open with a legible promise and visible receipts. Trace one mechanism through concrete scenes and fair contradiction. Preserve qualifiers. Make every visual move do a narrative job. Finish on an earned verdict.

## Enforced now

At candidate review, the engine raises a soft block that needs a recorded override when the active scoped rule finds:

- unsupported sensational terms;
- follow or subscribe requests inside the story;
- empty comment prompts;
- evidence or visual-proof scores below the calibrated floor;
- no explicit claim boundary for investigative work.

At visual-plan review, the engine raises a soft block when no sourced receipt or artifact is placed in the first five seconds, or when generic licensed B-roll is used as proof in an evidence or mechanism beat.

Existing hard gates already protect source qualifiers, claim boundaries, causal-chain preservation, factual verification, semantic coherence and ending strength. Caption styling, camera motivation, countercase fairness and the earned quality of the verdict remain human review items until they have reliable machine-readable signals.

## Evidence and privacy

The reference media remains outside GitHub. The repository stores only cryptographic hashes, durations, analytical roles, the confirmed inference and the minimal confirmation excerpt in `fixtures/feedback/reference-video-preference-20260908.json`.

## Rollback

Retire the active preference in a reviewed Git change and remove its deterministic soft-block checks from the pinned preference snapshot for new jobs. Existing jobs retain the configuration hash they were created with.
