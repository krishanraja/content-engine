# Minimum visual standard: enforcement proposal

Status: implementation approved by Krish's "yes" on 26 October 2026; local implementation and focused independent tests completed, not activated. The eight-case reviewer calibration failed on absent-audio and silent-audio controls; see 2026-10-26-quality-evidence/README.md. Owner: Krish. Surfaces requested: future videos and carousels. Evidence: this production conversation's explicit corrections, rejected renders/screenshots and approved v6 style frame. No unrelated personal profiling, external sharing or model training is authorised by this proposal.

Krish's scope correction: "A fresh session for future content should not focus on the assets from a previous piece. Once a piece goes out, those assets are for that specific piece. What I mean is, future content needs to stick to that same standard when it's producing its own assets, brand components and motion patterns."

The reusable object is the quality standard and its verification process. Topic-specific imagery, compositions, scene components and narrative motion are commissioned for each new piece. Friday's media belongs to Friday; selected references are evidence of craft, not an asset kit or mandatory aesthetic motif for future topics. Official identity files and brand specifications remain authoritative across pieces, while applications and layouts are designed for the new story.

## Baseline before this implementation

- `config/visual-clarity.json` and `scripts/quick-edit/visual_clarity.py` implement conservative word budgets (8 primary / 16 total), repeated-phrase checks and hash-bound independent comprehension evidence. Those numeric budgets are engineering defaults, not numbers supplied by Krish.
- `scripts/quick-edit/quality.py` checks a final video's audio, sync, loudness, motion, visuals, full review and clarity receipt. `scripts/post-pack/send.py` invokes it for delivery destinations; working uploads are intentionally distinct.
- `apps/control-plane/api/library/confirm.ts` verifies stored bytes and storage readiness. Storage readiness is not editorial readiness and this endpoint does not itself establish the photographic quality floor.
- `packages/core/src/carousel.ts` has story hashes, exact-content approval bindings, brand staging and editorial checks. That does not yet bind this new photographic standard to carousel delivery.
- The current failure is demonstrated by technically valid renders that Krish rejected as clipart. Another checklist or a producer-written `pass` is insufficient.

## Approved evidence and limits

The exact v6 style frame SHA-256 is `5eded512abfcca0ba8140b56a01e147bdab8063236f9fdc19a2c78074eef1f5d`. Krish's ruling was "much better yes". `2026-10-23-friday/revisions/motion-v6/approval.json` preserves its scope. It approves the photographic direction and routine extension, not all subsequent frames, a finished motion video, or an unseen carousel.

The rejected v4/v5 renders and supplied screenshots remain negative examples. Preserve the user's specific reasons beside them: generic clipart, word-heavy diagrams, inadequate brand colour, weak narrative motion, poor immediate comprehension. They are not deleted or relabelled as accepted. The supplied Anthropic/GitHub motion reference demonstrates narrative movement, not permission to copy its brand.

The first baseline is limited: there is no untouched holdout proving broad taste prediction and no approved carousel in this comparison set. Mark those gaps explicitly. Future ordinarily accepted outputs can extend the positive exemplar set with their actual approval provenance; the producer cannot promote its own work.

## Proposed production contract

