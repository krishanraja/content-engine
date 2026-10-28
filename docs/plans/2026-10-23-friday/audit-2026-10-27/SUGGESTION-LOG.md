# Suggestion log: the independent review of the four Friday "Two passports" cuts

On 27 Oct Krish asked for every suggestion to be logged ("log all your suggestions") and cross-checked against every failure to date. This file does that for the 160 suggestions in `INDEPENDENT-REVIEW.md` (Claude, 27 Oct). Each one gets a disposition, and each is checked against the Friday failures F01–F18 (`FULL-SESSION-FAILURE-REPORT.md`, now also in `config/failures.json`) and against R01–R46, the deduplicated register of every video failure since 7 Sep. Nothing here changes the media: Krish rejected all four exports, and the plan rebuilds Friday 23 on the `ve` engine.

## How to read it

- **#** is the suggestion number. **IR:NN** at the end of a suggestion is its line in `INDEPENDENT-REVIEW.md`. Filing kept every line number, so `IR-49` in `config/ve/crew` still means the Musk credit.
- **Failures** lists the F and R entries the suggestion bears on. A dash means it answers no registered failure; it is a new finding or a spec.
- **Disposition type**, first match wins:
  - **Mechanism**: an engine mechanism from the `ve` plan stops the class recurring. It names the QC-table row or the crew lint (L), measured check (M), Critic question (V) or construction (C).
  - **Ruling**: settled by one of Krish's rulings of 27 Oct.
  - **Gate 0**: needs a ruling from Krish that is already on the plan's Gate 0 card.
  - **Plan**: a build or rebuild step of the plan, with no failure class to stop.
  - **Superseded**: replaced by newer evidence, a ruling or the plan; it says by what.
  - **Open**: in none of the above. It needs Krish.
- Mechanisms are planned, not built. The `ve` engine is being written in another session (`claude/ve-engine-core`); none of these exists on main yet, and none is counted as a guard.

**Count by primary disposition:** Mechanism 100, Plan 30, Ruling 14, Superseded 8, Gate 0 7, Open 1. Total 160.

## Krish's rulings of 27 Oct

| Ruling | Suggestions it settles |
|---|---|
| Captions burned into every cut | 2, 3, 59, 75, 85, 104, 157 |
| HeyGen avatar and voice clone on backup until Krish approves a realism test | none in the review (it raised no synthetic likeness); held by the `ve` tool routing |
| Stills from ChatGPT Images; Runway and Higgsfield only for short animations of approved stills | 87, 101, 138 |
| The felt-robot rule binds the site and covers, not video | 70, 89, 101, 156 |
| Pilot order: the Friday proof, then Wednesday 28 | 82, 108 |

## Still to rule: the Gate 0 card

| Gate 0 question | Suggestions waiting on it |
|---|---|
| Sting: keep the approved 3.5 s stand-off, or a sting of 1.5 s or less | 1, 58, 73 |
| Bed level: −20 LU under the voice (the review asked for −31 LUFS) | 45, 49, 106, 134 |
| Per-format picture-change thresholds, replacing "≥20 changes per minute" | 60 |
| Promote `makeyourmindup-video-v1` to the publication default | 76 |

## What the cross-check found

1. **The review covers the media failures, not the process ones.** F02, F14, F15, F16, F18 have no suggestion. Their cover comes only from the plan: QC Feedback, rule 2 with `ve coverage`, computed readiness and the session protocol. F18's is process only.
2. **Two gaps in the plan.** No lint compares an on-screen figure with the spoken one (13, 90: "35%" against "a third"). No minimum label size is named (40: "US BAN" at about 10 px cap height). Both belong in the Captions and type expert.
3. **Four suggestions contradict a newer spec, and the newer spec wins.** Caption position y 1440–1680 breaches the house geometry and the Y 1500 floor (126). A 4-frame stagger gives way to the 3 f motion token (116). The −31 LUFS bed is restated as a Gate 0 level in LU (45). The bed's absence was a deliberate mode, not a bug (78).
4. **The lip-sync cause is corrected** (19, 77, 88): the v8 picture was muxed onto audio re-cut in five places. The correction note is at the end of `INDEPENDENT-REVIEW.md`.
5. **Some failures started in Claude's own locked brief, not in Codex's execution.** The caption ban, the coral-family failure colour and the Fraunces ban all came from it (63, 65, 75). They sit under QC Handoff: one spec per piece, cards generated from it.
6. **Player-specific offset (81) and recording orientation (155) have no mechanism.** Krish's phone playback at Gate 3 is the only check on the first; the second is his call.

## The 160 suggestions

Items 1 to 51 are fixes to the four rejected cuts. None will be applied to those exports. Each disposition names what stops the class recurring in the rebuild.

### C. Defects (severity: RB release-blocking, Maj major, Min minor; "All" means all four cuts)

