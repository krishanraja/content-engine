# Friday video failure audit — 27 October 2026

**Verdict: all four delivered edits are rejected and unpublishable. Keep the accepted stills and original recordings; rebuild the edit and animation.** This is a production-direction, execution and verification failure, not an inadequate brief.

## Evidence and limits

Reference: the supplied Drive file `18qgh6rQ6d5uDKolkP_R7ZK7gsfVUdzTf`; local SHA-256 `9c9fbcc14de4197a246c5fc7784bd5df4839ca118f9ad5428eefbb6361299a67`. Compared against short VO v7, short camera v10, long VO v10 and long camera v11. Export hashes are in `../revisions/motion-v7/final-technical-checks.json`.

Inspected the reference's existing full one-second frame sequence and 6fps detail strips, export proof frames, composition code, scene manifests, edit maps, caption files, review results and repository brand guidance. Additional analysis decoded existing media into memory to compare source/export timing. No new video render, generation, provider spend, board activation or making completion occurred.

This is a visual-sequence and technical audit, not a new continuous audiovisual listening review. Sound quality and syllable-perfect synchronization are not established by these methods. User-reported lip-sync failure remains a release defect; its exact cause is unresolved. Creative conclusions are inspectable comparisons, not independent viewer scores.

## Timestamped comparison

Our times below are final long VO v10 unless otherwise named, mapped through the actual edit receipt including intro/donor audio. These compare explanatory functions, not identical subject matter.

| Reference | Our output | What went wrong |
|---|---|---|
| 00:00–00:06: disruption, then Git/laptop/code context | 00:00–00:03.5 title/flags, then a passport spread reused across opening beats | Packaging delays the spoken hook; the spread repeats rather than developing the claim. Integrate identity into the opening performance and introduce an example as it becomes relevant. |
| 00:07–00:14: dots fall, accumulate and clog a funnel | 00:21–00:39: Chesky/Airbnb/Qwen composition; connecting arrow restarts in consecutive L03/L04 scenes | The arrow shows association, not the customer-service mechanism. Replaying it adds no information. Show a customer query entering the service/model and an answer returning, retaining the objects between stages. |
| 00:15–00:26: the SAME unit dots grow from 2,500 to 30,000 | 02:11–02:34: a 200-tile newspaper test changes into a different 100-dot percentage grid and separate model results | The denominator/layout changes without explanation. Keep a persistent comparison and distinguish 200 questions per model from aggregate percentages. Do not imply 70 failures across the entire four-model test from a 200-tile graphic. |
| 01:41–01:48: one balance tips as the relative cost of writing/reviewing changes | 02:00–02:11 and 02:44–02:51: passport photograph plus underline | The still introduces a metaphor; the underline does not demonstrate its consequences. Keep origin fixed while moving hosting, then keep hosting fixed while changing answer behaviour. |
| 01:09–01:17: cards exceed infrastructure capacity, then raw output is distinguished from trusted output | Around 02:50 onward: phone/server/bank photographs and paths | Objects are recognizable, but a path is asked to do most of the explaining. A visible query copy should travel and remain at its destination; model identity stays stable where origin is unchanged. |
| 01:18–01:23: actions accumulate, checks complete, a merge action closes the sequence | Approximately 04:59–05:21: phones/arrows span several practical instructions | Asking a supplier, comparing one question and retaining an alternative are different actions. Our repeated phone motif fails to distinguish them. Show fields revealed, answers compared and a second option retained. |
| Designed text reveals accompany the explanation; publisher mark anchors the sequence | No visible narration captions; most publication identity is reserved for packaging | Separate SRT files do not create visible captions in the exported MP4. Restore branded captions; keep explanatory labels additive. |

The reference is predominantly flat graphic animation. Its strength is NOT photorealism or constant movement. A hold can work after a meaningful transformation. The failure was substituting attractive stills and drawn arrows for an explanation that develops over time.

### Motion measurements and specific defects

Both long graphic stages contain 41 scenes. VO holds frames for **170.3/323.4 seconds (52.7%)**, across 29 scenes. Camera's graphic stage holds **177.9/326.9 seconds (54.4%)**, across 29 scenes. These are pre-final-edit graphic-stage figures, not claims that the composited face is frozen. The rendering optimization preserves sparse authoring; it is not itself proof of poor animation.

L03/L04 each have three seconds of movement followed by holds, and restart the same Airbnb arrow. L14 has 2.5 seconds of movement in 10.7 seconds. Long VO L40 has 9.33 seconds in 22.7 seconds. Combined with unchanged meanings, these support the entrance-and-hold diagnosis.

In `EditorialCameraShort.tsx`, S12's annotation uses `f % 180`: it resets every six seconds at 30fps. Its path switches from LIVES to BORN at frame 180. No word marker controls the resets. On short camera v10 this is approximately 00:46.2–01:04.4, with resets near 00:52.2, 00:58.2 and 01:04.2. Redrawing the same point is not a new explanation. Draw once on the relevant cue and retain the result.

