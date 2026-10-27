# Independent findings, saved before reading any producer audit

Saved 2026-10-27 ~06:20 local. Status at save: no producer audit, score, root-cause note or fix list has been opened. Only the four exports, the reference, the makeyourmindup brand book/kit v1.5, docs/STUDIO.md and config/studio.json have been read. The only file opened inside the producer's Codex folder is the cached Whisper model weights (work/audio-qa/models/...), used read-only for local transcription. STUDIO.md does contain process history (Krish's rejection of the v1 Studio look, the INTRO_STING and MUSIC_BED rules); that was read as brand evidence because it was supplied as such.

## Method actually used

- Decoding: ffmpeg 9.0.2. Picture: contact sheets at 1 fps (shorts, reference) and 0.5 fps (longs), plus 2-30 fps strips on problem sections. Every second of the shorts and reference, every second second of the longs, was looked at; nothing was watched in real-time playback.
- Audio: not heard. Measured: EBU R128 loudness, sample peaks, 100 ms and 10 ms RMS envelopes, mid/side split (stereo side energy used as a proxy for a stereo music bed), near-silence runs. Local Whisper large-v3-turbo transcription with word timestamps (no API).
- Lip sync: 30 fps mouth-region filmstrips with the 10 ms audio envelope drawn under each frame; closures/openings compared with energy dips/onsets. Precision about +/-1 frame (33 ms) where a clear closure exists, worse elsewhere.

## Reference (Drive file, 720x1280, 125.4 s, mono, -14.4 LUFS)

- One continuous canvas. scdet finds no hard cuts after 2.3 s. Every change is a morph of an object already on screen.
- On-screen text is the narration itself, revealed word by word within ~0.3 s of the spoken word; the key word turns accent orange as it is spoken (e.g. "Yes. Git." 2.18/2.84 s; "Every. Single. Day." 21.8/22.46/23.1 s).
- Quantities animate to the spoken value: counter 0 -> 2,345 -> 2,500 while "2,500" is spoken (16.6-17.0 s); "IN MAY" label morphs to "BY SEPTEMBER", counter runs 2,500 -> 30,000 while the existing 25 black dots stay as the baseline and coral dots are appended (19.0-22.7 s). Legend "● = 100 changes" stays on screen: the denominator is always visible.
- Recurring objects carry the argument: funnel fills and clogs (bottleneck, 9-14 s); gauge needle swings to Ridiculous (27-28 s); server stack grows (29-32 s); test-run counter ticks (33-37 s); git tiles multiply (38-41 s); seven people + five month boxes (42-46 s); metric cards each with a mini visual (49-59 s); Claude block vs overflowing infra bin (60-73 s); stack != trusted doc (74-77 s); checklist ticks then a hand presses Merged (78-83 s).
- Evidence handling is shown, not just said: "NOT DISCLOSED" stamp over the AI share (84-89 s); people/AI slider with "?" knob; "Scion isn't a general replacement" greys out eight git tiles around one Scion tile; the quote "AI broke Git everywhere" is struck through (94-96 s).
- Ending: binary choice cards "or" + "Tell us which side" (115-125 s).
- Single brand system throughout (Sanctity mark top right on every frame, one sans family, cream page, ink, one accent, flat shapes with hard offset shadow). No presenter, no captions: the kinetic type is the caption.
- Audio: mono (side = 0), integrated -14.4 LUFS, LRA 3.7, pauses drop below -50 dBFS at section breaks (no evidence of a continuous bed).

## Brand evidence