| # | Suggestion | Failures | Type | Disposition |
|---|---|---|---|---|
| 1 | All, 0:00–0:04.4: a ≤1.5 s brand sting, then speech by about 1.5 s with the claim animated as spoken. Maj. Evidence: contact sheets; first word at 4.2–4.4 s; INTRO_STING (IR:43). | — | Gate 0 + Mechanism | Sting length is a Gate 0 ruling: the approved 3.5 s stand-off, or a sting of 1.5 s or less. The hook half is Story L (first visual event within 45 f) and M (hook event within 1.5 s, from the trace). |
| 2 | Short VO and short camera: burn in branded captions per the STUDIO spec. RB. Evidence: every sampled frame; `outputs/` (IR:44). | F08, R03 | Ruling + Mechanism | Ruling: captions burned into every cut. QC Captions. |
| 3 | Long VO and long camera: burn in captions and keep the SRT. Maj (IR:45). | F08, R03 | Ruling + Mechanism | As 2. |
| 4 | Short camera, long VO and long camera sidecars: regenerate from the final mix, punctuate, proof names. Evidence: 44, 140 and 161 cues with no punctuation; short camera cue 14 says "reply" where Krish said "line". Maj (IR:46). | F08, R02 | Mechanism | Captions L: text from the aligned words plus a name dictionary. M: caption OCR against cues ≥0.98, and the ad-lib diff. Captions come off the same clock as the final mix (rule 3). |
| 5 | All: mark tile top-left on every beat; channel pill on the section beat; STUDIO ending band. Maj (IR:47). | F07, R08 | Mechanism | QC Brand. EndingBand is Phase 1 card 5. |
| 6 | All: a call card with the statement, 31 Dec 2026 and 90%. Evidence: locked/board-copy/article.md:73. Maj (IR:48). | F07, R08 | Mechanism | Story L: dated call on mind.the.gap. CallCard is Phase 1 card 5. |
| 7 | Long VO and long camera: credit the Musk photograph (CC BY-SA 3.0, Royal Society / Debbie Rowe) on screen or in the description, with a licence link. RB (licence) (IR:49). | R46 | Mechanism | Provenance L: licence credits present (the plan names this miss). |
| 8 | Short VO 0:06.0–0:07.8: show only Chinese apps under "a Chinese AI", or keep the phone generic; Claude currently appears at 6.25 s. Maj (IR:55). | F06 | Mechanism | QC Data: entities come from the spec's dataset, not hand placement. Critic V: "Anything pretending to be evidence?" |
| 9 | Short VO 0:08.3–0:09.4: close or cover the 1.0 s gap inside "Airbnb's ... boss"; confirm by listening. Min (IR:56). | F09, R01 | Mechanism | QC Joins. Sound M: silences over 700 ms flagged. |
| 10 | Short VO 0:09.6–0:19.8: show a support query passing through Airbnb into a Qwen block and back; leave at "See,". Maj (IR:57). | F01, F05, R09 | Mechanism | QC Holds and QC Clarity. Motion L: an entity in consecutive beats must `carry`. Device `query_chip` (Phase 1 card 4). |
| 11 | Short VO 0:20.9–0:22.2: cue BORN and LIVES each on its word; they currently lead by 1.5–2 s. Min (IR:58). | F05, R09 | Mechanism | Motion M: trace against cue sheet ±2 f, on the one word clock (rule 3). |
| 12 | Short VO 0:24.65–0:25.65: hold the passport through "answers", or morph it into the logo row (currently an empty server frame). Maj (IR:59). | F05, F06, R09 | Mechanism | Motion L: `carry` across consecutive beats. M: longest still. |
| 13 | Short VO 0:25.7–0:36.6: name the outlet; one grid with a stated unit; define refused / China's line / wrong; match the spoken figure ("a third" versus 35%; "200" is never spoken). Maj (IR:60). | F06, R15, R26 | Mechanism | QC Data. Brand L: every digit device carries `producer_label`. **Gap:** no lint compares an on-screen figure with the spoken one ("35%" against "a third"); only the Critic would catch it. |
| 14 | Short VO 0:42.0–0:44.5: remove the stray mint diagonal; draw only the intended curve. Maj (IR:61). | F12, R20, R43 | Mechanism | QC Bespoke: zero per-piece code (rule 1); devices are tested library components with golden stills. |
| 15 | Short VO 0:55.95–0:57.0: opaque tiles; mark both Claude and ChatGPT for "Two flagged". Min (IR:62). | F06, R20 | Mechanism | Library device with golden stills. QC Data: the "two flagged" state comes from the dataset. |
| 16 | Short VO 0:58.0–1:03.5: show the deletion happening in a branded card with one provenance line (see H). Maj (IR:63). | F01, R12 | Mechanism | QC Clarity. Devices `record_card` and `evidence_card` (Phase 1 card 4). Provenance L: evidence slots refuse generated assets. |
| 17 | Short VO 1:15.9–1:24.9: ending band on the spoken URL. Min (IR:64). | F07, R08 | Mechanism | QC Brand. EndingBand (Phase 1 card 5). |
| 18 | Short VO 0:04.4: re-cut the first word "You" with pre-roll (a 50 dB rise in 30 ms; Whisper confidence 0.03). Min (IR:65). | F09, R01 | Mechanism | QC Joins (≥30 ms clearance each side). |
| 19 | Short camera 0:06.53–0:08.33: re-cut from the linked source and place picture by the audio edit map; lip sync is about 1.05 s off. RB (IR:71). | F10, R04 | Mechanism | QC Sync. The cause is corrected in `INDEPENDENT-REVIEW.md`: the v8 picture was reused on re-cut audio. |
| 20 | Short camera 0:20.5–0:21.6: fix the dead frame as in item 12. Maj (IR:72). | F05, F06 | Mechanism | As 12. |
| 21 | Short camera 0:33–0:35: remove the stray line. Maj (IR:73). | F12, R20, R43 | Mechanism | As 14. |
| 22 | Short camera 0:41–0:42: opaque entry for the Claude tile. Min (IR:74). | F06, R20 | Mechanism | As 15. |
| 23 | Short camera 0:44–0:46: one evidence component shared by all cuts. Maj (IR:75). | F12, R43 | Mechanism | QC Bespoke: one `FormatMaster` and one device library serve every cut. |
| 24 | Short camera 0:46.2–1:03.4: full-frame face for the call; if split, the lower half shows the live graphic, not a still. Maj (IR:76). | F05, R09, R16 | Mechanism | face-with-proof QC: still ≤4 s, face share ≤0.6, picture change ≥50%. |
| 25 | Short camera 0:46–1:16: choose steadier passages, reframe per shot, light stabilisation (forehead or chin cut; sky blown out; jump cuts at 59.8, 64.43 and 71.10 s). Maj (IR:77). | R16 | Plan | Phase 2 rebuilds the camera cuts as face-with-proof with per-shot layouts. Stabilisation stays on the existing `quality.motion_problems` gate. No new `ve` mechanism; Critic lens only. |
| 26 | Short camera 1:04–1:15: draw the arrow once on its cue and keep it. Maj (IR:78). | F05, R09 | Mechanism | QC Holds (ESLint no-frame-modulo; M: periodicity). |
| 27 | Short camera 0:36.06 and 0:58.3: cover the slips with B-roll; cut on phrase boundaries. Min (IR:79). | F09, R01 | Mechanism | QC Joins. Ingest flags ad-libs for Gate 3 (plan risk 6). |
| 28 | Short camera, whole: true-peak limit after the final encode (sample peak −0.53 dBFS against a −1.0 dBTP ceiling). Min (IR:80). | R17 | Mechanism | QC Kept gates. Sound M: true peak ≤ −1 dBTP measured after encode. |
| 29 | Long VO 0:04–0:19: introduce each model as it is named (six passports held 16 s; Indian logo illegible; pointless dissolve). Maj (IR:86). | F05, R09, R12 | Mechanism | QC Holds. Motion L: reading time. Creative L: no device or layout twice in a row. |
| 30 | Long VO 0:20–0:37: show the mechanism, not an association (17 s hold; arrow restart). Maj (IR:87). | F05, R09 | Mechanism | QC Holds. Critic V: "Explains the mechanism, or decorates?" |
| 31 | Long VO 0:38–0:51: show "built on" as a layer revealed at "owned up"; put the source on screen. Maj (IR:88). | F01, F06, R12 | Mechanism | QC Clarity. Brand L: `producer_label`. |
| 32 | Long VO 0:52–1:07: label the unit; tie the shrink to "ten times cheaper". Maj (IR:89). | F06, R15 | Mechanism | QC Data. Motion M: trace against cue ±2 f. |
| 33 | Long VO 1:08–1:20: name the Stanford AI Index on the chart. Maj (IR:90). | F06, R15 | Mechanism | Brand L: every digit device carries `producer_label`. |
| 34 | Long VO 1:20–1:31: a separate chart with its own metric label and source; currently "2.7% GAP" reuses the model-count bars. RB (IR:91). | F06, R15 | Mechanism | QC Data (L: immutable meaning; a reused chart needs its own title and producer). |
| 35 | Long VO 1:40–1:42: remove the flag-grid empty-and-rebuild. Min (IR:92). | F05, R09 | Mechanism | Motion L: an entity in consecutive beats must `carry`. |
| 36 | Long VO 2:10–2:17: a branded evidence card with outlet, date and quoted line, replacing the cropped screenshot. Maj (IR:93). | F01, R12 | Mechanism | `evidence_card` (Phase 1 card 4). Evidence screenshots come from Playwright or Firecrawl (tool routing). |
| 37 | Long VO 2:10–2:33: one persistent grid with a stated unit and the same measure for every model. Maj (IR:94). | F06, R15 | Mechanism | QC Data. `test_grid` under scoreboard-test QC: the grid is never re-laid out and denominators stay fixed. |
| 38 | Long VO 3:18: fix the overlap of the DeepSeek mark and flag with "CHINA". Min (IR:95). | R20 | Mechanism | Motion L: per-aspect safe boxes. Golden stills per device. |
| 39 | Long VO 3:20–3:33: use the test grid from H (cotton plate currently static for 12 s). Maj (IR:96). | F05, R09 | Mechanism | `test_grid`. Format QC: longest still ≤3 s. |
| 40 | Long VO 3:46–3:51: labels at least 32 px at 1080 wide ("US BAN" cap height is about 10 px). Maj (IR:97). | F01, R12 | Mechanism | QC Clarity. Brand L: type from tokens only. Critic V: "Readable at a glance on a phone?" **Gap:** the plan names no minimum label size; it belongs in the Captions and type lint. |
| 41 | Long VO 3:58–4:05: rebuild the evidence beat per H (white boxes, clipped text). Maj (IR:98). | F01, R12, R43 | Mechanism | `evidence_card` and `record_card`. QC Bespoke. |
| 42 | Long VO 4:22–4:43: recurring objects must return changed (stamped, filled). Maj (IR:99). | F05, F06 | Mechanism | Motion L: `carry`. M: held ratio. |
| 43 | Long VO 4:44–4:59: slap the TARIFF and MY VIEW stickers in; end on the dated call. Min (IR:100). | F07, R08 | Mechanism | Shared motion tokens (slide, drop, slap). Story L: dated call. |
| 44 | Long VO 5:00–5:19: a three-item checklist that ticks on each spoken action. Maj (IR:101). | F05 | Mechanism | Creative L: decision engine (a list of three or more becomes a progressive build). |
| 45 | Long VO 0:34.0–5:15.9: continuous bed at the approved −31 LUFS; room tone in every gap (about 70 runs below −50 dBFS). Maj (IR:102). | — | Gate 0 + Mechanism | Sound L: a continuous bed needs a loopable track or an Epidemic edit at least as long as the cut. M: silences over 700 ms flagged. The level is Gate 0 (bed −20 LU under the voice), which replaces the review's −31 LUFS; the two use different units. |
| 46 | Long camera 0:07.6–0:18.5, 3:02–3:15, 4:10–5:19: a designed vertical card, or full-frame graphics and face in turn (currently a 600 px pillar that cuts the face). Maj (IR:108). | R16 | Mechanism | face-with-proof: the 16:9 layout is authored separately. QC: face share ≤0.6. |
| 47 | Long camera ~1:04, ~2:17, ~2:21, ~4:09, 5:00–5:10: cut repetitions and fillers on phrase boundaries under graphic cover. Maj (IR:109). | F09, R01 | Mechanism | As 27. |
| 48 | Long camera 4:10.1–4:11.0: trim the on-camera digital silence. Min (IR:110). | R01 | Mechanism | Sound M: silences over 700 ms flagged. |
| 49 | Long camera 0:34–5:14: bed and room tone as item 45 (about 50 gaps). Maj (IR:111). | — | Gate 0 + Mechanism | As 45. |
| 50 | Long camera, whole: true-peak limit (−0.79 dBFS). Min (IR:112). | R17 | Mechanism | As 28. |
| 51 | Long camera: every long-VO graphic fix applies retimed (IR:113). | R43 | Mechanism | Rule 1: one signed spec drives every cut. The 9:16 and 16:9 layouts come from it, not from retimed copies. |