## Brand diagnosis

Compared `docs/STUDIO.md`, the makeyourmindup publication theme in `config/studio.json`, house font declarations and actual composition code. The underlying brandbook PDF was not newly fetched: this is against the repository's documented brand application, not a claim to have revalidated every current brandbook page.

1. **Correct tokens, incomplete identity.** Ink `#0C1512`, cream `#F4EFE4`, mint `#7EF0C0` and the correct Anton/Archivo families are present. The failure is their application within a dominant dark photographic collage without the complete recognizable publication system.
2. **Publisher anchor absent.** STUDIO specifies a publication mark on each Short beat. Custom Editorial/Camera compositions omit it; the closing logo substitutes for persistent identity. Model logos are more consistently visible than the publisher.
3. **Channel treatment absent.** Configured mind.the.gap accent is `#FF6A4D`. Custom packaging has no channel argument, label or channel-coloured shadow. A generic mint arrow cannot supply channel identity.
4. **Type hierarchy flattened.** STUDIO assigns mono to evidence labels/dates/section names, Archivo to structure/body, Anton to uppercase headlines, Fraunces italic to a human line where appropriate. LongScene's generic text helper uses Archivo for almost every non-display label. This does not mean all four fonts belong in every frame.
5. **Logo/type rotation violates the documented system.** STUDIO says stickers tilt, type/logos do not. OriginSpread rotates entire groups ±2°, including company marks and labels. An angled physical photograph is different from accidentally tilting its overlay identity system.
6. **Piece-specific surface meaning disappears.** Friday's direction assigns cream to BORN/answers and ink to LIVES/hosting. Dark photographs dominate both. The viewer loses the intended distinction. This is a direction failure, not merely a colour-hex problem.
7. **Caption conflict mishandled.** STUDIO specifies cream Archivo captions on an ink block with channel shadow/mint emphasis. Friday CODEX.md says no captions in the picture; motion-system.md turns additive visual-word restrictions into a caption prohibition. The user's language distinguishes narration, captions and visuals, and the latest correction requires captions. This conflict should have been reconciled, not silently resolved by providing a sidecar. The latest user instruction governs rebuilding.

The accepted stills remain useful assets. They should live inside the publication's visual system, not be expected to supply that system themselves.

## Sync and audio: confirmed versus unresolved

The assembly renders silent picture, separately edits/mixes speech, then muxes them. Short camera v10 reuses v8's picture. Multiple intermediates/clocks and an earlier observed 3.5-second error made the route fragile. This is a causal risk, not proof of the latest offset.

Source/export waveform correlation at short-camera 10/62/68/74 seconds and long-camera 10/260/300 seconds located the expected source audio positions (correlations about 0.866–0.958). Face-image matching at 15fps gave usable source matches at short 62/68/74 and long 10/260: approximate picture/audio source-time differences of 0 or −67ms. Short 10 and long 300 had poor image matches and are not usable sync evidence.

**These samples do not establish a uniform multi-second export delay.** They cannot clear the 40ms requirement, establish original-capture lip sync or cover every cut/player. The user's visible desynchronization remains unresolved. Claiming to have diagnosed or fixed it from these samples would be false. Detailed results and validity notes are in `sync-source-match.json`.

Separately confirmed: two short-camera joins use 2ms diagnostic fades and miss the locked 40ms clearance. Transcript words do not prove intact phonemes. The long VO holiday/fling donor is an unverified performance splice. Neither belongs in a near-final package. No new listening verdict is claimed.

## Why five days failed

- The initial reference study admitted it stopped at sampled stills. Later temporal analysis identified mechanisms, but the implementation retained an entrance-and-hold approach.
- Approval of still-image direction was treated as enough to scale four edits before one complete performance/motion/caption sequence demonstrated the requested experience.
- Render infrastructure, custom speech cutting, timebase repairs, reviewer experiments and filing systems were developed while trying to finish the film. Much of that activity did not improve the viewing experience.
- Available brand rules were bypassed by custom compositions.
- Review repeatedly established file identity, transport and transcript content. Those checks cannot reject weak pacing, weak explanation or lip-sync failure. Same-model reviewers did not provide reliable independent taste authority.
- Status reports emphasized completed exports and a few remaining checks, understating the unfinished creative product. The user's rejection supersedes those descriptions.

The producer owns these decisions. Remotion/FFmpeg are not inherently incapable of good video. Adding Runway/Higgsfield without changing the edit method would create different footage for the same weak assembly. The $0.18 previously reported was external-provider spend ONLY; it does not measure subscription tokens, time or total cost. A five-day token-cost allocation has not been established.

## Concrete production workflow

