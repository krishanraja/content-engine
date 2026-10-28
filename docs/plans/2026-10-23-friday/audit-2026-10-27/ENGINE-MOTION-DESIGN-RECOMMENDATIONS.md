# Report 3: Motion-design skill and engine implementation recommendations

Date: 27 October 2026. Status: proposed implementation specification, not implemented or production-qualified. No media generation, render, installation or paid request is authorized by this report.

## Outcome and scope

A normal request such as “Produce this video” must invoke a production method that creates a coherent branded audiovisual edit, not a collection of decorated stills. Support:

1. **Camera plus graphics and captions:** linked real picture/speech; intentional split-screen composition with occasional motivated full-screen cutaways.
2. **Voiceover plus graphics and captions:** an uninterrupted visual explanation driven by the approved voice track.

Both support vertical and landscape delivery, with independently composed layouts. A wide composition shrunk into a vertical box is not an adaptation. The skill belongs inside content-engine and is called by the existing produce-video route; it must not become a parallel publishing system, overwrite Claude's copy ownership, or turn Friday's assets into a universal kit.

## 1. A director's workflow encoded in the skill

The skill must produce decisions that an editor can execute. For each scene, specify:

- The viewer's question and the single relationship/change being explained.
- Actual performance in/out time and the relevant spoken cue.
- What the viewer sees first, what changes, what remains, and where attention goes next.
- The objects/entities needed and why each is recognizable.
- The motion mechanism: accumulation, transfer, comparison, replacement, separation, disclosure, reversal or removal.
- Caption placement, additive labels, evidence provenance, sound cue and next-scene transition.

These are an editable shot plan attached to the timeline, not another approval form. The director chooses the mechanism before selecting an effect or a generator. A named transition or camera move is not an explanation.

Examples: capacity is shown by arrivals exceeding departures; a comparison retains units and denominator; hosting is shown by where a query arrives and remains; changed behaviour is shown with input held constant; a deletion is shown with the actual answer disappearing. Reuse these principles, not last week's drawings.

## 2. Tool roles and routing

| Tool | Intended role | Engine behaviour | Do not assume |
|---|---|---|---|
| Riverside | Recording, performance/transcript preparation, straightforward camera editing and captions | Keep picture/speech linked, correct names, retain originals and export the chosen performance; import externally recorded footage where supported | A connector is available in this session; a subscription includes XML export; transcript boundaries are safe acoustic edits |
| Runway | Directed photographic moving shots from approved keyframes; selected source-shot transformations | Inspect current account/model capabilities; specify subject action, camera action, duration/aspect and continuity; save the exact request/result/provenance | That a generated shot preserves exact text, identity or geometry; that a video-edit model is a deterministic timeline editor |
| Higgsfield | Directed photographic shots, applicable camera/motion-control workflows and model access | Discover model constraints and supported reference roles; use a purposeful camera move; record original reference and chosen model | That all presets/models support the same inputs; that “motion transfer” reproduces an entire designed explainer; that analysis automatically supplies reliable audiovisual judgment |
| Resolve Edit/Fusion/Fairlight | Recommended editable assembly, precise compositing/animation and sound | One project and source timeline; controllable objects/paths/keyframes; inspectable captions and sound tracks | That it is installed or remotely operable here, or that every feature is available under the current licence |
| Existing Remotion/FFmpeg | Deterministic component rendering, transcoding and delivery when the route is proven | Retain useful existing components; use shared timing and explicit layers; emit inspectable projects/manifests | That code is inherently unsuitable, or that successful encoding establishes quality |

Do not hard-code a fashionable model name as the permanent skill. Maintain a small capability adapter for each provider and resolve model support at job time. Tool availability, account access, credit availability and actual editorial capability are different facts.

Current tool discovery exposes Runway generation/edit tools and Higgsfield model discovery, generation and video-analysis tools. It did not expose a Riverside connector. No generation or analysis job was submitted. A Higgsfield cost estimate can import reference media; it must not be treated as a universally side-effect-free query. Provider analysis remains advisory until its perception and usefulness are demonstrated.

## 3. One performance clock, one source of edit truth

Implement an edit-decision model shared by picture, sound, captions and graphics. Each segment records source asset, source in/out, output in/out, playback rate and any actual audio overlap. Use rational frame rates and sample times; retain original timestamps and variable-frame-rate metadata.