### D. Reference

| # | Suggestion | Failures | Type | Disposition |
|---|---|---|---|---|
| 52 | One persistent grid with a stated unit; outcomes coloured in place per model; Claude's grid alongside on the same unit (IR:121). | F06, R15 | Mechanism | As 37. |
| 53 | The support query enters Airbnb's service, passes through a Qwen block and returns; the block stays visible as the "inside" (IR:122). | F01, F05 | Mechanism | As 10. |
| 54 | Show the answer written, struck out and replaced in one legible card, with one provenance line (IR:123). | F01, R12 | Mechanism | As 16. |
| 55 | Unit label; the shrink lands on "ten times cheaper"; then move on (IR:124). | F06, R15 | Mechanism | As 32. |
| 56 | A three-row checklist (ask suppliers, test two AIs, keep a second ready), each ticked on its word (IR:125). | F05 | Mechanism | As 44. |
| 57 | The passport as a ledger: BORN fixed, LIVES restamped per case (IR:126). | F05, F06 | Mechanism | Motion L: `carry`. The `Passport` device is harvested from the Friday branch (Phase 1 card 4). |
| 58 | Sting ≤1.5 s; the claim animated on the first spoken line (IR:127). | — | Gate 0 | As 1. |
| 59 | Branded captions; labels name entities and never repeat the sentence (IR:128). | F08, R03, R12 | Ruling + Mechanism | Ruling: captions burned into every cut. Captions L: no label repeats three or more narration words. |
| 60 | Picture-change density as a metric: reference 78% (longest still run 3 s); short VO 40%; short camera 66%; long VO 19%; long camera 44%. Holds only after a meaningful change (IR:130; method IF:128). | F03, F05, R09 | Mechanism + Gate 0 | Format QC: picture change ≥75% for voice-led-pictures (the reference measured 78%), ≥70% for scoreboard-test, ≥50% for face-with-proof. Per-format thresholds replacing "≥20 changes per minute" are a Gate 0 ruling. |

### E. Brand

