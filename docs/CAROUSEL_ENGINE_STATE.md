# Carousel Engine current state

This is the single current-state artifact for the Mindmake Carousel Engine. GitHub `main` remains authoritative. This document does not approve a visual direction or authorise publication.

The decision record, the feedback proposals and the visual reset trace live in the appendices at the end of this document: Appendix A (Decisions), Appendix B (Feedback proposals) and Appendix C (Reset trace).

Last verified: 2026-09-07 against main at 8477f04

## Product boundary

The Carousel Director is a sibling of the Video Director inside `mindmake-video-studio`. It shares radar inputs, evidence handling, canonical series, approvals, feedback memory, analytics discipline and public-action limits. It has separate story, slide and render contracts because a swipe document is not a cut-down video.

The director is a visual-production system for completed content ideas. The argument, claims, sequence, audience payoff and ending arrive from the content owner. It may challenge visualizability, request evidence or flag ambiguity, but it does not invent topics, recording ideas, claims or arguments. An incomplete idea returns to its content owner.

It serves The Money of AI and Built With AI only. Source formats remain the publication's existing canonical formats. No third editorial channel or new named public format is introduced.

## V1 journey

1. Receive a completed, approved content story with claims, proof requirements and audience payoff.
2. Validate claims, rights, kindness, usefulness and series fit. Return incomplete content rather than inventing it.
3. Run the selected collaboration mode from `config/carousel-visual-direction.json`. Standard is meaning map, visual casting, three territory auditions, storyboard and asset gate, then final.
4. Approve every screenshot or image against its exact hash before it can act as evidence.
5. Render a 1080 by 1350 review set using the pinned Mindmake design contract and official wordmarks.
6. Render the final set, then require exact final approval before packaging.
7. Produce individual PNG files for Instagram and a same-sized PDF plus PNG files for LinkedIn. Public posting remains manual.
8. Import accepted edits and later analytics into the existing taste and performance learning systems. Missing platform metrics stay null.

## Editorial standard

Every story must be unique, researched, thoughtful, kind and helpful. The Money of AI follows the money or operating mechanism behind an event. Built With AI starts from the human reason for building and shows a usable beginning. A topic without a claim, proof or audience consequence does not reach rendering.

Each slide answers one audience question. The design carries information that the copy does not need to repeat. Headlines state the point plainly. Evidence stays humourless. Wit may point at hype or the machine, never the reader or a named person's competence.

## Visual system

The first generic editorial-gates treatment was rejected. The current candidate uses a mechanical approval interlock to show one exact mechanism: an approval stops fitting when the story it checked changes. Every card uses a distinct narrative scene while the moving key, fixed alignment grid and material palette preserve coherence. Deep ink is the operating environment, cream changes the reading mode, mint means a current match and amber means changed or held. Archivo carries structure, Newsreader carries the final claim, Source Serif 4 carries short explanation and IBM Plex Mono carries source or object labels.

The mechanical interlock is approved as an infographic treatment lane, not as a universal house style. Future stories can use documentary evidence, physical analogy, cultural restage, handmade, cinematic or surreal visual grammar when the meaning earns it. The official series lettering appears once at top-left as the channel signpost. The official Mindmake wordmark appears once at bottom-left as the publisher signature, with a reserved clear zone above it. Both assets crop to configured visible bounds and align their visible letters to the same content edge. Neither mark may be recreated as live text or repeated elsewhere. The revised placement remains provisional until Krish approves the rendered review set.

## Determinism and safety

Stories pin their source artifact hash, brand-theme hash, design repository commit and fixed seed. Outputs are content-addressed. Unsupported series names, mismatched source formats, discontinuous slide numbers, repeated narrative scenes, missing end resolution, unapproved evidence images and generated evidence fail schema validation. Generated media can only be labelled illustration.

Production rendering needs exact story and visual-direction approvals. Packaging also needs exact final approval. Every carousel approval carries a `confirmation_ref` bound to its own gate and the exact story content hash; an approval whose reference binds another gate or hash is not an approval. The CLI never posts publicly.

## Interfaces implemented in the first vertical slice

- `CarouselStoryV1`
- `CarouselSlideV1`
- `CarouselAssetV1`
- `CarouselEditorialAssessmentV1`
- `CarouselDraftPackageV1`
- `studio carousel validate`
- `studio carousel method`
- `studio carousel render --review`
- `studio carousel render`
- `studio carousel package`

The first review fixture is `examples/carousels/built-editorial-gates.review.json`.

## Current gate

- Product method: locked by Krish on 2026-09-07 and encoded in `config/carousel-visual-direction.json`.
- Infographic treatment: approved as one available lane, not as a universal carousel style.
- Current rendered story: `built-approval-interlock-v2`, story hash `e4d529951caa165c2cc7da7fc03d1fd1a63cc5f1c4da59d9678dc778e63cfd14`.
- Current review render manifest SHA-256: `398223aa1413e548cbd25ae4d0375cace182387f44a7484e6b0fb76d1773efd7`.
- Verification: 42 test files and 368 tests passed; skill, trigger, renderer, public-copy and no-secrets checks passed; an unchanged rerender reproduced all seven slide hashes.
- Provisional: the revised top-left series signpost and bottom-left Mindmake signature need Krish's rendered visual approval.
- Next owner: Krish.
- Next action: review the refreshed seven-card browser candidate and approve or revise the brand placement.

