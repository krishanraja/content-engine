# Production quality floor

Krish approved implementation on 26 October 2026. This is the production contract for videos and carousels. `config/media-standard.json` is its machine-readable owner. Run `node --import tsx scripts/media-standard.ts show` to obtain the current standard and hash before production. A missing standard, reviewer or tool is a repair task, never permission to substitute a generic template.

**Rollout: candidate pending calibration.** Run `node --import tsx scripts/media-standard.ts rollout` at session start. The eight-case reviewer pilot failed, so automatic signed qualification is not active. The design instructions still apply to every new piece; existing approval, audio, visual-clarity and delivery checks remain in force. The new proof/signature requirements described below become mandatory only after reviewed activation in `config/media-quality-rollout.json`. Pending status is not a quality pass and must never be described as enforced minimum taste. The qualification API itself always remains strict.

Activation requires a repository-reviewed record bound to the current standard, named reviewer keys and passed calibration, regression and readiness evidence. There is no request, environment or CLI opt-out. Malformed or stale rollout configuration fails. The schema checks evidence bindings; repository review must verify the evidence itself and the provisioned registry. Merging the implementation does not approve activation.

## Begin with this story

Load the approved argument, audience and evidence. For each scene or slide, write the one thing the viewer should understand and the visible relationship that communicates it. Create a media brief with `MediaBriefSchema` in `packages/core/src/media-quality.ts`; validate it with `scripts/media-standard.ts brief BRIEF.json`. Quick-edit configs name that file as `media_brief`; carousel output folders hold `<story_id>.media-brief.json`.

Official brand identity and its specifications carry forward. Subject-specific photographs, generated images, diagrams, layouts, brand applications and narrative motion are commissioned for this piece. Prior-piece assets are not an asset kit. Evaluation examples are not eligible production inputs. Reusable code may draw a line or move a camera, but the subject and explanation determine its use.

The accepted photographic reference establishes a level of tangible detail, composition and editorial craft. It does not mean every subject requires the same photographic scene, server rack, phone, passport, background, framing or transition. Charts, evidence captures, collage, physical analogy and illustration remain available when they clarify the actual argument. The user's approval of a styleframe is not approval of a complete motion sequence or an unseen carousel.

## Design before labels

- Represent named entities recognisably: useful portraits for people, accurate official marks for products, flags beside country names when nationality matters, and tangible objects for physical processes. Use these because they aid recognition, not as a decorative icon quota.
- Blend appropriate real-world imagery, deliberate composition and brand treatment. Use the current official identity from `config/studio.json`; never invent or redraw a logo. Apply brand colour to meaning-bearing emphasis, including hand-drawn annotations when appropriate.
- Video visuals must add information beyond speech and captions. Remove repeated sentences and paraphrases. Keep labels to the minimum needed for identity, quantity or a relationship. Count image text as well as renderer text. The numeric limits in `config/visual-clarity.json` are conservative engineering defaults, not a claim that Krish supplied those numbers.
- For a carousel, use concise reading hierarchy and a clear progression. Do not apply the video's word count to an entire reading slide. Unnecessary repetition and text standing in for a visual explanation still fail.
- Voiceover motion must reveal the mechanism: show where something comes from, what changes, what stays, what moves or how two outcomes differ. A fade or zoom by itself is not explanatory motion. Camera-led cuts use motion where it helps.
- Evaluate the opening, held state, transition and final state at phone size. One attention target should be clear immediately. An uninformed reviewer must state what the visual communicates before seeing the intended takeaway. Preserve their actual answer; label model interpretation as a prediction, not a three-second human experiment.
- Keep evidence and illustration distinct. Do not imply an invented scene is a real facility or test. Keep geographic framing specific to the example; generic AI explanations are not repeatedly framed around China.

## Proof, review and automatic repair

Before a full production run, create proof covering the opening, the densest explanation and a transition or concluding slide. The independent reviewer checks these against the standard and the applicable accepted and rejected evidence. Repair ordinary failures internally. Ask Krish only when a material change in creative direction or a genuinely unresolved taste decision remains. Existing content and direction approvals are not reopened for routine adherence.