| # | Suggestion | Failures | Type | Disposition |
|---|---|---|---|---|
| 61 | Publication anchor on every beat (IR:139). | F07, R08 | Mechanism | QC Brand (mark tile on every beat, template-matched). |
| 62 | mind.the.gap pill, coral and "Fridays" (IR:140). | F07, R08 | Mechanism | QC Brand (channel pill on the section beat; coral role). |
| 63 | Coral only for mind.the.gap, never as a failure colour (IR:141). | F07, R08, R33 | Mechanism | Brand L: coral only on mind.the.gap. The amber failure colour came from the locked `motion-system.md`, so this was also a brief defect: QC Handoff. |
| 64 | Mint only for brand, answer or next action; currently diluted (IR:142). | F07, R08 | Mechanism | Brand L: colour roles. M: ΔE palette. |
| 65 | Fraunces italic for the human line (IR:145). | F07, R08, R33 | Mechanism | Brand L: fonts from tokens only. The Fraunces ban in voiceover cuts came from the locked `motion-system.md`: QC Handoff. |
| 66 | Consistent Plex Mono for labels (IR:146). | F07, R08 | Mechanism | Brand L: fonts from tokens only. |
| 67 | Grain on dark blocks, "printed not rendered" (IR:147). | F07, R08 | Mechanism | QC Brand (BrandFrame draws grain behind every beat). |
| 68 | Motion is slide, drop, slap; nothing moves for its own sake (IR:148). | F05, R09 | Mechanism | Shared motion tokens (enter 400 ms, exit 200 ms, stagger 3 f). QC Holds. |
| 69 | Logos never rotate (IR:149). | F07, R08 | Mechanism | QC Brand (Logo has no rotation prop). |
| 70 | Felt-robot photography rule needs a ruling for video (IR:150). | — | Ruling | Ruling: the felt-robot rule binds the site and covers, not video. Editorial stills are allowed in video, labelled as illustration (Provenance: `IllustrationLabel` by construction). |
| 71 | Every number names its producer (IR:151). | F06, R15, R26 | Mechanism | Brand L: every digit device carries `producer_label`. |
| 72 | Dated call (IR:152). | F07 | Mechanism | Story L: dated call on mind.the.gap. |
| 73 | Intro sting before the face (IR:154). | — | Gate 0 | As 1. |
| 74 | Ending band: ticker, stacked logo, day, pill, URL (IR:155). | F07, R08 | Mechanism | EndingBand in both aspects (Phase 1 card 5). QC Brand. |
| 75 | Resolve the caption conflict with `CODEX.md:103` (IR:156). | F08, R03, R33 | Ruling + Mechanism | Ruling: captions burned into every cut. Phase 0 purges the "no captions" text from Friday's locked docs and Monday's direction. QC Handoff: `ve lint` fails when a hand-written CODEX.md sits in the piece folder. |
| 76 | Config risk: `default_brand_theme` is still mindmake-video-v1 and the makeyourmindup theme is an unapproved candidate (IR:157). | R08, R45 | Gate 0 | Gate 0: promote `makeyourmindup-video-v1` to the publication default. |

### F. Audio and video

| # | Suggestion | Failures | Type | Disposition |
|---|---|---|---|---|
| 77 | Suspected cause of the 0:06.5 offset: `EditorialCameraShort.tsx` line 15, where `startFrom=round(beat.start*30)-3` assumes a shared zero point; the compose step then preserves the offset. Fix the insert clock (IR:174). | F10, R04 | Superseded | Superseded by the correction note in `INDEPENDENT-REVIEW.md`: the likelier cause is the v8 picture muxed onto re-cut audio. Class: QC Sync. |
| 78 | The bed is absent by design (`cam-long-mix.json "mode":"episode"`), which conflicts with MUSIC_BED (IR:175). | — | Superseded + Mechanism | Superseded as a diagnosis. `music_mode='episode'` is deliberate, and `music.py` refuses the only approved track (189.8 s, not loopable) on a cut of about 330 s. Route: an Epidemic `EditRecording` to length, then Sound L (a continuous bed needs a loopable track). |
| 79 | Gaps are probably a voice edit with no room-tone fill (IR:176). | R01 | Mechanism | Sound M: silences over 700 ms flagged. QC Joins. |
| 80 | Peaks probably come from limiting before the AAC encode; limit after the encode (IR:177). | R17 | Mechanism | Sound M: true peak ≤ −1 dBTP measured after encode. Plan risk 7: re-measure after any audio-only touch. |
| 81 | Not established: whether the fling donor splice and the short VO 8.3 s gap are audible; voice consistency; player offset (IR:179). | F09, F11, R01, R06 | Mechanism | QC Joins: the decoder is calibrated on Friday's rejected join reel, and Krish hears the joins reel at Gate 3. QC Sync: cross-correlation per segment. Player-specific offset has no mechanism; only Krish's phone playback at Gate 3. |

### Producer audit

| # | Suggestion | Failures | Type | Disposition |
|---|---|---|---|---|
| 82 | Agree: all four rejected; keep stills and recordings; rebuild the edit and animation (IR:186). | F04, F13 | Ruling + Plan | Ruling (pilot order): the Friday proof, then Wednesday 28. Phase 2 rebuilds the Friday 23 cuts on `ve` from the kept stills and recordings. |
| 83 | Agree: entrance-and-hold; the 19% versus 78% density corroborates the 52–54% held-frame figure (IR:187). | F05, R09 | Mechanism | QC Holds. Format change-density QC (see 60). |
| 84 | Agree: the denominator break, the replayed Airbnb arrow and the `f % 180` loop (IR:188). | F05, F06, R09, R15 | Mechanism | QC Data and QC Holds. Cross-check: two loop mechanisms exist (`f % 180` on line 21; a per-Sequence `f/60` restart on line 22). Both are covered by devices as pure functions of the clock and M: periodicity. |
| 85 | Agree: publisher anchor and channel absent; type flattened; sidecars are not captions (IR:189). | F07, F08, R03, R08 | Ruling + Mechanism | QC Brand. Ruling: captions burned into every cut. QC Captions. |
| 86 | Agree: one phone motif cannot carry three actions (IR:190). | F01, F05, R07 | Mechanism | Creative L: no device or layout twice in a row; decision engine. |
| 87 | Agree: a new generator will not fix weak assembly (IR:191). | R07 | Ruling | Ruling: stills come from ChatGPT Images; Runway and Higgsfield only for short animations of approved stills. Tool routing: never type, numbers, logos or Krish's mouth. |
| 88 | Sharpen: lip sync is resolved for one instance (about 1.05 s at short camera 0:06.53, local and mechanical, not drift) (IR:194). | F10, R04 | Superseded + Mechanism | The instance stands; its cause is corrected in `INDEPENDENT-REVIEW.md`. QC Sync. |
| 89 | Sharpen: "correct tokens, incomplete identity" understates the problem; the brand book adds four failures (numbers name producer, dated call, slide/drop/slap, felt robot) (IR:195). | F06, F07, R08, R15 | Mechanism + Ruling | Brand L: `producer_label`. Story L: dated call. Shared motion tokens. Ruling: the felt-robot rule binds the site and covers only. |
| 90 | Sharpen: the audit missed the 2.7% bar switch (RB), 35% versus "a third", and Claude shown under "a Chinese AI" (IR:196). | F06, R15 | Mechanism | QC Data. Critic V. Same gap as 13: spoken and on-screen figures are not compared by any lint. |
| 91 | Disagree: Fusion should not be the graphics engine (IR:197). | — | Plan | Adopted: rule 1 puts the graphics in one Remotion `FormatMaster`. AUDIT.md's Resolve/Fusion route is superseded; the tools report found Resolve not installed. |
| 92 | New evidence: the music stops at 0:34, with about 70 gaps traced to "episode" mode (IR:200). | — | Superseded + Mechanism | As 78. |
| 93 | New evidence: camera peaks above −1.0 dBTP (IR:201). | R17 | Mechanism | As 80. |
| 94 | New evidence: stray diagonal line; dead frames (IR:202). | F05, R20 | Mechanism | As 12 (dead frames) and 14 (stray line). |
| 95 | New evidence: unpunctuated SRTs and "China's reply" (IR:203). | F08, R02 | Mechanism | As 4. |
| 96 | New evidence: missing Musk attribution (IR:204). | R46 | Mechanism | As 7. |
| 97 | New evidence: the Chesky portrait is Airbnb's press headshot, not generated (IR:205). | R46 | Mechanism | No action: a provenance finding. Provenance records every asset hash in `build.json`, so a press photo and a generated still stay distinguishable. |