## Appendix A: Decisions

This appendix is append-only. It was the standalone file `docs/CAROUSEL_DECISIONS.md` until it was folded into this document; the body of this document above the appendices is the sole current-state artifact.

### 2026-09-07: shared engine, separate director

Decision: build carousels inside `mindmake-video-studio`, with medium-specific contracts and rendering.

Why: evidence, series canon, approval lineage, feedback memory and analytics are shared concerns. Story pacing, image roles, output geometry and packaging are not.

Rejected: a separate carousel repository. It would duplicate governance and split preference learning.

### 2026-09-07: organic documents, no publishing

Decision: export LinkedIn carousels as a PDF document plus PNG files, and Instagram carousels as PNG files. Keep publication manual.

Why: this creates inspectable, portable packages without confusing LinkedIn's organic document post with its advertising carousel format or expanding action authority.

### 2026-09-07: visual direction remains a candidate

Decision: derive the first treatment from the current Mindmake design contract and official assets, then render it with a visible design-candidate mark.

Why: mechanics can be implemented now, but a new material surface does not become a locked visual language before Krish sees it rendered and approves it.

### 2026-09-07: first rendered treatment rejected

Decision: reject story hash `06206d87a5c02019eb36d54cfbc74c9d0f27b94a3b02bb215db4307f84dfa34e` as both a copy and visual-direction candidate. Do not carry its generic gate-tour spine into production.

Why: the repeated dark background, generic boxes, inert space, duplicate Built With AI labelling, alignment defects and generic authority-posturing failed the intended editorial and visual standard even though deterministic tests passed.

### 2026-09-07: interlock reset candidate selected

Decision: select the mechanical approval-interlock spine for the next rendered candidate. This is not a visual lock or publication approval.

Why: two independent blinded judges selected it over the production-docket and print-preflight concepts. Its moving key gives the exact approval-hash mechanism a memorable physical form without repeating the rejected refusal-and-gates argument.

Carry-forward: one official series identity moment only; unique narrative scene on every card; colour remains semantic; exact approval and evidence claims only; the physical mechanism is illustration, not evidence; Krish must approve the rendered candidate before the treatment can be locked.

### 2026-09-07: visual co-direction method locked

Decision: the Carousel Director accepts completed content ideas and owns visual production only. Standard mode is meaning map, visual casting, three two-frame territory auditions, storyboard and exact asset approval, then final. Fast and exploratory modes preserve the same safety boundary with fewer or more human decision points.

Why: a repeatable aesthetic is easy to copy. The defensible system is Krish's contextual judgment over owned proof, unexpected associations, exact rights paths, a private motif history and explicit reasons for each selection or rejection.

Rejected: using the carousel or video engine to decide what Krish should discuss or record. Incomplete topics, arguments, claims, payoffs or endings return to the content owner.

### 2026-09-07: carousel brand hierarchy locked

Decision: use the official series wordmark once at top-left as the channel signpost and the official Mindmake wordmark once at bottom-right as the publisher signature on every carousel card.

Why: Built With AI and The Money of AI explain the channel while repeated, invariant Mindmake placement builds publisher recognition. Do not stack or duplicate the identities.

Carry-forward: the placement rule is approved. The revised frame execution still requires rendered visual approval.

### 2026-09-07: carousel publisher signature moved left

Decision: supersede only the bottom-right part of the preceding carousel brand hierarchy. Mindmake now sits bottom-left, while the official series wordmark remains top-left. Both marks crop to their visible bounds and align to the same content edge, with a reserved clear zone above the footer signature.

Why: the publisher signature reads more naturally as a footer on the left and the visible letterforms should align, not the transparent source canvases or their surrounding plates.

Carry-forward: this is a carousel-only frame rule. The exact revised render still requires visual approval.

## Appendix B: Feedback proposals

Capture records method evidence without changing a durable standard automatically. This appendix was the standalone file `docs/CAROUSEL_FEEDBACK_PROPOSALS.md` until it was folded into this document.

### CAROUSEL-METHOD-2026-09-07-01 / v1 / awaiting owner review