**Use one DaVinci Resolve project: Edit for assembly, Fusion for precise graphics, Fairlight for sound. Riverside remains recording/transcript preparation. Runway/Higgsfield supply selected photographic motion, not the final timeline.** This is a recommendation, not a claim that Resolve is installed, every feature/licence is available, or autonomous operation has been demonstrated. Nothing was installed or purchased.

1. **Performance edit from originals.** Import camera picture with its own linked audio; establish source sync before trimming. Cut whole phrases where possible. Cover visual jumps with B-roll rather than reconstructing syllables. Apply any required speed change once to the linked clip. Preserve the approved short VO audio as its locked master. Do not reuse a rejected silent picture file as the base of a fresh camera cut.
2. **Reusable brand components in the editable project.** Publication mark, channel accent, caption block, headline/data styles and ending lockup. Keep marks flat/unfiltered and grain behind them. Reuse brand components; create new subject-specific assets per piece.
3. **Actions on the speech timeline.** Each scene has a starting state, a meaningful change and a final state that supports the next line. Here: origin stays fixed while hosting changes; the query travels to its host; one work question produces two compared answers; recorded deletion evidence shows the answer disappearing. No arrow added simply because a frame feels static.
4. **Precise graphics in Fusion; generated shots only where useful.** Isolate photographic foreground/background layers. Use restrained depth where it clarifies. Keep passport fields, model marks, flags, statistics and quoted evidence as deterministic overlays. Keyframe their actions to the locked performance. Use Runway/Higgsfield for photographic scene movement, not exact quoted UI, captions, statistics or artificial lip movements for Krish's real performance.
5. **Final assembly, visible captions and sound together.** Correct caption names from the finished speech, style them in the brand and export both visible captions and SRT. Graphics carry labels/data rather than repeating caption sentences. Reframe the camera by shot, retaining eyes and gestures; avoid permanently squeezing all graphics beside a narrow face strip. Place sound accents on meaningful actions and music below speech.
6. **Complete the short VO first, then adapt.** It has accepted audio and usable stills. Establish the actual animation/brand treatment there. Build camera short from linked originals and selected shared B-roll. Long edits require expanded evidence and pacing, not stretched Short entrances. Deliver an editable project, sources, final files, captions and thumbnails. Only accepted exports enter the Publish Board.

The first later implementation should be an editable project with the real performance and a complete passport/data-location sequence, not another custom renderer or reviewer benchmark. This workflow has appropriate editing capabilities; it does not erase this chat's unproven ability to assess continuous audiovisual quality. No fully autonomous professional finishing capability is claimed.

### What the passport sequence should actually do

Show one AI identity and two distinct fields. On origin, reveal its country and keep that field attached to the model. On hosting, move a copy of the query from the phone to its destination and leave it there. Change the host while keeping origin fixed. For answer behaviour, hold the host constant and show the evidenced response difference. Captions carry speech; labels identify the entities. An annotation draws once when it directs attention to a change, never on a six-second loop. Timing comes from the chosen final performance; no new script was generated.

## Disposition

Keep accepted stills, original recordings, approved short VO audio, checked evidence, official brand assets and factual copy. Rebuild performance edits where needed, captions, framing, motion, transitions, sound placement and branded assembly. Retire the four rejected exports as production bases, preserving them as failure evidence. The board remains unactivated and Video assets incomplete.

## Source pointers

- Task workspace `work/reference/reference.mp4` and `work/reference/temporal`: existing reference and sequence evidence.
- Task `work/long-production/{vo-5min,cam-5min}-segments/manifest.json`; `work/shipping-candidates/*-edit.json`: durations and clock maps.
- `apps/renderer/src/border-control/{Editorial,EditorialLong,EditorialCameraShort,Packaging,Photographic}.tsx`; `scripts/quick-edit/render_friday_segments.mjs`; task `work/{prepare_shipping_candidates,compose_shipping_candidates}.py`: mechanisms inspected.
- `docs/STUDIO.md:115` and `:224`, `config/studio.json`, `apps/renderer/src/house/fonts.css`: documented brand system and provenance. Old Mindmake active theme and makeyourmindup candidate coexist; do not silently substitute one or treat candidate status as user approval of these exports.
- `locked/CODEX.md:103` and `locked/motion-system.md`: caption conflict and intended direction.
- [Riverside editor](https://support.riverside.com/hc/en-us/articles/16673658517277-Riverside-editor-Overview), [track behaviour](https://support.riverside.com/hc/en-us/articles/35404794986781-What-s-changed-in-the-new-editor), [handoff availability](https://riverside.com/faq). XML export depends on plan; raw-source handoff does not require assuming that feature.
- [Resolve Edit](https://www.blackmagicdesign.com/products/davinciresolve/edit), [Resolve Fusion](https://www.blackmagicdesign.com/products/davinciresolve/fusion): timeline captions and compositing.
- [Runway motion guidance](https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide), [Higgsfield camera controls](https://higgsfield.ai/camera-controls): shot-generation capabilities, not end-to-end quality assurance.