### G. Preserve

| # | Suggestion | Failures | Type | Disposition |
|---|---|---|---|---|
| 98 | Preserve: the long VO read (add room tone and bed) and the approved short VO audio (IR:212). | — | Plan | Phase 2 input: the long VO read and the approved short VO audio feed the rebuilt cuts; Sound L and M add the bed and room tone. |
| 99 | Preserve: the original camera recordings. In-sync usable passages are short camera 0:46.2–1:16.5 and the three long-camera on-camera passages, minus slips (IR:213). | F10 | Plan | Phase 2 input: camera cuts rebuilt as face-with-proof from the linked originals through `ve ingest` (S3). |
| 100 | Preserve: the DeepSeek evidence recordings (`camera-deletion-real.mp4`, `xinxiang.mp4`, `turkmenistan.mp4`) and the test answers (IR:214). | — | Plan | Phase 1 proof input: the DeepSeek recordings and test answers fill `test_grid` and `record_card`; Provenance hashes them. |
| 101 | Preserve the accepted stills as establishing plates, labelled as illustration: passports (Canada/USA, China/USA, Taiwan/Singapore, blank), phone-in-hand, server rack, cotton and sweater, bank interior, laptop teardown (IR:215). | — | Ruling | Rulings: stills come from ChatGPT Images; the felt-robot rule binds the site and covers only, so editorial stills are allowed in video, labelled (Provenance: `IllustrationLabel` by construction). |
| 102 | Preserve: the licensed Chesky and Musk photographs (add the credit) and the licensed music (IR:216). | R46 | Plan + Mechanism | Phase 2 input. Provenance L: licence credits present. |
| 103 | Keep these sequences: long VO 3:34–3:57 (same-prompt response table), 4:16–4:21 (Taiwan/Singapore), 4:44–4:59 (stickers); short VO 1:03.6–1:09 (circling LIVES and BORN) (IR:217). | R43 | Plan | Kept as design references, not renders. Phase 1 card 4 harvests `Pen` and `Passport` from the Friday branch; the rest of `border-control` stays off main (Phase 3). |
| 104 | Rebuild: every timeline; captions (burned in plus SRT); the identity layer (sting, mark tile, pill, call card, ending band) (IR:220). | F07, F08 | Ruling + Plan | Ruling: captions burned into every cut. Phase 2 rebuild; QC Brand for the identity layer. |
| 105 | Rebuild: all data graphics (2.7%, 200/35/63/100, Stanford, Lindy units); the deletion beat; the long-camera layout and the short-camera split (IR:221). | F06, R15, R16 | Plan + Mechanism | Phase 2 rebuild with `test_grid`, `record_card`, `evidence_card` and the face-with-proof layouts. QC Data. |
| 106 | Rebuild: the mix (continuous bed, room tone, −1 dBTP) (IR:222). | R17 | Mechanism + Gate 0 | Sound L and M (continuous bed, silences flagged, true peak after encode). The bed level is Gate 0. |
| 107 | Retire: the short-camera 0:06.5 insert, the title card, the looping arrows, the white system-font boxes, the cropped article screenshot (IR:225). | F12, R43 | Plan | The four exports are retired as bases and `border-control` stays off main (Phase 3), so none of these elements can come back. |

### H. Treatment