- Camera picture and its original speech remain linked. Any audio replacement is an explicit exception with a named reason, not an invisible mux step.
- Speed changes apply once to linked picture/speech. A visual lead for an annotation never shifts the mouth relative to speech.
- Graphic and caption cues derive from the final performance timeline, not stale raw-recording timestamps.
- Audio crossfades shorten or overlap time; the shared edit model must represent that exact change.
- Reuse of an intermediate requires the same source/edit identity. Never take an old silent camera file merely because its duration matches.
- Prefer complete-phrase edits and B-roll coverage of visual jumps. ASR guides navigation; it does not certify phoneme boundaries.

Provide source-versus-output timing evidence at named points and edits. Duration equality and waveform correlation alone are not lip-sync approval. Diagnose capture offset, constant export offset, accumulating drift, splice discontinuity and player-specific behaviour separately.

## 4. A real brand component system

Load the current publication identity from its canonical brand kit. Preserve explicit publication/channel identity so old Mindmake assets cannot silently replace makeyourmindup assets.

Components should include: publication anchor; channel label/accent; caption block; data labels; headline; evidence card; photographic frame/mask; restrained annotation; comparison layout; closing lockup. Their geometry should adapt by format and safe area.

Current documented makeyourmindup ingredients include ink/cream/mint, Anton headlines, Archivo structure/captions, IBM Plex Mono labels and Fraunces italic where appropriate; mind.the.gap uses coral #FF6A4D. Read actual current values rather than duplicating them into prompts. Keep official marks unwarped and above effects. A photograph may be angled without rotating the overlaid logo.

Brand recognition must persist through the story. A closing logo and a mint arrow do not supply the complete identity. Channel colours identify channels; do not repurpose them as country judgments or arbitrary warnings.

The persistent library contains brand assets, editable components, motion primitives and acceptance examples. Piece libraries contain that piece's people, products, source evidence and illustrations. Accepted stills demonstrate still-image taste only; they do not confer full-motion approval.

## 5. Camera/split-screen composition

Create separate responsive compositions for 9:16 and 16:9. Choose face/graphic proportions from the actual shot and explanation, not a fixed universal ratio.

- Preserve eyes, mouth, chin and relevant gestures; make deliberate crops rather than accepting object-fit defaults.
- Give graphics sufficient readable space. Reduce information or use a motivated cutaway instead of shrinking a dense canvas.
- Reserve a caption area that avoids the face, evidence and platform controls.
- Use the face for delivery, emphasis and trust. Let graphics dominate where the mechanism needs space; return to the face for the personal interpretation.
- Keep the real recording and speech synchronized through every layout change. Do not use generative lip repair by default.
- Assess handheld motion and stabilization on the actual source; preserve the original and avoid automatic distortion/cropping as an assumed improvement.

## 6. Full-screen voiceover composition

Animate the explanation, not merely the frame. The voice track establishes time; scene objects persist across relevant sentences and change as the argument changes.

Blend appropriate photography, genuine evidence and precise graphics. A photograph can establish a person/place; a diagram can explain the mechanism; real UI can demonstrate the behaviour. Do not force every sentence into the same medium.

Maintain a clear focal point. Introduce detail in sequence. Use depth, parallax or camera movement only when it reveals something or supports emphasis. An informative hold is legitimate; there is no minimum-motion percentage, compulsory cut interval, or requirement to keep every object moving.

Avoid repeated scene entrances, arbitrary redraw loops, decorative arrows, unrelated stock motion and endless pans across stills. An arrow must have an unambiguous origin/destination and a clear meaning; its direction cannot stand in for a relationship that the viewer cannot otherwise understand.

## 7. Visible captions and additive graphics

Separate caption text from explanatory text in the data model and compositor.

- Captions reproduce the final speech accurately for accessibility and sound-off viewing. Deliver them visibly in the requested format and as a sidecar.
- Explanatory words identify entities, units, comparisons or evidence; they should not simply duplicate the caption.
- Correct model/person names without silently rewriting what was said. Preserve raw ASR separately from editorial corrections.
- Use readable phrase grouping and natural timing. Do not split every six words mechanically or bounce every word by default.
- Fit captions inside platform-safe space and preserve contrast across photographic backgrounds. Highlight sparingly and consistently with the brand.
- Generate caption times after picture/sound editing is fixed. Every later edit invalidates affected caption timing.

The engine must resolve the old Friday no-caption instruction against the user's current visible-caption requirement. A visual-word minimization rule must never silently disable captions.

## 8. Directed generation, not prompt roulette

Each requested generated shot needs: purpose, approved starting/reference image, objects that must remain stable, permitted movement, camera instruction, duration, target aspect and continuity into/out of adjacent shots. Keep required factual text and official logos as separate controlled overlays.

