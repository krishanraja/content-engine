# Opening loop calibration

## Status

Proposal. Observed, not confirmed. Nothing here is an active rule, no threshold in `config/studio.json` changes because of it, and no station may treat it as taste. Under the learning boundary (`docs/ARCHITECTURE.md`) an external reference is an observation: it becomes a rule only when the exact rule appears in reviewed Git configuration with Krish's explicit approval, with regression cases and a station version increment. This document exists so the argument is on the record and can be accepted, cut down or rejected against something concrete.

## The reference

A third-party newsletter supplied by Krish on 2026-09-23: "The 3 Components of A Great YouTube Hook" (Colin and Samir). Rights role `analysis_only`. The file is not stored in this repository; the record is the hash.

- sha256 `508928c76f1733da1201a232f8cf7e5a7455858ccc144240973b3ab76f498f8f`
- Prohibited uses: do not republish or quote it in any public artifact, do not reproduce its structure as a template, do not cite it as evidence inside a Short or carousel.

## What it claims

A long-form YouTube video's first thirty seconds must do three things: confirm the click within about seven seconds by showing the subject or promise from the title and thumbnail; establish why this narrator is the one telling it and where the video is going; and open a new loop before the thirty-second mark, because the loop the packaging opened closes the instant the click is confirmed.

The mechanism underneath it is the part worth keeping. Packaging is a debt, not an asset: it borrows attention against a question the video has not answered yet. Confirming the click repays that debt and leaves the viewer with no reason to stay. Retention past the intro depends on a second unanswered question existing, and on the viewer always knowing where they are in the story — the newsletter's own example is Uber telling you the driver is three minutes away.

## What transfers to this engine, and what does not

**The clock does not transfer.** A Short is thirty to sixty seconds in total, so the intro budget is one to three seconds, not thirty. The three functions still have to happen; they happen compressed, overlapping, and often in a single opening line over a single frame. Read the seven-second and thirty-second marks as an order of operations, not as durations.

**Confirming the click is already half-solved, in one direction only.** For `short_native` work, packaging is derived from the candidate hook (`packages/core/src/package.ts`): the cover headline, the titles and the first line of each platform post are built from `candidate.hook`, so continuity holds by construction. Nothing holds it the other way. Where packaging is authored or edited separately from the spoken opening, and for extract and solo work where the hook is cut from existing source, no gate compares the promise the packaging makes against the first words the viewer hears. That is a real unguarded seam, and it is the cheapest of the three to close.

**"Make it personal" does not transfer as a face.** This engine's opening currency is receipts, and that is a deliberate standard, not an oversight: `config/studio.json` already requires a sourced receipt or owned artifact inside the first five seconds for Money of AI formats, and a concrete build or artifact inside the first eight seconds of video or first three carousel slides for The Build Itself and First Version. The transferable part of the newsletter's second component is the question, not its answer: why is this narrator the one holding this claim. Here that is answered by evidence standing and first-person build access rather than by a personal anecdote. The counterexample already in `config/studio.json` — a human-led opening is allowed when the source moment is itself the evidence — encodes the same idea and should not be widened by this proposal.

**The second loop is the genuine gap.** The engine models the opening (`hook_strength`, threshold 0.68 in `config/studio.json`) and the landing (`ending_strength`), and nothing in between requires that a question be open. `hook_strength` is a single opaque scalar with no rubric behind it, so a judge scoring it cannot say which component failed and a rejected candidate cannot be repaired against a named criterion. `NarrativeBeatV1Schema` (`packages/contracts/src/v2.ts`) carries `narrative_function` values `tension`, `turn` and `reset`, the `reset_attention` viewer task and the `curiosity` emotional function — the vocabulary for loops exists, but no gate asks whether a beat's question is ever answered, or whether one is open at all once the hook has confirmed the promise.

**Position legibility is unmodelled.** Nothing requires the story to tell the viewer where they are in it. At Shorts length this matters less than at ten minutes, and the cheapest form of it — an enumerated structure — is also the most overused. Worth a soft check, not a gate.

## Proposed decomposition of `hook_strength`

Replace one opaque number with three named sub-signals, scored separately and reported separately, so a failure is diagnosable.

1. **`promise_match`** — the opening line names the subject or premise the packaging promised. Deterministically checkable: the packaging `cover_headline` and the first sentence of `caption_script` must share a named subject, with token overlap above a set floor. Proposed as a hard block for extract and solo work where packaging is authored separately, and as an asserted no-op for `short_native`, where the derivation already guarantees it. This is the one component that can be machine-checked today with no contract change.

2. **`standing`** — the opening makes visible why this narrator holds this claim: the receipt, the artifact, the build, the room. The existing five-second and eight-second proof-timing rules already require the evidence to be present; the addition is that it be *legible as the narrator's own standing* rather than merely on screen. Soft block. Honest limit: this is the least machine-checkable of the three and should stay a human review item alongside camera motivation and countercase fairness, which `docs/REFERENCE_VIDEO_CALIBRATION.md` already holds back for the same reason.

3. **`open_question`** — after the hook beat confirms the promise, at least one question is open and is answered later in the story. Checkable against the beat graph, but only with a contract change: `NarrativeBeatV1Schema` would need an optional `opens_question` flag and an `answers_beat_id` reference, taking the beat contract to version 2, with the gate reading "a beat marked `opens_question` must be answered by a later beat in the same edit". Without those fields the check can only be a soft prompt at script review.

A fourth, weaker signal, **`position_legibility`** — the script says where the viewer is in the story — is worth carrying as a soft block on anything over thirty seconds, and worth resisting as a house tic. A numbered list is the laziest instance of it.

## What approval would cost

- A `hook_strength` decomposition means new score fields on the editorial assessment, a matching threshold block in `config/studio.json`, and updates wherever the score thresholds are iterated (`packages/core/src/editorial.ts`, both the extract and short-native validators).
- `promise_match` needs the packaging artifact available at candidate review, which it is not in every path; check the station graph before promising the gate.
- `open_question` needs `NarrativeBeatV1Schema` at version 2 and an invalidation sweep of every descendant station.
- Script and candidates stations both take a version increment and new regression cases.

None of that is worth starting before Krish says which of the three components he actually wants enforced. My read: `promise_match` is worth building now because the seam is real and the check is cheap; `open_question` is the one that would most change the output, and also the most expensive; `standing` should stay human.

## Evidence and privacy

The reference stays outside GitHub. This repository stores its hash, its analytical role and the inference drawn from it. No excerpt of the newsletter appears in any public artifact produced by the engine.

## Rollback

Delete this file. Nothing reads it, no configuration points at it, and no job carries a hash derived from it.