| # | Suggestion | Failures | Type | Disposition |
|---|---|---|---|---|
| 108 | Prove one 19.5 s sequence ("my test", long VO 225.80–245.3 s), with cues from the locked VO word timings (IR:231). | F04, F13, R11 | Ruling + Mechanism | Ruling (pilot order): the Friday proof comes first. The Phase 1 proof is exactly this 19.5 s sequence, as a 2×3 grid in both aspects. QC Proof. |
| 109 | Carried-in state: ink canvas with 7% grain (IR:236). | F07 | Mechanism | BrandFrame draws grain from the brand tokens (Phase 1 card 2); 7% is a value for that token. |
| 110 | Mark tile top-left with a 10 px coral hard shadow, plus the "mind.the.gap" pill (Plex Mono, ink on coral) (IR:237). | F07, R08 | Mechanism | QC Brand: BrandFrame draws the mark tile and pill. |
| 111 | A 2 × 3 test grid: columns XINJIANG and TURKMENISTAN with flags, in Plex Mono; rows are the Claude, ChatGPT and DeepSeek marks (IR:238). | F06 | Plan | Phase 1 card 3, `test_grid`; the proof is this 2×3 grid in both aspects. |
| 112 | Six empty cream cards: square corners, 2 px ink border, hard shadow (IR:239). | — | Plan | `test_grid` cell spec (Phase 1 card 3). |
| 113 | Mono strip: "SAME WORK PROMPT · ONLY THE COUNTRY CHANGES · KRISH'S TEST, 23 OCT" (IR:240). | F06, R15 | Mechanism | Brand L: `producer_label` (the strip names the test and its date). |
| 114 | 1.02–1.90 s: "US BAN · JUN 2022" and "US BAN · MAY 2023" tags drop in (8 frames) (IR:244). | — | Plan | `test_grid` state; drop timing from the shared motion tokens. |
| 115 | 5.12 s ("flag"): dotted ghost ticks in all six cells, showing the answer key first (IR:245). | — | Plan | `test_grid` state (the answer key shows first). |
| 116 | 7.02 s ("Claude"): the Claude row slaps in with verbatim excerpts in Archivo, "forced labour" on a mint swipe, solid mint tick (5-frame slap, 4-frame stagger) (IR:246). | — | Plan | `test_grid` row state. The 5-frame slap and 4-frame stagger give way to the shared motion tokens (stagger 3 f). |
| 117 | 7.74 s ("ChatGPT"): the same for the ChatGPT row (IR:247). | — | Plan | As 116. |
| 118 | 11.00–11.58 s: the DeepSeek × Turkmenistan cell fills and ticks; five ticks, one ghost (IR:248). | — | Plan | `test_grid` state. |
| 119 | 13.0 s ("watch"): the other cells dim to 35%; the empty cell grows into a DeepSeek chat card about 80% wide (12 frames, ease-out) (IR:249). | — | Plan | `record_card` grows out of the grid cell (Phase 1 card 4); timing from the motion tokens. |
| 120 | 14.22 s ("Xinjiang"): the verbatim prompt types in, in mono (IR:250). | — | Plan | `query_chip` (Phase 1 card 4). |
| 121 | 15.06–15.66 s: the real 23 Oct recording plays at 2× inside the card, labelled "SCREEN RECORDING · 23 OCT · 2×". If it is illegible, use an exact typed replica with the recording as a thumbnail chip (IR:251). | F01, R12 | Mechanism | `record_card`. Provenance L: evidence slots refuse generated assets, so the fallback must be an exact typed replica, labelled as one. |
| 122 | 16.38 s ("deletes"): the lines strike through and collapse upward (6 frames), leaving a dashed outline (IR:252). | — | Plan | `record_card` state. |
| 123 | 17.74 s: "Sorry, that's beyond my current scope." types in (IR:253). | — | Plan | `record_card` state. |
| 124 | 18.70–19.5 s: the card shrinks back into its cell; "ANSWER DELETED" in hollow mono (not REAL/THEATRE, which belong to under.the.hood); a RUNS chip with three pips filling on "every / single / time"; the grid is reused for Taiwan/Singapore (IR:254). | F06 | Plan + Mechanism | `record_card` and `test_grid`. scoreboard-test QC: the grid is never re-laid out, so the same grid carries Taiwan and Singapore. |
| 125 | Every state change within ±2 frames of its cue-word onset (IR:257). | F05, R09 | Mechanism | Motion M: trace against cue sheet ±2 f, confirmed by region pixel-diff (a Phase 1 acceptance criterion). |
| 126 | Captions: lower safe zone (y 1440–1680 at 1080×1920), cream Archivo 900 w112 on an ink block with grain and a 12 px coral shadow, sentence case, 2–5 words per page, one mint-swiped word per page (IR:258). | F08 | Superseded | Superseded on position: the house caption geometry is top 1180 (`geometry.ts:49`), and Captions L caps the block bottom at Y 1500; y 1440–1680 breaches both. The styling goes to Captions L (≤2 lines × 24 characters) and BrandFrame's CaptionTrack. |
| 127 | Captions carry speech; the grid carries entities and evidence and never repeats the caption (IR:259). | F08, R12 | Mechanism | Captions L: no label repeats three or more narration words. |
| 128 | Mark tile and pill persist (IR:262). | F07, R08 | Mechanism | QC Brand (template match at every beat). |
| 129 | Plex Mono for labels and provenance; Archivo for quoted answers; Anton only for "3/3" (IR:263). | F07 | Mechanism | Brand L: fonts from tokens only. |
| 130 | Mint only for the answer; coral only for channel identity (IR:264). | F07, R08 | Mechanism | Brand L: colour roles. M: ΔE. |
| 131 | Grain behind everything, never over marks (IR:265). | F07 | Mechanism | QC Brand: BrandFrame layers grain behind the marks. |
| 132 | Motion is slide, drop and slap only (IR:266). | F05 | Mechanism | Shared motion tokens. |
| 133 | Sound: the long VO with room tone in every gap (IR:269). | R01 | Mechanism | Sound M: silences over 700 ms flagged. |
| 134 | A continuous licensed bed at −31 LUFS, ducked under speech (IR:270). | — | Gate 0 + Mechanism | As 45. |
| 135 | A card slap at about −30 dBFS on each tick; a reverse swipe at about −28 dBFS on "deletes"; a 3 dB bed dip for 300 ms before "every single time" (IR:271). | — | Mechanism | Sound L: every enter, stamp or mark has an SFX or `silent`; one silence beat at the payoff. SFX come from the Epidemic house kit (`sfx-kit.json`, approved once); these levels are inputs to that kit. |
| 136 | −14 LUFS integrated; true-peak limit −1 dBTP after encode (IR:272). | R17 | Mechanism | QC Kept gates. Sound M: −14 ±1 LUFS, true peak ≤ −1 dBTP after encode. |
| 137 | Everything in this sequence is exact; no generated footage (IR:275). | F01 | Mechanism | Provenance L: evidence slots refuse generated assets; nothing generates type, charts, maps or brand UI. |
| 138 | Runway or Higgsfield only for establishing plates (cotton push, passport page turn), labelled as illustration; never for UI, text, numbers or Krish's mouth (IR:276). | R07 | Ruling | As 87. |
| 139 | Remotion for the graphics layer, because the work is flat, data-exact and word-timed, and the house fonts, tokens and hash-pinned marks already exist (IR:279). | — | Plan | Adopted: rule 1 (one tested Remotion `FormatMaster`). |
| 140 | Build each component once with independent 9:16 and 16:9 layouts: MarkTile, ChannelPill, CaptionBlock, TestGrid, PassportLedger, EvidenceCard, QueryChip, CallCard, EndingBand (IR:280). | R43 | Plan | Adopted: every format authors its 9:16 and 16:9 layouts; Phase 1 cards 2–5 build these components. |
| 141 | Drive every cue from one JSON cue sheet (word to frame) built by forced alignment of the locked audio (IR:281). | F10, R04 | Mechanism | Rule 3, one clock (C): forced-aligned word anchors compile into one EDL and cue sheet. The word clock is faster-whisper, a CTC aligner and Scribe; where they disagree, no cut. |
| 142 | An NLE with linked picture and sound (Resolve or Premiere) for the camera performance edit and the mix. Export the EDL and stems; Remotion uses the same edit list as its clock, or renders alpha overlays per scene. One clock; picture is never retimed apart from its audio (IR:282). | F10, R04 | Superseded + Mechanism | Superseded on tooling: no NLE in the route (the tools report found Resolve, Premiere and After Effects not installed). The principle is adopted as QC Sync: one EDL, one render, no mux. |
| 143 | Not Fusion: it is GUI node work an agent cannot run unattended, and it would rebuild an existing component system by hand (IR:283). | — | Plan | As 91. |
| 144 | With a human motion designer, After Effects with templates is equivalent. The method is what matters: a state-change storyboard per beat, persistent objects, and one 15–20 s sequence proven before scaling (IR:284). | F04, F13, R11 | Superseded + Mechanism | Superseded on staffing: no human editor in the route. The method is adopted: a state-change scene spec, Motion L `carry`, and QC Proof. |
| 145 | One beat sheet per piece: object, change, cue word and caption page per spoken beat (IR:287). | R33 | Mechanism | `creative-direction.json` at `schema_version: 2` is the one signed spec per piece. QC Handoff. |
| 146 | Short VO: components full frame over the approved short audio; the passport ledger as throughline, with LIVES restamped (Airbnb/Qwen, DeepSeek app, HSBC/Mistral, US-hosted DeepSeek) (IR:288). | F05, F06 | Plan | Phase 2: the VO cuts are rebuilt as scoreboard-test and voice-led-pictures. |
| 147 | Short camera: Krish full frame for the hook, call and advice, sync-checked insert by insert (IR:290). | F10, R04 | Plan + Mechanism | Phase 2 face-with-proof. QC Sync (cross-correlation per segment). |
| 148 | Short camera: graphics full frame for evidence beats (IR:291). | R12 | Plan | face-with-proof layouts (Phase 2). |
| 149 | Short camera: a split's lower half carries the live grid, never a still (IR:292). | F05 | Mechanism | face-with-proof QC: still ≤4 s. |
| 150 | Long VO: 16:9 component layouts; extra cases as new ledger stamps; data graphics with units and named producers; the dated call card before the advice; the ending band on the spoken URL (IR:293). | F06, F07 | Plan + Mechanism | Phase 2. QC Data, Brand L `producer_label`, Story L dated call, EndingBand. |
| 151 | Long camera: no permanent pillar (IR:294). | R16 | Mechanism | face-with-proof 16:9 layout. QC: face share ≤0.6. |
| 152 | Long camera: full-frame graphics for evidence beats (IR:295). | R12 | Plan | As 148. |
| 153 | Long camera: a designed 9:16 card on ink (mark tile, "Krish Raja" label) beside the live graphic or caption when Krish speaks (IR:296). | R16 | Plan | face-with-proof 16:9 layout (Phase 2). |
| 154 | Long camera: remove ad-lib slips by cutting on phrase boundaries under cover (IR:297). | F09, R01 | Mechanism | As 27. |
| 155 | Shoot horizontally next time (IR:298). | — | Open | Not in the plan. Recording orientation is Krish's call; Riverside capture arrives in Phase 4. |