1. Version one standard in the content-engine repository. Store an exemplar manifest with real approval/rejection provenance, exact media hashes and applicable surfaces; brand tokens and official marks; source/illustration rules; video versus carousel text rules; and named minimum review criteria. The shared library holds the large media, the repository their manifest and implementation.
2. Both producer entry points resolve and verify the quality standard automatically. A normal request such as "Produce this video" supplies no extra design instructions. The producer begins with the new story and creates a new asset/visual brief against that standard. References demonstrate craft and rejected failure modes, rather than defining the subject of the new piece. Missing standards or unavailable qualifying tools stop production with a precise repair action; there is no generic fallback template.
3. Produce original assets and story-specific compositions to the approved level: photographic/editorial material where appropriate, clear subject representation, meaningful brand colour, consistent typography, and annotations that expose the actual relationship. Design motion from this story's mechanism. Reusable code can implement drawing or transitions, but it does not prescribe a phone, passport, server or prior scene. Charts and diagrams remain available when they clarify; generic clipart arrangements are not the default. Record each asset's piece identity and provenance; previous-piece assets are not automatically eligible for a new production.
4. Before a complete render, build representative proof covering an opening, a dense explanation and a transition. For a carousel, cover opening, evidence and concluding action slides. Independently compare actual rendered output with positive and negative exemplars. Fix ordinary failures autonomously; Krish is involved when changing direction, not for routine adherence.
5. Inspect the exact final artifact. Machine checks cover frame bounds, brand assets, text inventory/OCR, size, contrast, duplication, timing and source hashes where those are measurable. Independent reviewers assess material/photographic quality, composition, explanatory motion, three-second interpretation, semantic redundancy and misleading inference. A model's three-second result is labelled a prediction, never a fabricated timed human test. Any failed minimum blocks qualification; an average score cannot erase it.
6. Separate the producer from the qualifying reviewer. A trusted server-issued review receipt binds standard version, exemplar hashes, final media hash, evidence hashes, review-run identity and result. The producer cannot satisfy the gate by writing its own JSON `pass`. Any media change invalidates the receipt.
7. Enforce the receipt server-side at delivery qualification, Video assets completion and Publish Board publication/readiness. Generic library upload and working previews remain available, clearly typed as working. Storage's existing `ready` flag remains storage-only. Direct API calls, renamed folders and an alternate uploader do not create editorial readiness. A missing reviewer/tool fails closed instead of dropping the check.
8. Add regression controls: the rejected icon frames, repetitive word-only visuals, wrong colours, tiny labels, unclear arrows, inappropriate reuse of prior-piece imagery and stale/reused certificates must fail. Approved exemplars must pass their applicable checks. A fresh-session canary receives a materially different topic and only "Produce this video" or "Produce this carousel". It must create topic-appropriate new assets, load the same quality standard and refuse the deliberately bad controls before activation. A replay of Friday is not a successful canary. Model or renderer changes rerun this comparison.

## Minimum criteria drawn from the explicit decisions

- Immediately recognisable entities: flags accompany country names when countries are the point; real/verified portraits represent named people where useful; objects and official identities carry meaning.
- Video visuals add information beyond speech and captions. No sentence paraphrases the narration. Minimal words remain a hard requirement. A carousel is read, so it receives its own text hierarchy and density constraints rather than inheriting a spoken-video word budget blindly.
- Explanatory motion in voiceover cuts: a copy travels, a result changes, a comparison becomes visible. Entrance animation alone does not establish the mechanism. Camera cuts use motion where it helps the explanation.
- Photographic/editorial craft and visible brand treatment match or exceed the accepted reference. No blanket rule that every topic needs a server rack or passport.
- Specific examples carry specific countries; generic explanations are not permanently framed around China. Generated imagery is labelled illustration where needed and never substitutes for evidence of a real test.
- Phone readability and actual end states are reviewed, including late arrivals and transitions. Midpoint stills alone are not sufficient.

## Audio companion gate

The rejected ten-join reel is a negative control, not a request for more user QA. Establish reliable source transcription, phonetic/acoustic alignment, conservative complete-speech edits, post-edit transcript comparison and an audio-capable review route. Validate that route against the known clipped joins before trusting it. Transcription recovery alone cannot prove an unclipped consonant or natural cadence. The already accepted short-VO master remains byte-identical.

## Delivery acceptance

Implementation is complete only after: producer entry tests, exact-artifact review and invalidation tests, direct-API bypass tests, video and carousel negative controls, a fresh-context canary, and deployed readback of the protected state transitions. A local policy file or passing unit tests alone does not establish enforcement. Activation across canonical skill/client surfaces follows harness release review; no canonical harness files were changed by this proposal.

No automated system can promise that every first draft meets subjective taste. The enforceable promise is that generation does not restart from an empty design brief and unqualified work cannot silently become a finished deliverable. Automatic repair runs before escalation; absent capability or an unresolved subjective disagreement is reported honestly.
