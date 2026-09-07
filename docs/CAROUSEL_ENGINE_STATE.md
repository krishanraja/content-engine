# Carousel Engine current state

This is the single current-state artifact for the Mindmake Carousel Engine. GitHub `main` remains authoritative. This document does not approve a visual direction or authorise publication.

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

The mechanical interlock is approved as an infographic treatment lane, not as a universal house style. Future stories can use documentary evidence, physical analogy, cultural restage, handmade, cinematic or surreal visual grammar when the meaning earns it. The official series lettering appears once at top-left as the channel signpost. The official Mindmake wordmark appears once at bottom-right as the publisher signature. Neither mark may be recreated as live text or repeated elsewhere. The revised placement remains provisional until Krish approves the rendered review set.

## Determinism and safety

Stories pin their source artifact hash, brand-theme hash, design repository commit and fixed seed. Outputs are content-addressed. Unsupported series names, mismatched source formats, discontinuous slide numbers, repeated narrative scenes, missing end resolution, unapproved evidence images and generated evidence fail schema validation. Generated media can only be labelled illustration.

Production rendering needs exact story and visual-direction approvals. Packaging also needs exact final approval. The CLI never posts publicly.

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
- Current review render manifest SHA-256: `daf1e34bee34efa633253ffcc26c4329e4b51f8e05ca6f5834b75d6432b02afc`.
- Verification: 42 test files and 367 tests passed; skill, trigger, renderer, public-copy and no-secrets checks passed; an unchanged rerender reproduced all seven slide hashes.
- Provisional: the revised top-left series signpost and bottom-right Mindmake signature need Krish's rendered visual approval.
- Next owner: Krish.
- Next action: review the refreshed seven-card browser candidate and approve or revise the brand placement.