### I. Questions

| # | Suggestion | Failures | Type | Disposition |
|---|---|---|---|---|
| 156 | Does the felt-robot photography rule bind video, or only the site and cover? (IR:304) | — | Ruling | Ruling: the felt-robot rule binds the site and covers, not video. |
| 157 | Confirm burned-in captions for all four cuts; the reviewer has not seen Krish's words, and recommends yes (IR:305). | F08, R03 | Ruling | Ruling: captions burned into every cut. |
| 158 | Who executes the rebuild: an agent alone, or a human editor or motion designer with the agent preparing assets and cue sheets? This decides Remotion-first versus NLE-first (IR:306). | — | Superseded | Answered by the `ve` plan, from Krish's brief: Claude orchestrates and verifies, Codex executes exact cards, and rendering is Remotion plus ffmpeg (no NLE is installed). |

### Process

| # | Suggestion | Failures | Type | Disposition |
|---|---|---|---|---|
| 159 | First-pass findings were saved blind, before any producer audit was opened (IR:5). | F17, R05 | Mechanism | Critic V: never a producer. A fresh Opus subagent writes `verdict.json` only, and stays advisory until it fails Friday v7–v11 and passes Monday 19. |
| 160 | Coverage limits were declared: frames at 1 fps (shorts) and 0.5 fps (longs), no listening, glitches under 2 s may be missed (IR:13-18). | F11, R06 | Mechanism | Measured QC runs over every frame and sample (held ratio, longest still, periodicity, join decoder), so coverage no longer rests on sampled sheets. Listening stays Krish's, at Gate 3 (the joins reel). |

## Cross-check by failure: F01–F18 (Friday 23 Oct)

| F | Failure | `ve` mechanism (planned) | Same class in R | Suggestions |
|---|---|---|---|---|
| F01 | Weak initial visual reasoning | QC Clarity | R07, R12 | 10, 16, 31, 36, 40, 41, 53, 54, 86, 121, 137 |
| F02 | Feedback not generalised | QC Feedback | R37, R14 | **none** |
| F03 | Motion reference studied as stills | QC Reference | R10 | 60 |
| F04 | Better stills stood in for a proven moving sequence | QC Proof | R11 | 82, 108, 144 |
| F05 | Motion decorated rather than explained | QC Holds | R09 | 10, 11, 12, 20, 24, 26, 29, 30, 35, 39, 42, 44, 53, 56, 57, 60, 68, 83, 84, 86, 94, 125, 132, 146, 149 |
| F06 | Visual continuity and numerical meaning not protected | QC Data | R15 | 8, 12, 13, 15, 20, 22, 31, 32, 33, 34, 37, 42, 52, 55, 57, 71, 84, 89, 90, 105, 111, 113, 124, 146, 150 |
| F07 | Brand tokens mistaken for brand application | QC Brand | R08 | 5, 6, 17, 43, 61, 62, 63, 64, 65, 66, 67, 69, 72, 74, 85, 89, 104, 109, 110, 128, 129, 130, 131, 150 |
| F08 | Caption requirement mishandled | QC Captions | R03 | 2, 3, 4, 59, 75, 85, 95, 104, 126, 127, 157 |
| F09 | Speech editing outran acoustic evidence | QC Joins | R01, R19 | 9, 18, 27, 47, 81, 154 |
| F10 | Camera assembly route created sync risk | QC Sync | R04 | 19, 77, 88, 99, 141, 142, 147 |
| F11 | Review capability found too late, never qualified | Critic (calibrated) plus measured QC; Krish listens at Gate 3 | R06 | 81, 160 |
| F12 | Engineering evidence displaced product evidence | QC Bespoke | R43, R45 | 14, 21, 23, 107 |
| F13 | Production scaled from an unproven approach | QC Proof | R11 | 82, 108, 144 |
| F14 | Durable standards overestimated as a remedy | Rule 2 (experts are code) and `ve coverage` (a marker-only guard scores 0) | R40 | **none** |
| F15 | Progress reporting understated the gap | QC Readiness | R05 | **none** |
| F16 | Krish carried the creative and QA labour | Session protocol: lint, measured QC and Critic run before any Krish gate | R06, R37 | **none** |
| F17 | Independence mishandled during recovery | Critic: never a producer | R36, R06 | 159 |
| F18 | Requested reporting not executed promptly | Process only: rule 4 (questions queue into gate packets) | R36 | **none** |

## Cross-check by failure: R01–R46 (every video failure, 7 Sep to 27 Oct)

Enforcement today is from the 27 Oct failure registry: NONE means nothing prevents it, doc means a written rule only. Scripts, titles, facts and the board (R21–R31) sit outside a video review, so most have no suggestion.

