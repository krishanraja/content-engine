# Friday clarity revision v2

Authority: Krish's direct feedback on 24 October 2026. The generic passport needs sample countries (Canada and USA); every visual must be clearer; Chinese AI imagery belongs only to examples about those specific systems. This supersedes the conflicting picture choices in the signed baseline, without changing the recorded narration or its factual claims.

**Production source:** use this directory's `visual-copy.json` for all four cuts. The original `../../locked/visual-copy.json` is preserved. `revision.json` binds its hash and lists every before/after replacement; applying only those replacements must reproduce the candidate exactly. `scene-audit.json` covers all 57 beat definitions. Nine definitions change. The other 48 and all recording/timing files remain unchanged.

## Visual contract

- State of use: a viewer on a phone, hearing the explanation once. The main picture must still explain the point with sound off.
- Generic passport: a clearly illustrative, unbranded AI, BORN Canada and LIVES USA, with the meanings alongside. Both values appear on arrival; the narration selects each field. These are example values, never claims about a named model.
- General explanations and closing advice: use this neutral example. Clear the previous model and country before changing from specific evidence to general advice.
- International context: equal visual weight, including the US, France, UAE, India and China. Country names use the same neutral ink; warning colours never mark nationality.
- Specific evidence: retain the correct companies, countries, sources, dates, controls and qualifications. Do not obscure an actual finding to create artificial balance. A test result is about the tested systems and questions.
- Statistics: show the quantity and what it measures together. The 35% field keeps exactly 35 of 100 tiles and now explains the finding as applying to this test.
- Frame-level acceptance: phone readability, one interpretable claim, concrete values, no unexplained symbols, no company/country carry-over, no unsupported inference from colour or position.

## Rendered evidence and limits

The revised three-beat study (S04â€“S06) is rendered in both shapes, 495 frames at 30 fps. It is a 16.5-second production study, not a finished cut. Its AAC audio is copied unchanged from the previous study and the extracted AAC hashes match. It adds no audio edits. TypeScript passes; full-size held frames and phone-size sequence images were inspected.

The remaining scenes have a revised production specification, not completed renders. No final playback or listening gate is claimed. No making record or live Publish Board was changed. The full four-video production and final board remain incomplete.

**Current study pair:** `Friday-motion-study-v2-vertical.mp4` plus `Friday-motion-study-v2.1-horizontal.mp4`. The initial v2 horizontal is superseded: its finding description overlapped the grid. The correction keeps it below the grid and passes the repeated visual check. See `library-correction-receipt.json`; the initial receipt remains historical evidence.

The engine library holds the study package under the post's `3 Video/Working studies/clarity-v2/` after the confirmed send recorded in `library-receipt.json`. Re-render from the repository with `node scripts/quick-edit/render_border_proof.mjs JOB.json`, where JOB supplies the downloaded `proof-props.json`, output directory and optional browser path. Both original v1 deliverables remain preserved.

Next: implement the remaining scenes from this revision, then complete the four exports and their exact-file reviews before the final board approval.
