# Opening loop calibration

> Scope: the Studio's opening contract for Shorts. For the whole system start at `README.md`.

## Decision

`feedback-opening-loop-contract-20260923-01` records Krish's approval, on 2026-09-23, of the opening contract described here. Three named checks replace one unaccountable judgement about the opening. They are active in reviewed configuration and enforced by the candidates and visual plan stations.

## The reference

A third-party newsletter supplied by Krish: "The 3 Components of A Great YouTube Hook" (Colin and Samir). Rights role `analysis_only`. The file is not stored in this repository; the record is the hash.

- sha256 `508928c76f1733da1201a232f8cf7e5a7455858ccc144240973b3ab76f498f8f`
- Prohibited uses: do not republish or quote it in any public artifact, do not reproduce its structure as a template, do not cite it as evidence inside a Short or carousel.

## What the reference teaches

A long-form YouTube video's first thirty seconds must confirm the click, establish why this narrator is telling the story, and open a new loop before the thirty-second mark.

The mechanism underneath it is the part this engine adopts. Packaging is a debt, not an asset: it borrows attention against a question the video has not answered. Confirming the click repays that debt and leaves the viewer with no reason to stay. Retention past the opening therefore depends on a second unanswered question existing, and on the viewer knowing where they are in the story.

The governing rule is:

> Confirm the promise the packaging made, make the narrator's standing visible, and leave a question open that the story answers.

## What was not adopted

**The clock.** A Short is thirty to sixty seconds in total, so the intro budget is one to three seconds, not thirty. The three functions are enforced as an order of operations, never as durations.

**"Make it personal" as a face.** This engine's opening currency is receipts: `config/studio.json` requires a sourced receipt or owned artifact inside the first five seconds for Money of AI formats, and a concrete build or artifact inside the first eight seconds of video or first three carousel slides for The Build Itself and First Version. The existing allowance for a human-led opening, where the source moment is itself the evidence, is unchanged and was not widened.

## The three checks

**`promise_match`, deterministic and blocking.** The first spoken sentence must share at least one content term with the approved brief title (`content.title` on the bound `ProductionBriefV1`, which carries Krish's approval against an exact revision hash). The floor is `editorial_thresholds.promise_match_min_terms` in `config/studio.json`, currently one term. `promiseMatchTerms` returns the overlap itself, so a reviewer sees which terms matched rather than only the verdict.

It is a **hard block** for extract and solo work, where the opening is cut from existing source and can drift from the promise with nothing to catch it. It is **reported, not blocked**, for short-native work: packaging there is derived from the candidate hook in `packages/core/src/package.ts`, so a mismatch means the script and the brief have parted company, not that the packaging is lying. Where no production brief is bound to the job, the check reports that it did not run rather than passing silently.

The honest limit: this catches an opening that names nothing from the promise. It does not measure whether a promise is well made.

**`standing`, reported for human review.** The opening is checked for a stated first-person relation to the claim. When none is present the reviewer is told to confirm the standing is visible on screen if it is not spoken. This stays soft deliberately. There is no reliable machine signal for "this narrator is visibly the one who holds this claim", and a hard gate on a proxy would block good candidates for a reason the engine cannot defend. `docs/REFERENCE_VIDEO_CALIBRATION.md` holds camera motivation and countercase fairness back for the same reason.

**`open_question`, structural and blocking.** `NarrativeBeatV1` carries `opens_question` and `answers_beat_id`. A visual plan of more than one beat must mark a beat at or after the hook as opening a question, and a later beat as answering it. A beat may only answer a question an earlier beat opened, and may not answer its own.

A single-beat plan is exempt. A one-beat Short has no story after the hook; the promise and the payoff are the same moment, and requiring a loop there would demand a structure the format does not have.

A fourth and weaker signal, **position legibility**, reports a story past `long_video_ms` that never names a stage or a count. It is soft, and a numbered list is its laziest instance.

## Where this is enforced

- `packages/core/src/editorial.ts`: `openingContractIssues`, wired into both `validateEditorialCandidate` and `validateShortNativeEditorialCandidate`.
- `packages/contracts/src/v2.ts`: the beat fields and the plan-level loop rules.
- `packages/cli/src/v2.ts`: binds the approved brief title at candidate review and at the angle gate.
- Stations `candidates`, `script` and `visual_plan` moved to version 2 with regression cases.

`NarrativeBeatV1` took additive fields with defaults rather than a schema version bump, so stored artifacts stay readable; the behaviour change is carried by the station versions, which is what they are for.

## Evidence and privacy

The reference stays outside GitHub. This repository stores its hash, its analytical role, the confirmed inference and the decision record in `fixtures/feedback`. No excerpt of the newsletter appears in any public artifact produced by the engine.

## Rollback

Remove the `openingContractIssues` calls from both validators and the loop rules from `VisualNarrativePlanV1Schema`, drop `promise_match_min_terms` from `config/studio.json`, and return the three stations to version 1 in a reviewed Git change. The beat fields may stay: they default to no question and break nothing. Existing jobs keep the configuration hash they were created with.
