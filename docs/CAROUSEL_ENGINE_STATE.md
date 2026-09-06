# Carousel Engine current state

This is the single current-state artifact for the Mindmake Carousel Engine. GitHub `main` remains authoritative. This document does not approve a visual direction or authorise publication.

## Product boundary

The Carousel Director is a sibling of the Video Director inside `mindmake-video-studio`. It shares radar inputs, evidence handling, canonical series, approvals, feedback memory, analytics discipline and public-action limits. It has separate story, slide and render contracts because a swipe document is not a cut-down video.

It serves The Money of AI and Built With AI only. Source formats remain the publication's existing canonical formats. No third editorial channel or new named public format is introduced.

## V1 journey

1. Select an owned artifact, public source packet or sanitised internal pattern.
2. Write one arguable story with a cover, scene, mechanism, proof, fair counterpoint and resolution.
3. Validate claims, rights, kindness, usefulness and series fit.
4. Approve every screenshot or image against its exact hash before it can act as evidence.
5. Render a 1080 by 1350 review set using the pinned Mindmake design contract and official wordmarks.
6. Krish approves the story and visual direction.
7. Render the final set, then require exact final approval before packaging.
8. Produce individual PNG files for Instagram and a same-sized PDF plus PNG files for LinkedIn. Public posting remains manual.
9. Import accepted edits and later analytics into the existing taste and performance learning systems. Missing platform metrics stay null.

## Editorial standard

Every story must be unique, researched, thoughtful, kind and helpful. The Money of AI follows the money or operating mechanism behind an event. Built With AI starts from the human reason for building and shows a usable beginning. A topic without a claim, proof or audience consequence does not reach rendering.

Each slide answers one audience question. The design carries information that the copy does not need to repeat. Headlines state the point plainly. Evidence stays humourless. Wit may point at hype or the machine, never the reader or a named person's competence.

## Visual system

The current candidate uses the Mindmake instrument system: deep ink, cream only where it changes the reading mode, mint for an answer, amber for something that changed, Archivo for structure, Newsreader for verdict claims, Source Serif 4 for body text and IBM Plex Mono for source or object labels.

The cover gives the official series wordmark a large phone-legible identity moment. Internal slides collapse to the official Mindmake wordmark. Neither mark may be recreated as live text. This candidate remains provisional until Krish approves the rendered review set.

## Determinism and safety

Stories pin their source artifact hash, brand-theme hash, design repository commit and fixed seed. Outputs are content-addressed. Unsupported series names, mismatched source formats, discontinuous slide numbers, missing end resolution, unapproved evidence images and generated evidence fail schema validation. Generated media can only be labelled illustration.

Production rendering needs exact story and visual-direction approvals. Packaging also needs exact final approval. The CLI never posts publicly.

## Interfaces implemented in the first vertical slice

- `CarouselStoryV1`
- `CarouselSlideV1`
- `CarouselAssetV1`
- `CarouselEditorialAssessmentV1`
- `CarouselDraftPackageV1`
- `studio carousel validate`
- `studio carousel render --review`
- `studio carousel render`
- `studio carousel package`

The first review fixture is `examples/carousels/built-editorial-gates.review.json`.
