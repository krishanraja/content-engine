# Friday "Two passports": independent review of the four rejected cuts

Reviewer: Claude (Opus 5.5), 27 Oct 2026. Files reviewed, by exact name: `Friday-short-voiceover-v7-REVIEW.mp4`, `Friday-short-camera-v10-REVIEW.mp4`, `Friday-long-voiceover-v10-REVIEW.mp4`, `Friday-long-camera-v11-REVIEW.mp4`, against the Drive reference `18qgh6rQ6d5uDKolkP_R7ZK7gsfVUdzTf` (5,445,462 bytes, 720x1280, 125.4 s).

Blindness: my first-pass findings were saved (`01-independent-findings.md`, 06:20 and 06:28) before I opened any producer audit, score or fix list. Two caveats. Your brief itself names categories (donor audio, cut-word damage, lip sync), and `docs/STUDIO.md`, read as brand evidence, contains production history (Krish's rejection of the v1 Studio look, the INTRO_STING and MUSIC_BED rules). The only producer file I touched before saving was the cached Whisper model, used read-only. No media was generated, no paid call was made, nothing was published, and no existing file was changed. *(Filed 27 Oct: see "Filing and correction note" at the end, which corrects the cause of the 0:06.5 lip-sync offset.)*

---

## A. Capability and coverage

| Question | Answer |
|---|---|
| Can I decode and inspect video over time? | Yes, with ffmpeg. I did not watch continuous playback. I inspected the reference and both shorts at one frame per second, the longs at one frame every two seconds, and problem sections at 2 to 30 fps. Hard-cut detection and a picture-change measure covered every frame at 5 fps. |
| Can I perceive audio? | No. I measured it: EBU R128 loudness, sample peaks, 10 ms and 100 ms level envelopes, a mid/side split (stereo side energy as a proxy for the music bed) and near-silence runs. I transcribed locally with Whisper large-v3-turbo with word timestamps. I give no listening verdict: nothing on tone, intelligibility as heard, music taste or whether a join sounds natural. |
| Can I assess picture and sound together? | Only by measurement. I aligned mouth-region filmstrips (30 fps) with the 10 ms audio envelope and word timestamps. For the camera insert at 0:06.5 in the short camera I also matched export frames to the original recording to get the picture's source time, and compared that with the audio's source time from the edit map. |
| What am I reviewing? | Sampled frames plus measured audio and transcripts, not continuous playback. |
| Timing precision | ±1 frame (33 ms) at clear lip closures. About ±40 ms for source frame matching (24.3 fps source). About ±0.1 to 0.3 s for Whisper word times. ±0.5 to 1 s for anything I located only on the 1 fps or 0.5 fps sheets. |
| Outside my capability | Whether a join or a gap is audible or ugly; whether the voice sounds like the same session across joins; music fit and mix balance as heard; perceived lip sync on a real phone and player; any glitch shorter than about 2 s that falls between my samples in an unsampled stretch of the long cuts. |

---

## B. Verdict per file

| File | Verdict | Why |
|---|---|---|
| Short voiceover v7 | **Requires substantial rebuild** | The approved voice track and several stills are usable. The edit is not. No visible captions, no publication or channel identity until the last 3 s, picture that changes in only 40% of seconds (reference 78%), a 1 s blank frame mid-sentence, a stray line across the frame, Claude shown under "a Chinese AI", unsourced numbers, an illegible evidence beat, and no dated call. Fixing these means re-authoring the motion, not trimming. |
| Short camera v10 | **Requires substantial rebuild** | Shares the graphics defects above. Krish's first appearance (0:06.5 to 0:08.3) carries picture from about 1.05 s later in the recording than the audio heard with it. The 30 s on-camera section is in sync, but it sits in a split screen whose lower half is a still image for 17 s and then a looping arrow. Captions exist only as an unpunctuated sidecar file with a wording error. |
| Long voiceover v10 | **Requires substantial rebuild** | The script and read are the strongest asset in the set. The picture changes in only 19% of seconds, holds single layouts for 12 to 20 s, reuses the passport still six times, and turns a 59 vs 35 bar chart into an unlabelled "2.7% GAP" chart using the same bars. There is no music bed between 0:34 and 5:16, and about 70 near-digital-silence gaps sit at sentence breaks. |
| Long camera v11 | **Requires substantial rebuild** | Same graphics as the long voiceover. Vertical selfie footage is cropped into a 600 px pillar that cuts Krish's face at the frame edge and shrinks every graphic beside it. Ad-lib slips are left in ("China, China", "Twitter, Twitter posts or X posts", "uh ... uh ... you know"). The on-camera sections I measured are in sync. |

None is "needs bounded correction". The main failures (how motion explains, how the brand is applied, captions) are structural and appear in every cut.

---

## C. Timestamped defects

Severity: **RB** release-blocking, **Maj** major, **Min** minor. SVO short voiceover, SC short camera, LVO long voiceover, LC long camera.

### Shared by all four

| File | Start–end | Visible / audible | Why it fails | Sev | Evidence | Correction |
|---|---|---|---|---|---|---|
| All | 0:00–0:04.4 | Static cream card "WHY EVERY COUNTRY WANTS ITS OWN AI", flags pop in; first word at 4.2 to 4.4 s | Hook delayed by more than 4 s. No animated makeyourmindup sting, though Krish asked for one on 12 Oct (INTRO_STING). Nothing explains. | Maj | Contact sheets; Whisper first words | A ≤1.5 s brand sting, then speech by about 1.5 s with the claim animated as it is spoken |
| SVO, SC | whole | No captions in the picture. SVO has no caption file at all; SC has an `.srt` sidecar only | Silent autoplay viewers get labels, not the argument | RB | Every sampled frame; `outputs/` | Burn in branded captions (STUDIO spec) |
| LVO, LC | whole | No captions in the picture; `.srt` sidecars only | Same failure, lower stakes on 16:9 platforms that accept caption files | Maj | as above | Burn in captions and keep the SRT |
| SC, LVO, LC | sidecars | 44, 140 and 161 cues with **zero punctuation** ("might not know it So does it"); SC cue 14 "gave China's **reply**" where speech says "line" | Inaccurate and unreadable as text | Maj | `.srt` files vs Whisper | Regenerate from the final mix, punctuate, proof the names |
| All | whole body | No mark tile, no mind.the.gap pill, no coral, no "Fridays". Identity appears only as the horizontal logo plus URL in the last 3 s | Publication and channel identity missing for 95%+ of the runtime; the model logos are more visible than the publisher | Maj | Frames; STUDIO house style v2 | Mark tile top-left every beat, pill on the section beat, STUDIO ending band |
| All | the call | "My call" is advice ("fine if you don't mind where your data goes"). The prediction "I reckon the same thing will happen with AI" has no date or confidence | mind.the.gap's device ends "in a dated call". The approved article has one: by 31 Dec 2026, at least one more government funds a national model, 90% sure. None of the four cuts carries it. | Maj | Transcripts; `locked/board-copy/article.md:73` | A call card with the statement, 31 Dec 2026 and 90% |
| LVO, LC | 2:34–2:43 (LVO) / 2:12–2:23 (LC) | Elon Musk photograph | CC BY-SA 3.0 (Royal Society / Debbie Rowe). No credit on screen or in the long publishing copy | RB (licence, trivial fix) | `musk-source.json`; `cam-long-publishing-copy.md` | Credit on screen or in the description, with licence link |

### Short voiceover v7

| Start–end | Visible / audible | Why it fails | Sev | Evidence | Correction |
|---|---|---|---|---|---|
| 0:06.0–0:07.8 | Phone header switches Qwen → **Claude** at 6.25 s while "a Chinese AI ... Does that matter?" is spoken (6.06 to 7.84 s) | Pairs an American product with "Chinese AI". A misleading association with a named company. | Maj | 4 fps strip; word times | Show only Chinese apps under that line, or keep the phone generic |
| 0:08.3–0:09.4 | Speech drops to bed level (−35 to −51 dBFS) for about 1.0 s inside "Airbnb's ... boss", then re-enters 36 dB up in 100 ms | Mid-phrase pause that reads as a join. Measured, not heard. | Min (audio reportedly approved) | 100 ms envelope | Close or cover the gap; confirm by listening |
| 0:09.6–0:19.8 | One portrait, arrow to Qwen at about 0:11, then 7 to 9 s with no change through "fast and cheap ... holiday fling. See," | Entrance and hold. The dependency is asserted by an arrow, never shown. | Maj | Longest still run 7 to 9 s | Show a support query passing through Airbnb into a Qwen block and back; leave at "See," |
| 0:20.9–0:22.2 | BORN and LIVES labels appear 1.5 to 2 s before the words (22.76, 23.92 s) | Labels lead speech | Min | Sheet vs word times | Cue each field on its word |
| 0:24.65–0:25.65 | Empty server background | Dead frame while "born shapes its answers" is spoken | Maj | 4 fps strip | Hold the passport through "answers", or morph it into the logo row |
| 0:25.7–0:36.6 | "200 QUERIES" (never spoken), "35% PROBLEM RESPONSES" (spoken: "a third") | Newspaper unnamed; "problem" undefined; number mismatch. Breaks "every number names whoever produced it". | Maj | Frames + transcript | Name the outlet; one grid with a stated unit; define refused / China's line / wrong; match the spoken figure |
| 0:42.0–0:44.5 | A straight mint line sweeps corner to corner across hand and phone | Stray path artefact | Maj | 2 fps strip | Remove; draw only the intended curve |
| 0:55.95–0:57.0 | Claude tile goes translucent over the cotton boll; one arrow while "Two flagged" | Layering glitch and a count mismatch | Min | 4 fps strip | Opaque tiles; mark both Claude and ChatGPT |
| 0:58.0–1:03.5 | "24 OCT · RECORDING", a white system-font box with text against its left edge, "Sorry ..." arriving about 1.2 s after "deletes it" (60.8 s), "23 OCT 3/3 RUNS", "4× REPLAY" | The piece's own evidence is its least legible beat. The deletion is shown as two still states; two dates and "4× replay" are unexplained. | Maj | Frames; word times | See the treatment (H): show the deletion happening in a branded card, with one provenance line |
| 1:15.9–1:24.9 | URL spoken at 76.9 to 77.7 s over the question card; logo arrives at 1:21.9 after speech has ended | Identity and URL out of step; dead tail | Min | Frames + words | Ending band on the spoken URL |
| 0:04.4 | First word "You" rises about 50 dB in 30 ms after 150 ms near silence; Whisper confidence 0.03 | Suspected clipped first word | Min (needs a listen) | 10 ms envelope | Re-cut with pre-roll |

### Short camera v10

| Start–end | Visible / audible | Why it fails | Sev | Evidence | Correction |
|---|---|---|---|---|---|
| **0:06.53–0:08.33** | Krish's first appearance. "does that matter" is heard at full level while the mouth is closed or fixed in a grin; articulation appears only after 0:07.7 | **Lip sync off by about 1.05 s.** The picture comes from 0.97 to 1.13 s later in the original recording than the audio heard with it. | **RB** | Source frame matching at 6 points (match error 11.7 to 16.7 vs next-best 24 to 34); lip strip with envelope | Re-cut from the linked source; place picture by the audio edit map |
| 0:20.5–0:21.6 | Empty background frame (same dead beat as the VO cut) | Dead frame during speech | Maj | 1 fps sheet | as SVO |
| 0:33–0:35 | The same stray diagonal line | Artefact | Maj | 1 fps sheet | as SVO |
| 0:41–0:42 | Claude tile fades in translucent over the cotton | Muddy overlap | Min | 1 fps sheet | Opaque entry |
| 0:44–0:46 | Recording beat redesigned again, with no DeepSeek mark and small Archivo labels | Inconsistent with the VO cut; same legibility failure | Maj | Frames | One evidence component for all cuts |
| 0:46.2–1:03.4 | Lower panel is a still passport image for about 17 s | A B-roll box that explains nothing, while the split halves the face | Maj | Sheets | Full-frame face for the call; the live graphic (not a still) when split |
| 0:46–1:16 | Handheld walking selfie: forehead or chin cut, face at the frame edge (0:52), face small at lower left (1:00), sky blown to white; jump cuts at 59.8, 64.43, 71.10 s | Framing changes every second | Maj | Sheets; frame-difference cuts | Choose steadier passages, reframe per shot, light stabilisation |
| 1:04–1:15 | Lower arrow redraws on a loop | Motion with no new meaning | Maj | Sheets (producer code `f % 180`) | Draw once on the cue and keep it |
| 0:36.06, 0:58.3 | "it keep all your data"; "if it ... you don't mind" | Slips left in the take | Min | Transcript | Cover with B-roll and cut on phrase boundaries |
| whole | Sample peak −0.53 dBFS | Above the −1.0 dBTP ceiling in the approved music levels | Min | Peak scan; `cam-short-receipt.json` | True-peak limit after the final encode |

### Long voiceover v10

| Start–end | Visible / audible | Why it fails | Sev | Evidence | Correction |
|---|---|---|---|---|---|
| 0:04–0:19 | Six passport cards held about 16 s; Indian model logo illegible; 0:12 dissolve rebuilds the same grid | Hold; illegible identity; a pointless transition | Maj | Sheets | Introduce each model as it is named |
| 0:20–0:37 | Chesky portrait, Airbnb → Qwen arrow, 17 s hold, arrow restarts at 0:32, "LIVES: NOT STATED" | Hold; replay adds nothing | Maj | Motion: 17 s still run | Mechanism, not association (H) |
| 0:38–0:51 | Cursor → KIMI, about 13 s hold, no source on screen | Hold; unsourced claim | Maj | Sheets | Show "built on" as a layer that is revealed at "owned up" |
| 0:52–1:07 | "LINDY · REPORTED COST COMPARISON", 10×, 13 to 15 s hold | No unit (cost of what?); hold | Maj | Sheets | Label the unit; tie the shrink to "ten times cheaper" |
| 1:08–1:20 | US 59 vs China 35, labelled "NOTABLE AI MODELS · 2025" | The producer (Stanford) is only in speech | Maj | Frames | Name Stanford AI Index on the chart |
| **1:20–1:31** | The same two bars lose their numbers and grow to nearly equal length: "2.7% GAP" | The bars silently switch from model counts to benchmark scores; the viewer reads the same quantity | **RB** | Sheets | A separate chart with its own metric label and source |
| 1:40–1:42 | Flag grid empties and rebuilds | Discontinuity | Min | Sheet | Remove |
| 2:10–2:17 | Article screenshot cropped mid-word on both sides under grey; outlet not visible | Evidence shown but unreadable and unnamed | Maj | Sheets | Branded evidence card: outlet, date, quoted line |
| 2:10–2:33 | 200 squares → 100-dot % grid (35%, 63%) → Claude "100% ANSWERED" | The unit changes without a legend; "problem responses" and "answered" are different measures shown as opposites | Maj | Sheets | One persistent grid, stated unit, the same measure for every model |
| 3:18 | DeepSeek mark and flag collide with the word CHINA | Overlap | Min | Sheet | Layout |
| 3:20–3:33 | Cotton plate, about 12 s static; flag labels tiny | Hold; phone-illegible | Maj | Sheets | Use the test grid (H) |
| 3:46–3:51 | "US BAN · JUNE 2022 / MAY 2023" | Estimated cap height about 10 px at 1080p, so about 2 px on a phone | Maj | Sheets (estimate) | ≥32 px labels at 1080 wide |
| 3:58–4:05 | Two white boxes, tiny left-clipped text, "24 OCT · RECORDING" overprinted at the top edge, "3/3 RUNS" | Illegible evidence | Maj | Sheets; full-res crop | (H) |
| 4:22–4:43 | Key-risks box (3rd appearance), passport (6th), Lindy chart (2nd) | The reuse at 4:22 and 4:38 is purposeful in the script, but the objects return unchanged | Maj | Sheets | Recurring objects must return changed (stamped, filled) |
| 4:44–4:59 | Laptop teardown, "TARIFF" then "MY VIEW" stickers (fading in, not slapped); prediction undated | The best on-brand device in the set, under-used | Min | Sheets | Slap the stickers; end on the dated call |
| 5:00–5:19 | Two phones, Claude ↔ Mistral, arrows looping about 19 to 20 s over three different actions | One motif for three instructions | Maj | Motion: 20 s still run | A three-item checklist that ticks on each spoken action |
| 0:34.0–5:15.9 | No stereo bed; about 70 runs where the whole mix is below −50 dBFS for 0.3 to 1.4 s, at sentence breaks (e.g. 81.9–83.2, 107.8–109.2, 247.4–248.8) | Voice in a vacuum; probably audible as dropouts. Measured, not heard. | Maj | Mid/side 100 ms analysis; `cam-long-mix.json` "episode" mode | Continuous bed at the approved −31 LUFS bed level; room tone in every gap |

### Long camera v11

| Start–end | Visible / audible | Why it fails | Sev | Evidence | Correction |
|---|---|---|---|---|---|
| 0:07.6–0:18.5, 3:02–3:15, 4:10–5:19 | Vertical selfie as a roughly 600 px pillar; face cut by the left edge (0:08, 0:16, 4:16, 4:20, 4:22); graphics shrunk into a letterboxed right panel | The layout serves neither the face nor the graphic | Maj | Sheets | A designed vertical card, or full-frame graphics and the face in turn (H) |
| ~1:04, ~2:17, ~2:21, ~4:09, 5:00–5:10 | "China, China made 35"; "Twitter, Twitter posts or X posts"; "I suppose it's, that's"; "So my call, which is a Chinese AI is absolutely fine"; "put to work, uh, your own team's, uh, AI ... uh, you know" | Repetitions and fillers left in a published cut | Maj | Transcript | Cut on phrase boundaries under graphic cover |
| 4:10.1–4:11.0 | Krish on screen in digital silence after a cut | Dead air on camera | Min | Envelope | Trim |
| 0:34–5:14 | No bed; about 50 sub −50 dBFS gaps | as LVO | Maj | as LVO | as LVO |
| whole | Sample peak −0.79 dBFS | Above the −1.0 dBTP ceiling | Min | Peak scan | Limit |
| all LVO graphic rows | (same graphics, retimed) | as LVO | as LVO | Sheets | as LVO |

---

## D. Reference comparison

| Reference | Export | Technique | Difference in execution | Required change |
|---|---|---|---|---|
| 0:15–0:23: counter runs 2,500 → 30,000 while spoken; the 25 black dots of May stay; coral dots append; "● = 100 changes" never leaves | LVO 2:10–2:33; SVO 0:26–0:36 | Quantity comparison with a visible denominator | The reference keeps the baseline and adds to it, so the comparison is built in the object. The export cuts from 200 squares to a 100-dot percentage grid to a third all-mint grid; no unit; different measures | One persistent grid with a stated unit; colour outcomes in place per model; Claude's grid beside it on the same unit |
| 0:07–0:14: dots fall and clog a funnel ("Git became its biggest bottleneck") | LVO 0:20–0:37; SVO 0:09.6–0:19.8 | Show a mechanism, not an assertion | The reference shows why (flow exceeds a neck). The export shows a portrait and an arrow, then holds | A support query enters Airbnb's service, passes through a Qwen block and returns; the block stays visible as the "inside" |
| 1:24–1:36: "NOT DISCLOSED" stamp over the AI share; "isn't a general replacement" greys eight git tiles; the overclaim is struck through | SVO 0:58–1:03.5; LVO 3:58–4:05 | Evidence and its limits made visible | The reference's caveats are graphic events. In the export the decisive evidence (DeepSeek writing then deleting) is two tiny static states with unexplained dates | Show the answer being written, struck out and replaced in one legible card; one provenance line |
| 1:40–1:47: a balance tips as the cost of writing code shifts | LVO 0:52–1:07 (Lindy 10×) | Relative magnitude | Similar idea; the export shrinks once then holds 13 to 15 s with no unit | Unit label; the shrink lands on "ten times cheaper"; move on |
| 1:18–1:23: checklist items accumulate, a hand presses Merged | LVO 5:00–5:19; SVO 1:09–1:15 | Actionable steps | The reference adds one item per spoken action. The export loops one two-phone arrow over three actions | Three-row checklist: ask suppliers, test two AIs, keep a second ready, each ticked on its word |
| 0:58–1:13: the Claude character persists while infrastructure overflows | The passport still, 6 returns in LVO | A recurring object that gains meaning | The reference's recurring objects change state each time they return. The passports return unchanged with an underline | Make the passport a ledger: BORN stays fixed, the LIVES field is restamped per case |
| 0:00–0:06: the claim is on screen at the first word; the first frame already moves | All cuts 0:00–0:04.4 | Hook | Static title; speech starts after 4 s | Sting ≤1.5 s, claim animated on the first spoken line |
| Throughout: the narration is set as kinetic type, key word in accent colour | All cuts | Text as caption | No captions in picture; labels only | Branded captions; labels name entities and never repeat the sentence |

Measured motion density (share of seconds containing a visible picture change at 5 fps; handheld shake inflates the camera cuts): reference 78% (longest still run 3 s); SVO 40% (7 to 9 s); SC 66% (4 to 6 s); LVO 19% (20 s, 17 s, 15 s); LC 44% (13 s). The reference holds too, but only after a change that means something.

---

## E. Brand audit (makeyourmindup, mind.the.gap)

| Requirement | Source | Observed | Verdict |
|---|---|---|---|
| Logo only on ink, untouched | Book p.4–5 | End card: horizontal logo on ink | Pass |
| Publication anchor every beat (mark tile, channel-colour shadow, top left) | STUDIO house style v2 | Absent in all four | Fail |
| Section identity: mind.the.gap pill, coral #FF6A4D, "Fridays" | Book p.3, p.6; studio.json | Absent; coral appears only as salmon "problem" dots and ring | Fail |
| Coral means mind.the.gap, nothing else | Book p.6–7 | Coral-family used as a failure colour in data | Fail |
| Mint = brand, the answer, the next action | Book p.7 | Mint used for every arrow, underline, circle and most numbers | Partial (diluted) |
| Type on a colour block is ink | Book p.7 | TARIFF / MY VIEW stickers ink on mint | Pass |
| Anton uppercase for headlines | Book p.8 | Title, CHINA, NAVER CLOUD, 200 QUESTIONS | Pass |
| Fraunces italic for the human line | Book p.8 | Absent everywhere | Fail |
| IBM Plex Mono for labels, dates, sections | Book p.8 | Shorts mostly mono; longs mostly Archivo for the same jobs | Partial / inconsistent |
| Grain on dark blocks, "printed, not rendered" | Book p.12 | Not observed at sheet scale; dark generated photography carries the frame | Fail (low confidence) |
| Motion: slide, drop, slap; nothing moves for its own sake | Book p.12 | Fades, looping redraws, dissolves | Fail |
| Stickers tilt; type and logos never | Book p.12 | Stickers tilt (pass); the audit reports logos rotated ±2° with passport groups | Partial |
| Photography: the felt robot is the only subject | Book p.13 | Generated stock-style plates and press photos | **Conflict**: the book covers the site and cover; nothing rules on video (I) |
| Every number names whoever produced it | Book p.15 | Lindy named; newspaper unnamed; Stanford speech-only; 35/63/100% unsourced | Fail |
| mind.the.gap ends in a dated call | Book p.11; STUDIO call card | No date or confidence in any cut; the article's call is absent | Fail |
| No em dashes or exclamation marks; British spelling | Book p.15 | On-screen copy complies ("forced labour") | Pass |
| Intro sting before the face (INTRO_STING, 12 Oct) | STUDIO | Static title card | Fail |
| Ending band: ticker, stacked logo, day, pill, URL | STUDIO | Horizontal logo + URL only | Fail |
| Branded captions on an ink block | STUDIO | None in picture | **Conflict**: the signed storyboard (`locked/CODEX.md:103`) says no captions in picture (I) |
| makeyourmindup, not the retired Mindmake theme | studio.json | Colours match makeyourmindup tokens. But `default_brand_theme` is still `mindmake-video-v1` (active) and the makeyourmindup theme is an unapproved candidate | Pass on screen; config risk |

---

## F. Audio and video diagnosis

**Directly observed (measured)**

1. SC 0:06.53–0:08.33: picture and audio come from different moments. At export 6.6 / 6.9 / 7.4 / 7.6 / 8.0 / 8.25 s the picture matches source 4.07 / 4.40 / 4.93 / 5.14 / 5.59 / 5.88 s, while the edit map puts the audio at source 3.10 / 3.40 / 3.90 / 4.10 / 4.50 / 4.75 s. The offset is +0.97 to +1.13 s, picture later than sound. The lip strip agrees: no articulation during "does that matter".
2. Elsewhere on camera, no measurable offset. Closures and openings align with energy dips and onsets within ±1 to 2 frames at SC 46.7, 62.6, 64.4 (across a jump cut) and 74.8 s, and at LC 8.9–9.3, 185.5–186.2, 250.1–250.6 and 304.9–305.2 s. This matches the producer's 0 / −67 ms source matches.
3. Long cuts: the stereo bed exists only at 0–34.0 s and from about 314 to 316 s to the end. It falls about 125 dB inside 0.3 s at 34.0 s. Between those points the mix drops below −50 dBFS about 70 times (LVO) and 50 times (LC).
4. Shorts: continuous bed, dipping at 69–74 s. First-word onset is a 50 dB step in 30 ms at 4.43–4.46 s in both.
5. Loudness −14.0 to −15.1 LUFS integrated (fine). Sample peaks: SC −0.53, LC −0.79, SVO −1.27, LVO −1.68 dBFS. The two camera cuts exceed the approved −1.0 dBTP ceiling.
6. Transcripts: SVO "Airbnb's ... boss" contains a 1.0 s bed-level gap. LC repetitions and fillers are listed in C. "Here's what I do with this information if I were you" occurs in both short takes, so it is a delivery slip, not a splice.

**Suspected causes (not proven)**

- 0:06.5 offset: `EditorialCameraShort.tsx` line 15 starts the camera clip at `round(beat.start*30)-3` frames, assuming the camera file shares the audio source's zero point. The compose step then cuts the already-rendered picture with the same spans as the audio, so an offset baked into the render survives. The audit notes v10 reused v8's rendered picture. The producer's own sync sample at export 10 s landed on a graphic (unusable) and missed this insert. *(Superseded as the main cause: see the correction note at the end.)*
- Bed absence: `cam-long-mix.json` uses `"mode": "episode"`, with music only as an "open" (0–34.19 s) and a "close" (314.2–330.5 s) piece. This is by design, and it conflicts with the MUSIC_BED rule ("licensed music under the video").
- Gaps: probably a voice edit with no room-tone fill, exposed once the bed is removed. Not verifiable without listening.
- Peaks: limiting before the AAC encode, with codec overshoot. Plausible, unverified.

**Not established:** whether the long-VO "holiday fling" donor splice (flagged by the producer) or the SVO 8.3 s gap is audible; voice consistency across joins; any player-specific offset. Matching durations, clean decoding and correct transcripts prove none of these.

---

## Producer audit (`audit-2026-10-27/AUDIT.md`): agreement, disagreement, new evidence

**Agree**
- All four rejected; keep stills and recordings; rebuild the edit and animation.
- The entrance-and-hold diagnosis. My density measure (LVO 19% vs reference 78%) corroborates their 52–54% held-frame figure.
- The 200-tile to 100-dot denominator break; the replayed Airbnb arrow; the `f % 180` loop (I saw the loops, they found the code).
- Publisher anchor and channel identity absent; type hierarchy flattened; sidecar captions are not visible captions.
- One phone motif cannot carry three different actions.
- A new generator will not fix a weak assembly.

**Disagree or sharpen**
- *Lip sync "unresolved".* One instance is now resolved: SC 0:06.53–0:08.33 is about 1.05 s off. It is the first time Krish's face appears, which is exactly where a viewer would notice. The rest of the camera material I measured is in sync. So the failure is local and mechanical (an insert clock), not a general drift. *(The likelier mechanism is the reused v8 picture: see the correction note at the end.)*
- *"Correct tokens, incomplete identity".* That understates it. The audit did not fetch the brand book, and the book adds four failures: every number must name its producer; mind.the.gap ends in a dated call, and the approved 31 Dec 2026 / 90% call is missing from every cut; motion should be "slide, drop, slap"; photography has a felt-robot rule that needs a video ruling.
- *Factual meaning.* The audit misses the 1:20 "2.7% GAP" bar switch (release-blocking), "35%" vs spoken "a third", and Claude shown under "a Chinese AI".
- *Tools.* I agree the performance edit and the sound belong in an NLE with linked picture and sound. I disagree that Fusion should be the graphics engine. See H.

**New evidence not in the audit**
- The music stop at 0:34 and about 70 sub −50 dBFS gaps, traced to "episode" mode.
- Camera-cut peaks above the approved −1.0 dBTP.
- The stray diagonal line (SVO 0:42, SC 0:33); the dead frames (SVO 0:24.65, SC 0:20.5).
- The unpunctuated SRTs and "China's reply".
- The missing Musk attribution.
- The Chesky portrait is Airbnb's press headshot, not generated (`fetch_full_assets.py`). That resolves a concern I raised before reading the sources.

---

## G. Preserve or rebuild

**Preserve**
- The long VO read (the strongest asset; needs room tone and bed) and the approved short VO audio.
- The original camera recordings (`work/recordings/...90-second...`, `...5-minute...`). Within SC, 0:46.2–1:16.5 is in sync and holds the call and advice. Within LC, the three on-camera passages are in sync, minus the slips listed in C.
- The DeepSeek evidence recordings (`camera-deletion-real.mp4`, `xinxiang.mp4`, `turkmenistan.mp4`) and the test answers.
- The accepted stills: the passports (Canada/USA, China/USA, Taiwan/Singapore, blank), phone-in-hand, server rack, cotton and sweater, bank interior, laptop teardown. Use them as establishing plates inside the brand system, labelled as illustration.
- The licensed Chesky and Musk photographs (add the Musk credit) and the licensed music track.
- Sequence ideas worth keeping: LVO 3:34–3:57 (same prompt, response table); 4:16–4:21 (Taiwan/Singapore draw); 4:44–4:59 (TARIFF / MY VIEW stickers); SVO 1:03.6–1:09 (circle LIVES on "data", BORN on "what it tells you").

**Rebuild**
- Every timeline; captions (burned in plus SRT); the identity layer (sting, mark tile, pill, call card, ending band).
- All data graphics (2.7%, 200/35/63/100, Stanford, Lindy units); the deletion-evidence beat; the LC layout and the SC split.
- The mix (continuous bed, room tone, −1 dBTP).

**Retire**
- The SC 0:06.5 insert as built, the title card, the looping arrows, the white system-font boxes, and the cropped article screenshot.

---

## H. Production treatment: one 19.5 s sequence

**Sequence:** "my test", from the long VO read at 225.80–245.3 s. Local time is source minus 225.80; cue words come from the locked VO's word timings.

> "Now, America has blocked cotton from both over forced labour. So, a good answer should flag it both times. Claude and ChatGPT flagged forced labour both times, and so did DeepSeek for Turkmenistan. Now watch DeepSeek on Xinjiang. It writes a full answer, deletes it and changes the subject, every single time."

**Carried in from the previous beat:**
- An ink canvas with 7% grain.
- The mark tile top left, with a 10 px coral hard shadow, and the "mind.the.gap" pill (Plex Mono, ink on coral) beside it.
- A 2-column × 3-row test grid. Columns are XINJIANG and TURKMENISTAN, each with its flag, in Plex Mono. Rows are Claude, ChatGPT and DeepSeek marks.
- Six empty cream cards: square corners, 2 px ink border, hard shadow.
- Above the grid, a mono strip: "SAME WORK PROMPT · ONLY THE COUNTRY CHANGES · KRISH'S TEST, 23 OCT".

| Local s (cue word) | Visual event | What stays on screen |
|---|---|---|
| 1.02–1.90 ("blocked" ... "both") | Two cream mono tags drop under the column heads together: "US BAN · JUN 2022", "US BAN · MAY 2023" (8 frames, drop) | Grid, tags |
| 5.12 ("flag") | A dotted ghost tick appears in all six cells: the answer key, shown before the results | Ghost ticks |
| 7.02 ("Claude") | Claude row slaps in: each cell shows a verbatim excerpt of its answer in Archivo, "forced labour" on a mint swipe, and a solid mint tick replaces the ghost (5-frame slap, 4-frame stagger) | Claude results |
| 7.74 ("ChatGPT") | ChatGPT row does the same | Two rows filled |
| 11.00–11.58 ("DeepSeek for Turkmenistan") | DeepSeek × Turkmenistan cell fills and ticks. Five of six cells are now ticked; the empty cell becomes the question | Five ticks, one ghost |
| 13.0 ("watch") | The other five cells dim to 35% and stay readable; the empty cell grows into a DeepSeek chat card filling about 80% of the width (12 frames, ease out) | Dimmed grid behind |
| 14.22 ("Xinjiang") | The prompt line types in: the verbatim test prompt, in mono | Prompt |
| 15.06–15.66 ("writes ... answer") | The real 23 Oct screen recording plays inside the card at 2× with a label "SCREEN RECORDING · 23 OCT · 2×". "Key risks: UK Modern Slavery Act ..." accumulates. If the capture is not legible at this size, use an exact typed replica with the recording as a thumbnail chip | Written answer |
| 16.38 ("deletes") | The written lines strike through and collapse upward (6 frames), leaving a dashed outline where the answer was | Ghost of the deleted answer |
| 17.74 ("changes the subject") | "Sorry, that's beyond my current scope." types in from the recording | Refusal under the ghost |
| 18.70–19.5 ("every single time") | The card shrinks back into its cell. The cell reads "ANSWER DELETED" in hollow mono (not REAL/THEATRE, which belong to under.the.hood). A "RUNS" chip drops in and three pips fill on "every / single / time" | Final grid: 5 ticks, 1 deleted answer, 3/3. The same grid is reused for Taiwan/Singapore with new column heads |

**Speech and captions**
- Every state change starts within ±2 frames of its cue word's onset.
- Captions sit in the lower safe zone (y 1440–1680 at 1080×1920): cream Archivo 900 at width 112 on an ink block with grain and a 12 px coral shadow, sentence case, 2 to 5 words per page, one mint-swiped word per page ("both", "flagged", "deletes").
- Captions carry what is said. The grid carries entities and evidence and never repeats the caption.

**Brand**
- Mark tile and pill persist.
- Plex Mono for labels and provenance; Archivo for quoted answers; Anton only for the "3/3".
- Mint only for "the answer" (ticks, swipes); coral only for channel identity.
- Grain behind everything, never over marks.
- Motion uses slide, drop and slap only.

**Sound**
- The long VO with room tone filling every gap.
- The licensed bed continuous at the approved −31 LUFS bed level, ducked under speech.
- A soft card slap at about −30 dBFS on each tick, a dry reverse swipe at about −28 dBFS on "deletes", and a 3 dB bed dip for 300 ms before "every single time".
- −14 LUFS integrated; true-peak limit at −1 dBTP after the encode.

**Exact animation vs generated footage**
- Everything in this sequence is exact: marks, flags, quotes, the recording, the counters. No generated footage.
- Generated motion (Runway or Higgsfield) is useful only for establishing plates elsewhere, such as a slow push across the cotton plate or a passport page turn, labelled as illustration. Never for UI, text, numbers or Krish's mouth.

**Tools, and why**
- **Remotion for the graphics layer.** It is already the Studio's renderer, with the makeyourmindup fonts, tokens and hash-pinned marks. The requested quality is flat, data-exact, word-timed motion graphics, which is code-shaped work.
- Build components once (MarkTile, ChannelPill, CaptionBlock, TestGrid, PassportLedger, EvidenceCard, QueryChip, CallCard, EndingBand), each with independent 9:16 and 16:9 layouts.
- Drive every cue from one JSON cue sheet: word → frame, from forced alignment of the locked audio.
- **An NLE with linked picture and sound (Resolve, or Premiere) for the camera performance edit and the mix.** Export its edit decision list and mixed stems. Remotion takes the same edit list as its clock, or renders alpha overlays per scene for the NLE to composite. Either way there is one clock, and picture is never retimed apart from its audio.
- This is where I differ from the audit's "Fusion for graphics". Fusion is node-based GUI work that an agent cannot operate unattended. It would also rebuild, by hand, a component system the repository already half-has.
- If Krish hires a human motion designer instead, After Effects with templates is the conventional equivalent. The tool was not the cause. The method was: a state-change storyboard per spoken beat, persistent objects, and one 15–20 s sequence proven before scaling to four edits.

**Extending to the four formats**
- **One beat sheet per piece** listing, for each spoken beat, the object, the change, the cue word and the caption page.
- **SVO (9:16):** the component system full frame over the approved short VO. The passport ledger is the throughline: BORN stays fixed and LIVES is restamped (Airbnb/Qwen, DeepSeek app, HSBC/Mistral, US-hosted DeepSeek).
- **SC (9:16):**
  - Krish full frame for the hook and for the call and advice (sync-checked insert by insert).
  - Graphics full frame for evidence beats.
  - If a split is used, its lower half carries the live grid, never a still.
- **LVO (16:9):** the same components in their 16:9 layouts, with the extra cases as new ledger stamps and the data graphics rebuilt with units and named producers. The dated call card goes before the advice; the ending band goes on the spoken URL.
- **LC (16:9):** no permanent pillar.
  - Evidence beats use full-frame graphics.
  - When Krish speaks, use a designed 9:16 card on ink (mark tile, "Krish Raja" label) with the live graphic or caption beside it.
  - Remove the ad-lib slips by cutting on phrase boundaries under graphic cover.
  - Shoot horizontally next time.

---

## I. Unresolved questions (only what the evidence cannot settle)

1. **Photography rule for video.** The brand book makes the felt robot "the only subject". The accepted Friday stills are generated scenes and press photos. Does the robot rule bind video, or only the site and cover?
2. **Captions.** The signed storyboard (`locked/CODEX.md:103`) says no captions in the picture. STUDIO specifies branded captions. The producer reports that your latest correction requires captions, but I have not seen your words. Should burned-in captions be confirmed for all four? (My recommendation is yes.)
3. **Who executes the rebuild:** an agent alone, or a human editor or motion designer with the agent preparing assets and cue sheets? This decides whether Remotion-first or an NLE-first route is realistic.

---

## Filing and correction note (added 27 Oct when filed)

Filed in the repository from the reviewer's scratchpad. `01-independent-findings.md` sits beside it as `INDEPENDENT-FINDINGS-BLIND.md`. Neither is otherwise changed: this note and three short italic pointers to it (end of the blindness paragraph, F, and the producer-audit comparison) are the only additions, and every line above keeps its original line number, so `IR:NN` references elsewhere still hold. Every suggestion here is numbered and given a disposition in `SUGGESTION-LOG.md`. Questions 1 and 2 in I were answered by Krish on 27 Oct (see that log).

**Correction: the likelier cause of the 0:06.5 lip-sync offset.** The offset at SC 0:06.53–0:08.33 is real: the picture is about 1.05 s later than the sound, measured at six points (F, item 1). The suspected cause given in F is the weaker one. The code shows a likelier cause. `compose_shipping_candidates.py` (in the Codex task folder `work/`) builds the v10 short camera by taking the v8 export's picture unchanged (`-c:v copy`, line 33) and muxing it onto a new mix. That mix's audio edit was re-cut in five places: six spans, 15.34 s removed. So the v10 picture was never rendered from the edit it plays against. The `startFrom` on line 15 of `EditorialCameraShort.tsx` (`round(beat.start*30)-3`) only accounts for a 0.5 s lead in S01, per the code read for the `ve` plan.

Still not proven: all five cuts fall after this insert (the first is at source 27.64 s), so exactly how v8's picture came to sit 1.05 s late at 0:06.5 has not been reconstructed. The cure is the same either way: one edit list drives picture, dialogue, bed and captions in one render, with no mux path (`ve` QC row "Lip-sync, picture muxed onto re-cut audio", R04 and F10).