| R | Failure | Enforcement today | `ve` mechanism (planned) | Suggestions |
|---|---|---|---|---|
| R01 | Words chopped at edit joins | NONE | QC Joins | 9, 18, 27, 47, 48, 79, 81, 133, 154 |
| R02 | Captions garbled, misheard or split | partial code; self-written receipt | Captions crew | 4, 95 |
| R03 | No visible captions | NONE | QC Captions | 2, 3, 59, 75, 85, 157 |
| R04 | Lip-sync drift and offsets | code (six checkpoints) | QC Sync | 19, 77, 88, 141, 142, 147 |
| R05 | Called ready from proxy checks | doc; self-written receipts | QC Readiness | 159 |
| R06 | No qualified reviewer; the session cannot hear | inactive | Critic crew | 81, 160 |
| R07 | Generic, clipart, off-brand visuals | partial code; doc | QC Clarity | 86, 87, 138 |
| R08 | Brand tokens without brand application | NONE for custom compositions | QC Brand | 5, 6, 17, 43, 61, 62, 63, 64, 65, 66, 67, 69, 74, 76, 85, 89, 110, 128, 130 |
| R09 | Motion decorates instead of explaining | code on quantity only | QC Holds | 10, 11, 12, 24, 26, 29, 30, 35, 39, 60, 68, 83, 84, 125 |
| R10 | Motion reference studied as stills | NONE | QC Reference | **none** |
| R11 | Scaled before an integrated proof | inactive; doc | QC Proof | 108, 144 |
| R12 | Visuals not legible in about 3 s | code (word budget); semantic inactive | QC Clarity | 16, 29, 31, 36, 40, 41, 54, 59, 121, 127, 148, 152 |
| R13 | Analogy drawn as the picture | code and prompt; cue coverage NONE | Story crew | **none** |
| R14 | Generic explanation framed around China | doc | Story crew | **none** |
| R15 | Numbers lose meaning across a transition | NONE | QC Data | 13, 32, 33, 34, 37, 52, 55, 71, 84, 89, 90, 105, 113 |
| R16 | Framing and composition defects | partial code | face-with-proof format QC | 24, 25, 46, 105, 151, 153 |
| R17 | Loudness off target | code | QC Kept gates | 28, 50, 80, 93, 106, 136 |
| R18 | Reels over platform length | code | QC Kept gates | **none** |
| R19 | Speed-up glitches | partial code | QC Joins | **none** |
| R20 | Card-level design defects | doc | Brand crew | 14, 15, 21, 22, 38, 94 |
| R21 | Piece drift | code with test | Story crew | **none** |
| R22 | Straw-man and shorthand titles | code with test | QC Kept gates | **none** |
| R23 | Assets made before titles were picked | code | — (existing gate) | **none** |
| R24 | Stale title plate; YES/NO on a non-binary question | code with test | — (existing gate) | **none** |
| R25 | Scripts unreadable or not his voice | code | — (existing gate) | **none** |
| R26 | Bare scores | code | QC Kept gates | 13, 71 |
| R27 | Draft fact errors | code | Provenance crew | **none** |
| R28 | Fact gate gives different verdicts; paid reruns | code | — (existing gate) | **none** |
| R29 | Filed sources silently truncated | code with test | — (existing gate) | **none** |
| R30 | Publish board defects | code with test | — (existing gate) | **none** |
| R31 | Two accounts' boards out of sync | moot since the web board | — | **none** |
| R32 | Codex asked Krish to publish | NONE in code (Claude-only hook) | QC Publish | **none** |
| R33 | Claude to Codex handoff gaps and contradictions | code (direction gate); conflict detection NONE | QC Handoff | 63, 65, 75, 145 |
| R34 | Codex and Claude run different surfaces | doc | QC Handoff | **none** |
| R35 | Cause asserted before it was proven | doc | — | **none** |
| R36 | Asked-for files not delivered; recovery handed back | doc | — | **none** |
| R37 | Feedback fixed per instance, not generalised | doc (marker-only learnings) | QC Feedback | **none** |
| R38 | Pushed red; merged before CI; verify unstable | NONE (Krish declined required checks) | — | **none** |
| R39 | One bad filename stops a lane; silent failures | partial code with test | — | **none** |
| R40 | A test wrote synthetic folders into the real archive | code fix | — | **none** |
| R41 | Same portrait on every cover | code with test | — (existing gate) | **none** |
| R42 | Cost and time blow-outs | Claude-only hook; server budgets | ledger and dispatch refusals (not a QC row) | **none** |
| R43 | Bespoke per-piece code | board only; video NONE | QC Bespoke | 14, 21, 23, 41, 51, 103, 107, 140 |
| R44 | Context bloat came back | NONE | rule 4 (session pack ≤36 KB; not a QC row) | **none** |
| R45 | Governed Studio renderer unused | n/a | QC Bespoke | 76 |
| R46 | Rights and licensing (no incident found) | code (logo hashes); doc | Provenance crew | 7, 96, 97, 102 |

## Key: the `ve` mechanisms named above

From the plan's QC table (C = by construction, L = lint, M = measured, V = Critic, K = Krish):

| Name used here | Failure class | Mechanism |
|---|---|---|
| QC Captions | Captions absent or banned (R03, F08) | C: BrandFrame always draws CaptionTrack; no other value exists. M: OCR |
| QC Joins | Chopped words, 2 ms fades (R01, R19, F09) | L: gaps and fades. M: two-ASR round trip and calibrated decoder. K: joins reel |
| QC Sync | Lip-sync, picture muxed onto re-cut audio (R04, F10) | C: one EDL, one render, no mux. M: cross-correlation ≤1 f per segment |
| QC Holds | Entrance-then-hold, `f%180` loops (R09, F05) | C: devices are pure functions of the clock; ESLint. L: event cadence. M: held ratio, periodicity |
| QC Data | Denominator 200→100, unlabelled reused chart (R15, F06) | C: devices bind datasets. L: immutable meaning, `carry`, title and producer |
| QC Brand | No mark tile or coral, rotated logos (R08, F07) | C: BrandFrame; no rotation prop. L: roles. M: template match, ΔE |
| QC Clarity | Clipart look, illegible visuals (R07, R12, F01) | Library devices only; decision engine; reading time; V; K at Gate 1 (stills) |
| QC Reference | Reference studied as stills (R10, F03) | L: grammar card required |
| QC Proof | Scaled before proof (R11, F04, F13) | C: `render --all` refuses without `approvals.proof` while anything is `trial` |
| QC Readiness | Readiness overclaimed, self-written receipts (R05, F15) | C: computed `ve status`; delivery needs the Critic verdict and `approvals.final` |
| QC Handoff | Claude→Codex contradictions (R33, R34) | C: one spec, cards generated from it, invariants. `ve lint` fails if a hand-written CODEX.md is in the piece folder |
| QC Bespoke | Bespoke code, gate bypass (R43, R45, F12) | C: CI route check; `ve file` refuses an mp4 without `build.json` and a passing `qc.json`; `quality.py` loses its `working*` bypass |
| QC Publish | Codex asking to publish (R32) | C: `ve` has no publish verb; cards forbid it |
| QC Feedback | Feedback not generalised (R37, F02) | Taste events; a repeated ruling becomes a lint with a fixture |
| QC Kept gates | Loudness, duration, titles, bare scores (R17, R18, R22, R26) | Existing code gates, kept |

Crew names (Story, Creative, Brand, Motion, Dialogue, Captions, Sound, Provenance, Critic) are the plan's specialist crew; each ships a lint, a measured check, a card and a Critic lens. Formats (face-with-proof, scoreboard-test, voice-led-pictures) and the Phase 1 cards are from the same plan.

## Sources

- `INDEPENDENT-REVIEW.md` and `INDEPENDENT-FINDINGS-BLIND.md` (this folder): the review and its blind first pass.
- `FULL-SESSION-FAILURE-REPORT.md`, `AUDIT.md`, `ENGINE-MOTION-DESIGN-RECOMMENDATIONS.md` (this folder): the producer's own reports. Their recommendations are dispositioned there and in the plan, not here.
- The `ve` plan, 27 Oct (`C:\Users\krish\.claude\plans\c-users-krish-downloads-motion-design-v-eventual-pillow.md`, local to Krish's machine): the rulings, the Gate 0 card, the QC table, the crew, the formats and the phases.
- The 27 Oct evidence readers' failure registry (R01–R46) and Friday cross-check. They were produced for the plan and are not filed in the repository; the R table above carries what this log relies on.