- makeyourmindup brand book/kit v1.5 (5 Oct 2026): ink #0C1512 page; cream reading colour; mint = brand/answer/primary action; coral #FF6A4D = mind.the.gap, Fridays, nothing else; Anton uppercase headlines; Fraunces italic dek; Archivo body/heavy; IBM Plex Mono labels; grain 7% on dark, halftone on colour; stickers tilt -8..+5, type and logos never; logo only on ink, untouched; motion "slide, drop, slap. Nothing moves for its own sake"; voice: no em dashes, no exclamation marks, British spelling, "Every number names whoever produced it", "Misses go up as big as hits". mind.the.gap device: "Threads on a time axis that bend and meet, ending in a dated call." Photography: the felt robot is "The only subject".
- STUDIO.md (house style v2, candidate): mark on ink tile with 10 px channel-colour hard shadow top-left on every beat; captions on ink block with grain, cream Archivo 900 w112, 12 px channel-colour shadow, one loud word on mint swipe; channel sticker on beat 2; call card with statement, due date and confidence; ending band with ticker, stacked logo, day, section pill, makeyourmindup.ai. Quick-edit rules from 2026-10-12: 1-2 s animated makeyourmindup intro before the face (INTRO_STING) and licensed music under the video (MUSIC_BED). "Generated imagery is illustration only and must say so." "Synthetic speech is prohibited."
- config/studio.json: default_brand_theme is still "mindmake-video-v1" (active; ink #0A100D, mint #7FE3B4, amber, Newsreader/Source Serif). "makeyourmindup-video-v1" v2 is status "candidate" with no approval; its colours carry an odd "amber": "#F4EFE4" and rules "amber_means_changed"/"serif_for_claims_only" inherited from Mindmake. mind_the_gap sticker "The headliner", promise "Every call scored in public" (not in the brand book).
- Conflicts to report: (1) default theme is the retired Mindmake look while the piece belongs to makeyourmindup/mind.the.gap; (2) the makeyourmindup theme is unapproved, so no source is authoritative for video application beyond the brand book; (3) STUDIO's "nothing at the opening" placement vs the later INTRO_STING request; (4) brand book says the felt robot is the only photographic subject, while the exports use generated stock-style photography.

## Observations common to all four exports

- No captions anywhere in any of the four files (checked every sampled frame). On-screen text is only labels.
- No makeyourmindup mark during the body of any cut; no section pill, no "Fridays", no mind.the.gap identity anywhere; coral appears only as a salmon ring/dots for "problem responses" (data), never as the channel colour. Identity appears once: horizontal logo + makeyourmindup.ai on ink in the last 3 s.
- Opening: static cream card "WHY EVERY COUNTRY WANTS ITS OWN AI" (Anton, ink on cream, small, upper-left) with five flags popping in; 3.5 s; no animated makeyourmindup intro.
- Ending: cream card "WHICH PASSPORTS DOES YOUR AI HOLD?" + flags (~6 s) then logo card (~3 s), both after the last spoken word; the spoken URL is heard over the question card, not the logo card.
- Visual vocabulary is a set of generated photographs (hand + phone with chat UI and app header, server rack, passports with ribbon, cotton boll + sweater label, bank facade with server room, disassembled laptop) with mint arrows, mint underlines, flag icons and app logos composited on top. Motion is mostly: arrow draws, label fades, header swaps. Many graphics loop (arrow re-draws) while held.
- Real people: "BRIAN CHESKY / AIRBNB" over a photoreal studio portrait (short and long cuts); "ELON MUSK" over a photoreal suit portrait (long cuts). No credit or "illustration" label on either. Provenance unknown at this stage; if generated, it is a fabricated likeness of a named real person.

## Short voiceover (v7, 1080x1920, 84.9 s, -14.6 LUFS)

Transcript (Whisper) in order: "You may already be using a Chinese AI. Does that matter? Airbnb's boss said its own customer service leans on Qwen, which is a Chinese AI. He called it fast and cheap, which is what most of us want from a holiday fling. See, every AI has two passports: where it was born and where it lives. Where it was born shapes its answers. An American newspaper recently asked Chinese chatbots some news questions, and a third of the time they refused, gave China's line, or got it wrong. Claude, an American AI, answered them all. Where it lives decides who sees your data. Use DeepSeek, another Chinese AI, and it keeps yours in China. And at work, I asked Claude, ChatGPT and DeepSeek about a supplier's cotton from Xinjiang in China. Two flagged forced labour. Now watch DeepSeek. It writes an answer, then deletes it. Every time. My call is it's fine if you don't mind where your data goes, but check what it tells you. And here's what I do with this information if I were you. Ask software suppliers which AI they use and where it lives, and keep a second AI ready. The full deep dive is at makeyourmindup.ai."

Timestamped observations:
- 0:00-0:03.5 title card, no speech, music. No intro sting, no logo.
- 0:04-0:09.6 phone header cycles DeepSeek (4.0) -> Qwen (5.0) -> Claude (6.25) -> ChatGPT (~8.0); arrow to mint "?". "a Chinese AI" is spoken at 6.06-6.42; the header switches to Claude at 6.25 and holds through "Does that matter?" (6.8-7.8). Visual pairs Claude with "Chinese AI".
- 0:08.3-0:09.4 speech energy drops to bed level (-35 to -51 dBFS) for ~1.0 s inside the phrase "Airbnb's ... boss"; "boss" re-enters with a 36 dB jump in 100 ms. Unnatural mid-phrase pause; cause unknown (join or delivery).
- 0:09.6-0:19.8 one static portrait labelled BRIAN CHESKY / AIRBNB; arrow to Qwen draws at ~11 s; then ~7 s with nothing changing over "fast and cheap ... holiday fling. See,".
- 0:19.8-0:24.7 passports Canada/USA ("AI · EXAMPLE"). "BORN" label appears ~0:21 and "LIVES" ~0:22, each 1.5-2 s before the words (22.76, 23.92).
- 0:24.65-0:25.65 ~1 s empty server background while "born shapes its answers" is spoken.
- 0:25.7-0:30.5 DeepSeek/Kimi/Qwen/GLM logos, mint arc, "200 QUERIES" (mint Anton): 200 is never spoken; newspaper never named on screen or in speech.
- 0:31-0:36.6 "35% PROBLEM RESPONSES" ring. Speech says "a third". 35% vs "a third" mismatch; "problem" undefined; no producer named. Brand: "Every number names whoever produced it."
- 0:36.7-0:40.5 phone Claude + "BORN [US flag] USA" during "Claude, an American AI, answered them all". Sync fine.
- 0:41-0:48 phone DeepSeek over server; 0:42.0-0:44.5 a straight mint diagonal line sweeps corner to corner across hand and phone, unrelated to anything (stray path); 0:45-0:47 arrow + message chip to "HOSTED SERVICE"; "CHINA" + flag at 0:48 just after "China" (47.68).
- 0:49-0:57.9 "MY TEST" Claude/ChatGPT/DeepSeek tiles over cotton/sweater; "XINJIANG" at 0:54 on the word; 0:55.95-0:56.2 Claude tile goes translucent over the cotton boll, ChatGPT dims, DeepSeek disappears; one arrow (from Claude) + warning triangle while "Two flagged forced labour" (55.6-56.9): two flagged, one shown.
- 0:58-1:03.5 "24 OCT · RECORDING" + white system-font box typing "Key risks: UK Modern Slavery Act" (text touching the left edge, no padding) -> "Sorry, that's beyond my current scope." (~1:02, ~1.2 s after "deletes it" 60.8); "23 OCT 3/3 RUNS" big mint; "4x REPLAY". Two dates and "4x replay" unexplained; the write-then-delete is shown as two static states, not as a deletion.
- 1:03.6-1:09 passports return; mint circle on USA during "where your data goes", on CANADA during "check what it tells you". Coherent device.
- "My call" (63.5-68.2) is advice, not a dated call with confidence. mind.the.gap's device and STUDIO's call card require a date and a percentage.
- 1:09.2-1:15.9 phone Claude, "?", arc; ChatGPT phone slides in at 1:14 with arrow ~ "keep a second AI ready" (74.5-75.4). Fine.
- 1:15.9-1:21.9 question card; URL spoken 76.9-77.7 over it. 1:21.9-1:24.9 logo card in silence of speech.
- Audio: continuous stereo bed 1.7-69.3 s and 73.7-84.9 s, dipping 69-74 s. First word "You" has a hard onset (~50 dB rise in 30 ms after 150 ms near-silence at 4.3-4.5 s, Whisper confidence 0.03): suspected clipped first word. Integrated -14.6 LUFS, peak -1.3 dBFS, no clipping.

## Short camera (v10, 1080x1920, 86.4 s, -14.0 LUFS)

Separate take from the VO cut (wording differs: "what I want from my Airbnb", "My call is that it depends ... Sometimes the latter supersedes the former ... you are absolutely fine to use a Chinese AI for sure, but just check what it tells you").
- 0:00-0:46 is the same graphics sequence as the VO cut, retimed, with Krish's own speech as narration; Krish appears only 0:06.5-0:08.3 in a split (selfie top, two phones bottom).
- 0:07.1-0:07.6: "does that matter" is heard at full speech level while the visible mouth is closed or fixed in a grin; articulation only appears after 0:07.7. Lip-sync failure on Krish's first appearance (~0.5 s of audible speech with a closed mouth). Cause not determinable (different take or offset).
- 0:21 dead frame repeat of the VO's empty-background gap (0:20.5-0:21.5).
- 0:41-0:42 Claude tile fades in translucent over the cotton boll (muddy overlap).
- 0:44-0:45.9 the recording beat is re-designed vs the VO cut: no DeepSeek logo, small Archivo labels, "23 OCT · 3/3 RUNS" small. Same idea, different typography between the two shorts.
- 0:46.2-1:16.5 split screen: walking handheld selfie (hood up, low angle, overcast sky blown to white) in the top ~58%; bottom panel a static passports image (0:46-1:03, ~17 s, no change except a faint underline) then two phones with an arrow redrawing on loop (1:04-1:15). Framing varies second to second: forehead or chin cut, face at frame edge (0:52), face small at bottom-left (1:00). Jump cuts in the selfie at 59.8-60.0 (4-frame transition), 64.43, 71.10.
- Lip sync in the on-camera section: aligned within ~1 frame at 46.7 s ("My" onset), 62.63 s ("but" closure); within ~1-2 frames across the 64.43 jump cut and at 74.8 s ("option"). No measurable drift.
- Speech issues present in the take itself: "it keep all your data" (36.06; possibly a clipped "s"), "if it ... you don't mind" restart (58.3), "here's what I do with this information if I were you" (also in VO cut: a verbal slip, not a splice).
- 1:16.5-1:23.4 question card; 1:23.4-1:26.4 logo card. Whisper hears a low-confidence "You" at 84.06 under the logo card; energy there could be the music. Unresolved.
- Audio: continuous stereo bed except a dip 70.4-73.7 s. First word hard onset as in VO (-57 -> -5 dBFS in 30 ms). Sample peak -0.53 dBFS (above a -1 dBTP target, no clipping).

## Long voiceover (v10, 1920x1080, 330.9 s, -15.1 LUFS) visual

- 0:00-0:03.5 cream title + flags. 0:04-0:19 grid of six passport cards (Claude/ChatGPT USA, DeepSeek China, Mistral France, K2 Think UAE, an illegible Indian model logo), ~16 s with little motion; 0:12 cross-dissolve through a blank passport (rebuilds the same grid).
- 0:20-0:37 Brian Chesky portrait left third; Airbnb logo -> arrow -> tiny Qwen logo; "LIVES: NOT STATED"; ~18 s; arrow redraws at 0:32. Most of the frame empty.
- 0:38-0:51 Cursor-style cube logo -> arrow -> KIMI + China flag (~14 s, no source label).
- 0:52-1:07 "LINDY · REPORTED COST COMPARISON": Claude bar vs DeepSeek bar shrinking to ~1/10, "10x". Unit undefined (cost of what).
- 1:08-1:20 "NOTABLE AI MODELS · 2025": US 59 vs China 35 (bar ratio 0.6, proportional); producer of the count not named.
- 1:20-1:31 the same two bars lose their numbers and grow nearly equal: "2.7% GAP". The bars now encode a different, unlabelled metric; the "notable models" caption disappears. A viewer reads the same bars as the same quantity. Misleading.
- 1:32-1:46 six country flags (UK, France, UAE, Saudi Arabia, India, South Korea) with mint underlines over dim passports; 1:40 the grid empties and rebuilds (discontinuity).
- 1:48-1:59 South Korea flag "NAVER CLOUD" -> arrow -> tiny Qwen + China flag; arrow loops.
- 2:00-2:09 passports Canada/USA again.
- 2:10-2:17 grey-overlaid screenshot of an article (body text cropped mid-word both sides; outlet not visible) with a 20x10 grid of squares "200 QUESTIONS".
- 2:18-2:23 four logos "35% PROBLEM RESPONSES" on a 10x10 dot grid (35 coral). 2:24-2:27 DeepSeek 63%. 2:28-2:33 Claude "100% ANSWERED" all mint. Unit changes from 200 squares to a 100-dot grid with no legend; "problem responses" vs "answered" are different measures presented as opposites.
- 2:34-2:43 phone, "GROK 4" + US flag, arrow to an Elon Musk portrait.
- 2:44-2:49 passports; 2:50-2:55 phone -> arrow -> "HOSTED SERVICE" China flag server.
- 2:56-3:05 HSBC logo over a generated bank facade with server hall; arrow loops to Mistral + France flag; "ILLUSTRATION" label top-left.
- 3:06-3:09 passport "BORN CHINA" with DeepSeek logo / "LIVES USA". 3:10-3:15 "SELF-HOSTED · ILLUSTRATION" DeepSeek on US server, mint circle. 3:16-3:19 passport again; at 3:18 the DeepSeek logo and flag overlap the "CHINA" word.
- 3:20-3:33 cotton/sweater, three logos, Xinjiang (China flag) and Turkmenistan flags with tiny labels; ~12 s static.
- 3:34-3:37 "SAME PROMPT": "from Xinjiang." vs "from Turkmenistan." with a mint wipe line.
- 3:38-3:51 XINJIANG then TURKMENISTAN underlined, then both with "US BAN · JUNE 2022 / MAY 2023" in type too small to read on a phone.
- 3:52-3:57 response table: Xinjiang Claude "forced labour," ChatGPT "forced labour" DeepSeek "Sorry,"; Turkmenistan all three "forced labour". The clearest explanatory beat in the four files.
- 3:58-4:03 two white boxes, text tiny and left-clipped ("Key risks: UK Modern Slavery Act" / "forced labour"; then "Sorry, that's beyond my current scope."), "24 OCT · RECORDING" overprinted at the very top edge.
- 4:04 "23 OCT 3/3 RUNS". 4:06-4:15 Taiwan/Singapore passports (~9 s static). 4:16-4:21 response table Taiwan/Singapore. 4:22-4:27 the "Key risks" box a third time ("XINJIANG · 4x REPLAY"). 4:28-4:37 BORN CHINA / LIVES USA passport again. 4:38-4:43 the Lindy 10x chart again.
- 4:44-4:59 "ILLUSTRATIVE EXAMPLE" disassembled laptop with US/China/Korea flags; mint "TARIFF" then "MY VIEW" stickers (on-brand device, but they fade rather than slap).
- 5:00-5:19 two phones Claude (US) <-> Mistral (France) with two arrows looping ~19 s.
- 5:20-5:27 question card; 5:28-5:31 logo card.
- Reuse: the passports appear 6 times, the Key-risks box 3 times, the Lindy chart twice; many holds of 9-19 s.
- Audio (measured): stereo bed only 0-33.8 s and 315.9-330.9 s; it stops within ~0.3 s at 34.0 s (side level -55 -> -180 dB). Between 34 s and 315 s there is no bed and ~70 runs where the whole mix falls below -50 dBFS for 0.3-1.4 s (longest 81.9-83.2, 107.8-109.2, 247.4-248.8). Integrated -15.1 LUFS, peak -1.7 dBFS.

## Long camera (v11, 1920x1080, 330.5 s, -14.0 LUFS) visual

- Same graphics as long VO, retimed. Krish appears in a left pillar (~600 px of 1920 wide: a vertical selfie cropped into 16:9) at 0:08-0:17, 3:02-3:15 and 4:10-5:19; the right ~70% shows the 16:9 graphic shrunk with dark bands above and below (so all graphic labels get smaller still).
- Face frequently cut by the frame's left edge (0:08, 0:16, 4:16, 4:20, 4:22); framing changes every second.
- Lip sync sampled at 8.9-9.3 s, 185.5-186.2 s, 250.1-250.6 s, 304.9-305.2 s: closures/openings align with energy dips/onsets within ~1-2 frames where measurable; 250.1-251.0 s Krish on screen with dead digital silence after the cut.
- Audio: stereo bed 0-34.0 s and 314.2-330.4 s only; ~50 near-silent runs in between. Sample peak -0.79 dBFS.

## Provisional verdicts (before transcript review of the long cuts)

- Short voiceover: substantial rebuild of the edit and motion; keep stills and the strongest beats.
- Short camera: substantial rebuild; the on-camera take is usable audio, picture usability limited.
- Long voiceover: substantial rebuild; also a structural edit (reuse, holds) and data-graphic accuracy.
- Long camera: substantial rebuild; layout fails in 16:9 because the source is vertical selfie footage.

## Addendum saved 06:28, still before any producer audit: long-cut transcripts and measurements

Long voiceover (Whisper): a clean read of a strong script. Topic order maps to picture correctly at section level: Airbnb/Qwen (21-37 s), Cursor/Kimi (37-51 s), Lindy/DeepSeek 10x (52-67 s), Stanford 59 vs 35 and "about three percent" (72-89 s), sovereign AI flags (93-110 s), Naver/Alibaba (110-117 s), two passports (117-130 s), newspaper 200 questions / more than a third / DeepSeek nearly two in three / Claude every one (130-152 s), Grok checking Musk's posts (153-162 s), DeepSeek app stores in China (163-176 s), HSBC runs Mistral at home (176-186 s), US government ran DeepSeek locally and the talking points stayed (186-199 s), my test Xinjiang vs Turkmenistan (199-244 s), Taiwan vs Singapore draw (245-262 s), "DeepSeek knew the answer, it just wasn't allowed to let you keep it" (262-267 s), the call (268-298 s), the advice (299-321 s), URL (321-324 s). Picture/speech alignment at word level is good on the Xinjiang/Turkmenistan beats (3:38 Xinjiang, 3:44 Turkmenistan, 3:46 ban dates). Elsewhere visuals are topic illustrations held for the whole paragraph.
- The newspaper is never named in speech or on screen. Stanford is named in speech only; the on-screen label says "NOTABLE AI MODELS · 2025".
- "I reckon the same thing is going to happen with AI" is a prediction without a date or confidence. mind.the.gap's brand device ends in a dated call.
- The advice paragraph (299-321 s: three separate actions) is illustrated by one looping two-phone arrow for ~20 s.
- Sentence breaks fall to near digital silence (the ~70 measured runs below -50 dBFS); no bed after 34 s.

Long camera (Whisper): the same script ad-libbed on a walk. Kept in the cut: "China, China made 35" (~64 s), "Twitter, Twitter posts or X posts" (~137 s), "I suppose it's, that's one way" (~141 s), "So my call, which is a Chinese AI is absolutely fine" (~250 s, garbled syntax), "put to work, uh, your own team's, uh, AI ... uh, you know" (300-310 s). Low-confidence "Thank you." at 330.4 s on the logo card (probably a Whisper artefact on silence; unresolved). Krish is on camera for the personal beats (0:07.6-0:18.5 opening, 3:02-3:15 "I tried it myself", 4:10-5:19 call and advice): a sensible editorial choice; execution (pillar crop) is the problem.

Picture-change density (5 fps, 64x64 grey, share of seconds containing a frame-to-frame change > 1.0 mean level; handheld shake counts as change, so the camera cuts are flattered):
- Reference 78%, longest still run 3 s.
- Short voiceover 40%, longest 7-9 s (Chesky 0:10-0:19).
- Short camera 66%, longest 4-6 s.
- Long voiceover 19%, longest 20 s (5:00-5:20 two phones), 17 s (0:21-0:38 Chesky), 13-15 s (Lindy chart), 12 s (Cursor/Kimi; cotton 3:21-3:33).
- Long camera 44%, longest 13 s.

Typography note: short cuts use Plex-Mono-style labels ("ILLUSTRATION", "PROBLEM RESPONSES", "HOSTED SERVICE"); long cuts use a sans (Archivo-like) for the same jobs ("LIVES: NOT STATED", "24 OCT · RECORDING"). Fraunces italic (the brand's human line) is absent from all four.