Final review must inspect the exact exports: continuous video playback with actual audio review, or every ordered carousel slide and its exported PDF. Mechanical checks cover text, bounds, size, hashes and timing; independent judgment covers craft, semantic duplication, clarity and meaning. A minimum criterion that fails or remains uncertain blocks qualification. A score average cannot erase it. The producer cannot promote its own work or fabricate a reviewer's response.

An independent reviewer signs `SignedMediaEnvelopeSchema` with an Ed25519 private key held in a separate reviewer runtime. The producing session, runner and engine bearer must never possess that key. The verifier receives only an independently provisioned public-key registry. No producer API registers keys, signs supplied passes, overrides failures or activates standards. The trusted reviewer must fetch and inspect media itself; signing a producer's checklist is prohibited.

The final envelope binds the standard, whole creative brief, independent run, cut/surface, complete artifact set, representative proof, coverage, individual findings and evidence. Store the proof, final receipt, outputs and evidence through the normal immutable library. The server hashes their actual bytes before qualification. An output sidecar `<file>.media-quality.json` names `{piece_id, production_id, role, cut, artifact: {path, sha256}, receipt: {path, sha256}}`; `cut` is omitted for carousels. It is a request for verification, not a pass certificate.

`POST /api/media-quality` recomputes qualification from signed immutable evidence. It has no writable ready flag or separate mutable qualification table. Key removal, a changed standard or changed bytes causes re-verification to fail. Storage `ready` means stored only. Working uploads remain allowed and never confer editorial readiness.

The server gates Video assets writes. The Studio gates packaging, archive and private upload; quick-edit gates delivery. Carousel packaging first creates `candidate-package.json` and exact PNG/PDF bytes, then accepts reviewed files without rendering them again. The ordered candidate manifest itself must be reviewed so slide order cannot change unnoticed.

Board activation, including replay and rollback, requires a separate signed `BoardDeliverySchema` envelope covering the entire immutable HTML/assets manifest. The delivery validator inspects actual HTML references and ready claims, includes every qualified media dependency and refuses undeclared external/data media or unqualified readiness. Merely checking an optional list supplied by the producer would leave a bypass. `board_web.py` reads `<page>.delivery-review.json` at activation. A historical board remains readable as history; it cannot silently qualify a new release.

## Activation evidence

**Activation prerequisite:** the independent reviewer is not yet provisioned or calibrated. The implementation may deploy with its validated pending rollout; do not activate enforcement alone, since it would block every new board activation, including drafts and rollback. Existing provider credentials do not establish a working reviewer. Cross-repository Control Center projections must also consume the revalidated making state before claiming current readiness. Automatic enforcement is not active.

Once active, current signed boards are revalidated on default reads. Metadata stays available for repair, but an invalid current review blocks HTML/assets. Explicit build reads and unsigned pre-standard boards are historical and carry `X-Media-Qualification: historical`; they confer no new qualification. During pending rollout the header instead reports `candidate_pending_calibration` and ordinary board operations retain their existing checks.

Implementation and activation are separate. Before declaring the floor live, retain:

1. Tests of forged signatures, missing/removed keys, wrong piece/cut, stale standards, changed files, missing evidence, reordered carousel manifest, absent proof, failed criteria and direct API bypasses.
2. Review-worker calibration against real accepted and rejected media, including clipped-speech controls. Plausible transcripts alone do not establish audio quality.
3. Fresh-session video and carousel canaries on a different topic. They must create their own assets, explain their new subject, apply the standard without user prompting, and reject the negative controls. Replaying Friday fails the transfer test.
4. Deployed route and immutable-download readback, plus independent review of the implementation. Tests alone do not establish live enforcement or taste calibration.

Current baseline limits are declared in the policy. No complete carousel baseline or full-motion acceptance is invented. New accepted examples extend the evidence only with Krish's actual ruling. Unknown reviewer capability remains unknown.