- Owner and decision rights: Krish Raja.
- Class, surface and situation: method; carousel visual direction and copy; first rendered Built with AI review set.
- Current source version: carousel branch commit `9797a03b768c4b2287776578a264af05a907ecbd`; rejected story hash `06206d87a5c02019eb36d54cfbc74c9d0f27b94a3b02bb215db4307f84dfa34e`.
- Evidence: one explicit high-severity human rejection. Duplicate series identity, poor alignment, repeated backgrounds, inert visual space, generic information graphics and arrogant or AI-sounding copy were named directly.
- Alternative explanations: the fixture story may have been intrinsically weak; some defects were renderer implementation errors rather than a general carousel-method defect.
- Proposed bounded change: require a single series identity moment, a unique narrative scene per card, semantic colour, a specific owned or verified source mechanism, and an anti-slop copy pass before a carousel enters visual review. Do not infer a universal ban on dark backgrounds, diagrams or short declarative lines.
- Expected effect and measurement window: the next three carousel candidates should need fewer corrections for duplicated identity, repetitive backdrops and generic copy while retaining factual clarity and deterministic rendering.
- If wrong: scene uniqueness may create decorative novelty and increase production cost without improving comprehension. Revert the method proposal and keep only the artifact-specific fixes.
- Validation: focused regression covers one identity moment, unique scenes, canonical naming, semantic accents and the rejected phrase signatures. Complete regression is `npm run verify` plus a 375-pixel human review.
- Size and context delta: one optional method proposal and narrow schema/render checks. No live skill or active preference changes in Capture.
- Privacy, audience and retention: private project feedback only; no customer data; preserved in Git history.
- Dependencies and handoff: Krish approval, then the normal CTRL Compile, Build, Check and harness release chain if a reusable skill change is wanted.
- Prior known-good and rollback: branch commit `9797a03b768c4b2287776578a264af05a907ecbd`; revert the candidate commit if the new schema or renderer regresses.

### CAROUSEL-METHOD-2026-09-07-02 / v1 / owner approved

- Owner and decision rights: Krish Raja, approved in the carousel review session on 2026-09-07.
- Class, surface and situation: product method, visual co-direction and carousel brand hierarchy.
- Evidence: Krish approved the standard Meaning Map to Visual Casting to Territory Audition to Storyboard and Asset Gate to Final sequence, with fast and exploratory variants. He approved Built With AI at top-left and Mindmake at bottom-right.
- Bounded change: apply this method only to carousel visual production from completed content ideas. Do not use it to infer topics, arguments or recording ideas. Apply the brand hierarchy to carousel cards only, not to the separately approved video lockup.
- Learning rule: store why an image or analogy worked in context. Do not infer a general preference for a pictured object, meme, animal, colour or style.
- Validation: a versioned method contract, CLI parse, skill instructions, schema regression tests and a revised rendered carousel.
- Remaining gate: Krish must approve the revised brand placement in the rendered review set. No public package or durable cross-product rule is authorised by this record.

### CAROUSEL-METHOD-2026-09-07-03 / v1 / owner directed

- Owner and decision rights: Krish Raja, directed in the carousel review session on 2026-09-07.
- Class, surface and situation: frame execution; carousel wordmark placement, crop and spacing.
- Evidence: Krish preferred Mindmake at bottom-left, requested more breathing space above the footer mark and identified transparent source-canvas edges as the cause of false visual alignment.
- Bounded change: move the carousel Mindmake signature to bottom-left, crop both official wordmarks through their configured visible regions, align their visible letterforms to the content grid and reserve a footer clear zone. Do not change the separate video lockup.
- Validation: render all seven cards, inspect full-resolution pixels, verify both official marks appear on every card, verify the footer clear zone and rerun deterministic checks.
- Remaining gate: Krish's exact visual approval of the revised render.

## Appendix C: Reset trace

This appendix was the standalone file `docs/CAROUSEL_RESET_TRACE.md` until it was folded into this document.

### Reset 2026-09-07-01

- Rejected artifact: `built-editorial-gates-v1`, story hash `06206d87a5c02019eb36d54cfbc74c9d0f27b94a3b02bb215db4307f84dfa34e`.
- Same-spine revision count before reset: 1.
- Sanitized brief: distinct purpose-built scenes; one official series identity moment; stable grid; semantic mint and amber; every visual carries narrative information; no generic cards, dashboards, decorative code or AI-default styling; plain, specific, non-commanding copy grounded in an owned artifact.
- Generator A: production docket and chain of custody.
- Generator B: mechanical approval interlock.
- Generator C: modern print-preflight permission strip.
- Pairwise distance: docket and interlock passed; interlock and preflight passed; docket and preflight were judged adjacent by one primary judge and distinct but narrow by the other.
- Primary judge 1: selected interlock, 72.0/80.
- Primary judge 2: selected interlock, 71.5/80.
- Tiebreaker: not required.
- Disguised repetition: print-preflight failed because its refusal-before-render spine repeated the rejected argument. Docket and interlock did not.
- Constraint regression: interlock passed conditionally. The implementation must not invent one universal approval object, use brass as a semantic accent or rely on railway terminology.
- Discarded strengths restored: exact hard stops, visible route to final package, fair friction countercase, separate story, visual-direction and final approvals.
- Selected spine: one approval key that ceases to fit after the reviewed story changes.
- Synthesis: seven camera and material scenes; official series lettering appears once; internal cards carry only the official Mindmake anchor; source-code claims sit in the claim ledger; the key remains illustrative.
- Feasibility: deterministic SVG and CSS inside the existing Remotion still renderer, with no third-party or generated assets.
- Rendered candidate: `built-approval-interlock-v2`, story hash `e4d529951caa165c2cc7da7fc03d1fd1a63cc5f1c4da59d9678dc778e63cfd14`.
- Gate: explicit Krish approval is required before visual-direction lock.