Example request shape: “Static camera. One query card leaves the foreground phone and settles at the host. Phone and host remain fixed. No new text or objects.” This describes the intended action; whether a particular model reliably performs it must be tested rather than assumed. For exact symbolic travel, deterministic animation is preferable to a generator.

Use one suitable provider per shot. Do not submit the same vague request to multiple paid tools by default. Save job IDs and reconcile uncertain submissions before retrying. Cache unchanged approved outputs. Budgets must include retries, intermediate generations and provider review calls. Abort a repeatedly unproductive direction instead of expanding the batch.

## 9. Sound and editing craft

Use speech as the anchor. Preserve natural breaths, emphasis and cadence. Do not equate a matching transcript with a natural performance. Use licensed music under intelligible speech, with purposeful transitions. Sound accents may reinforce a reveal, transfer or disappearance; they must not add noise to every motion or disguise weak visuals.

Keep ambience, music, speech and effects on separate editable tracks. Review joins at normal speed as well as isolated boundaries. A session unable to perceive continuous audio must disclose that limitation and cannot manufacture a passing judgment through receipts or additional same-model agents.

## 10. Engine changes to implement

### First: reliable assembly, visible brand and captions

- Extend the existing produce-video route with explicit camera_graphics and voiceover_graphics modes.
- Implement shared edit/time mapping and intermediate lineage checking.
- Connect the existing brand source to all custom compositions.
- Add a dedicated caption track with final-timeline timing and format-aware placement.
- Produce editable project/timeline output, not only opaque flattened exports. Validate available editor automation before selecting the backend.

### Next: directing and asset production

- Add `.agents/skills/motion-design/SKILL.md`, invoked from produce-video when motion direction/production is required.
- Keep it short: outcome, two production modes, action-first shot planning, source clock, brand/caption ownership, tool routing and handoff.
- Put format guidance, provider adapters and concrete motion examples in focused supporting references.
- Implement a shot-plan structure with cue time, state_before, action, state_after, entities, labels, caption region, sound and provenance.
- Add provider capability/cost/job reconciliation adapters by extending existing access paths rather than duplicating credential/configuration systems.

### Then: repeatability without freezing creativity

- Save reusable timeline/brand components and semantic motion primitives.
- Preserve exact user acceptance scopes and rejected examples as evidence.
- Produce time-linked findings on actual files; maintain technical, factual and editorial findings separately.
- Update the existing MEDIA_STANDARD system where necessary instead of creating a second signature/scoring/approval framework. Its pending-calibration status is not solved by this proposal.
- Feed the existing Publish Board and making record only from the accepted delivery package. Do not introduce a new scheduler or posting system.

## 11. How to prove the skill transfers

A later demonstration must create a short on a new topic with its own assets, once in camera/graphics/captions form and once in VO/graphics/captions form. It must produce inspectable editable timelines and real viewing results. Replaying Friday, passing static token checks or reusing Friday's passports would not demonstrate transfer.

The working unit is one completed scene/short, not four full variants built in parallel before the treatment works. Track time to an accepted edit, revision causes and actual cost. Do not optimize for number of assets generated, rendered frames, agent messages, uploaded files or approval receipts.

## 12. Concrete first implementation deliverable

An editable project containing an original linked camera clip and its VO counterpart, publication/channel components, visible final-timed captions, and one complete explanatory scene. Its source/shot plan and production state must be recoverable by another session. The supported editor/backend must be established first; tool installation or generation is a separate future action requiring applicable authority.

This proposal describes a technically suitable production method. It does not establish that the present assistant can autonomously deliver the requested creative standard. That must be demonstrated in the actual work, not asserted by a skill file.

## Source references

- Existing engine: `.agents/skills/produce-video/SKILL.md`, `docs/MEDIA_STANDARD.md`, `docs/STUDIO.md`, `config/studio.json`, and `AUDIT.md` in this directory.
- [Riverside editor](https://support.riverside.com/hc/en-us/articles/16673658517277-Riverside-editor-Overview), [track editing behaviour](https://support.riverside.com/hc/en-us/articles/35404794986781-What-s-changed-in-the-new-editor), [export availability](https://riverside.com/faq).
- [Runway image-to-video motion guidance](https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide).
- [Higgsfield camera controls](https://higgsfield.ai/camera-controls); current connector descriptions for model discovery, generation, estimates and analysis were inspected without submitting jobs.
- [Resolve editing/captions](https://www.blackmagicdesign.com/products/davinciresolve/edit), [Fusion motion graphics](https://www.blackmagicdesign.com/products/davinciresolve/fusion).
