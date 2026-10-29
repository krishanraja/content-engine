# The bar: how every video should look, sound and feel

Krish, 29 October 2026, on how he wants taste held:

> "I hope you understand that I would much rather the engine know what kind of thing doesn't fly with me, rather than implement incredibly specific rules everywhere which came from feedback on one piece of content for one specific reason. We're still in the test-and-learn phase of what works and what doesn't, and finding our feet on all of this stuff but there are some clear floor nervos and some clear aspirationals to aim at"

So the bar has three layers, and this page keeps them apart:

- **The floor** is the eight nevers Krish confirmed on 29 October, each with his earlier words or the rule it rests on, and the gate that already holds it, or held at review where none does yet. These are the only refusals this bar adds; existing gates and the rejection floor's approved standards refuse as they do.
- **The aims** are what great looks like: the cuts he named, the brand book and his own words. Aim at them and compare against them; they are never a checklist, and no check refuses on them.
- **Under test** are choices he made for now. Each is the current default, recorded per piece on the making record and judged on real engagement. None is a refusal.

Everything else he has said about one piece is an example of the kind of thing that does not fly. It stays a dated example with his words, under "What does not fly" in each quality and in `config/rejection-floor.json`, and never becomes a new rule, gate or lint pattern.

Krish, 28 October 2026, his exact words on how every video should be made:

> "In general I think:
> - minimal random components and labels
> - good motion design
> - good animation
> - good visuals
>
> Keep it simple but keep it classy and on brand. I'd stick to the brand book for now."

Earlier the same day, naming the cuts:

> "the video production quality standards for the latest Friday (AI Passports) and Monday (character.ai) pieces are the floor for what I expect in terms of premium quality, motion design, cinematic feeling, movement, branding etc. Friday's is a voiceover format and Monday's a regular split screen format. Do not be intensely literal here as every piece is different, but I want you to get a feel for the standards we are never to fall beneath ever again"

And, correcting:

> "the long voiceover video is still being post produced so dont just assume that the voiceover format only has a 90sec version, you are only to look for production quality standards"

**Standing: draft.** The floor is his, confirmed on 29 October (ruling 12). The aims are the engine's reading of the cuts he named; he has not approved their wording except where it quotes him. Aim at them; only he approves them.

This page is about production quality only: finish, pictures, motion, branding, type, layout, colour, texture, transitions, captions and sound. It says nothing about how long a piece is, what shape it is or what a format must contain. `config/reference-cuts.json` holds the same three layers as data: it names each reference file exactly, says how its identity was confirmed, and lists the reference moments, each quality's comparison points, his words and his rulings. `python3 scripts/floor.py --format short_video` (or `long_video`) prints a short version of this page before the rejection standards; every other video maker gets a one-line pointer to it (AGENTS.md rule 20).

## The floor: what never ships

The only refusals this bar adds on taste; existing gates and the rejection floor's approved standards refuse as they do. Asked on 29 October "Is this the floor: the short list of clear nevers that are the only things the engine may hard-block?", with the engine's best guess, Krish picked: "Yes, that's the floor" (ruling 12). These are his eight, in his order: each in the words of the list he confirmed, then the question's own wording where it differs, his earlier words or the rule it rests on, and the gate that already holds it. Where no gate holds one yet, it is held at review: the separate reviewer who watches and listens to the finished asset checks it (AGENTS.md, start route, step 6). No other refusal, gate, lint pattern or required field is added from feedback on one piece.

1. **never names you or credits you as author.** Asked as: no content names you or credits you as author. Articles, their titles, subtitles and descriptions speak as "we", the publication, and the scripts he speaks keep "I"; his face is the only part of him that appears, in covers, thumbnails and video (Krish, 28 Oct: "Remember, no content refers to Krish, ever. I still see that popping up from time to time. Even articles written are not authored by Krish. My face only, for assets and the video format."). His four answers: on the article's voice, Krish picked: "We"; on his personal accounts, Krish picked: "No, personal stays personal" (his own posts may stay first person, but his name never appears in any post text); on the face beside the article byline, Krish picked: "Drop it"; on another person called Krish, Krish picked: "Yes, block it", with no override. Held by the copy lint's `no_name` pattern (`config/copy-lint.json`), on every public surface and the article body.
2. **nothing made up; numbers credited to their producer.** Asked as: nothing made up: every fact and number true and credited to whoever produced it. It rests on AGENTS.md ("Truth, rights, confidentiality, meaning preservation and canonical naming are hard gates.") and makeyourmindup's AGENTS.md ("No load-bearing number without a named producer. The producer is whoever made the number, never the outlet that repeated it."). Held by the fact gate (`scripts/engine.py`), which checks every number, quote and attribution against filed sources. Past it, crediting the producer is held at review: the vendored kill list only warns on a figure with no named producer nearby.
3. **your words never cut, changed or out of sync.** No word he said is cut, chopped or changed (Krish, 19 Oct: "my words randomly chop out, making the video incomprehensible"), and his picture and his voice stay in sync (Krish, 19 Oct: "in the deep cut, my facial movements start misaligning with the audio as the video progresses, which is unbearable by the end"). Held by the words gate (`scripts/quick-edit/words_gate.py`), the lip-sync gate (`scripts/quick-edit/sync_check.py`) and ve's joins and sync checks.
4. **no AI notes, eyebrows, asterisks, take/read tags.** Asked as: no filler labels: AI notes, eyebrow text, asterisks, "Krish's take" or "Krish's read" style tags. That is asterisks, eyebrow kickers such as BREAKING or JUST IN, a note that something was made by AI or is an illustration, or a label that tags something as Krish's (his read, his take, his test) (Krish, 28 Oct: "don't add stupid eyebrow text and asterisks and "generated by AI" and "Krish's take" verbal diahorrea like you tend to. This needs to feel like a world class media channel"), under ruling 2. A label that names a source, a date, a record or what is on screen is an aim, under quality 7. Held by the copy lint's patterns for asterisks, eyebrow kickers, AI-provenance and illustration notes and take labels (`config/copy-lint.json`).
5. **nothing posted/sent/spent without your yes; never Full Time or Heartside channels.** Asked as: nothing posted, sent or spent without your yes, and never the Full Time or Heartside channels. Nothing is published, scheduled, posted or sent without his press (Krish, 28 Oct: "Approve each day Monday"), and nothing is spent beyond what he approved (AGENTS.md: "Spend. Stay within approval; check `meter_daily`."). The channels part first came from Growth's plan of 28 October, W5; his confirmation makes it his. Held by the publish guard (`.claude/hooks/publish-guard.mjs`), which puts every send, post, publish and schedule to him; by ve, which has no publish verb; and by Growth's channel allowlist (`engine/buffer_channels.py` in `krishanraja/growth-makeyourmindup`), which denies the Full Time and Heartside channels. The cost guards hold a paid fact check to its budget and a daily ceiling (G2 and G3, `docs/COST_GUARDS.md`); any other spend is held at review.
6. **real logos and images with rights, never redrawn.** Asked as: real logos and images used with the rights, never redrawn. An outside logo is the company's own official mark, never redrawn or recoloured by us (Krish, 6 Oct: "Once again don't be afraid to use the real logos for any companies mentioned."), and no picture, clip, track or mark goes in that we have no right to use. It rests on AGENTS.md's hard gates and `docs/MEDIA_STANDARD.md` ("never invent or redraw a logo"). Held by the visual gate (`scripts/post-pack/visual_gate.py`, real logos from `config/logo-registry.json`), `docs/MEDIA_STANDARD.md` and the licensed music ledger (`config/music-library.json`).
7. **one opening, one close.** Asked as: one opening and one close, never two intros or several outros. Of the opening (Krish, 21 Oct: "why are there two separate intro sequences? that should NEVER happen."), and of the close (Krish, 28 Oct: "we also don't need three separate outro transitions and screens. Ever."). Held at review: no gate holds it yet. The rejection floor's draft standards for one opening and one close (`s9d6db813a0`, `sad5604ad3b` and `se67ed0142d` in `config/rejection-floor.json`) now match this never and wait on the Rejections route to record his approval. Which opening, under test: the hook is the intro (ruling 8).
8. **no em dashes, no preaching.** makeyourmindup's canon holds both: "No em dashes anywhere, including code, on-screen text and commit messages." and "No preaching. No closing moral, no lesson for leaders, no sentence telling the reader what to conclude, no final line reaching for significance, no sentence that would work on a conference slide." In Krish's words, as its AGENTS.md records them: "we should not sound preachy or like we are trying to persuade anyone of anything like a missionary in content. thought leadership should do that job." Held by makeyourmindup's kill list, vendored here (`vendor/makeyourmindup/kill-list/`, its `em_dash` and `preach_pattern` vetoes), and the voice check (`scripts/post-pack/voice_check.py`, house rule NO_EM_DASH).

## The aims: what great looks like

His words lead (Krish, 28 Oct): "minimal random components and labels", "good motion design", "good animation", "good visuals", and "Keep it simple but keep it classy and on brand. I'd stick to the brand book for now." And on pictures (Krish, 29 Oct: "They have to be additive in meaning. I'm all up for visually clear ideas.").

The list he confirmed on 29 October (ruling 12) names the aims the same way: "Fri 23 + Mon 26 cuts, brand book, minimal random components, good motion, animation and visuals, simple, classy, on brand".

The brand book is the reference for the look: `krishanraja/makeyourmindup`, `docs/brandbooknew/` (version 1.5), carried into this repository by `docs/STUDIO.md` and `config/ve/brand-tokens.json`, which own the palette, the type and the brand rules. Where this page names a colour, the brand book's value counts.

The cuts he named are three finished files: Friday 23 October's tall voiceover cut (AI Passports) and Monday 26 October's wide and tall split-screen cuts (Character.AI). His 28 October words call them the floor; on 29 October he set the frame, and they sit here as what great looks like, to reach and to compare against. The engine's reading of them at their best:

- Every frame looks designed and owned by the brand.
- Pictures and motion carry the argument and add meaning beyond the words.
- The world has light, focus, depth and material.
- The brand works as a system.
- Proof is real, dated and designed.
- The sound is finished.

Put each new moment beside a reference moment, in motion, at full size, with sound (never as stills, F03 in `config/failures.json`), and ask: would it sit beside that without looking cheaper, flatter, slower, busier or less owned? Do not copy the references: each piece finds its own objects, devices and big moments, and reaches the same craft with them. The references' own slips, listed under each quality and as SLIP moments, are not licence to repeat them. Friday's long voiceover cut is still in post-production, owned by another session; it is not a reference yet, and when it is finished Krish says whether it joins.

**How an aim is judged.** No check refuses on an aim. Gates that already measure part of one keep running as they do (ve composition QC, the change-density, longest-still and periodicity checks, `captions.ocr`, the loudness gate, `kit.py`'s legibility floor); nothing new is added. Then a Critic who did not make the cut watches the whole file at full size with sound, beside the Compare beside points, and names any shortfall and where it is. Krish's exact-file approval (`docs/ve/ENGINE.md`, S7 Gate 3) decides. F19 is why: a cut that passed all eleven mechanical checks still looked like a spreadsheet.

### Which files these are

`config/reference-cuts.json` keeps the evidence for each file (`identity`, `identity_evidence`), and every timestamp on this page points into the exact file its sha256 names. Asked whether these are the latest cuts he meant, Krish said (28 October): "I think so but I'm not sure. The ones I meant are in the publish board at content.krishraja.com for last Friday and Monday, just gone." The board was read that night (28 October 2026, 23:48 UTC, read only): each file is byte for byte the file its tab serves, and neither tab holds a newer cut. That confirms the bytes, not his approval of them.

- **Friday tall: confirmed.** Week 2026-10-19, the Friday 23 October tab, asset `fri-short-video`. It first reached Drive at 21:28:54 UTC on 28 October and the board at 21:35:59 UTC that day, so whether he had watched this file when he first named the floor is not established.
- **Monday wide: confirmed.** Week 2026-10-26, the Monday 26 October tab, asset `mon-video-long`, the same file as the 16:9 master in `docs/plans/2026-10-26-monday/video/REVIEW.md`.
- **Monday tall: confirmed.** Week 2026-10-26, the Monday 26 October tab, asset `mon-video-short`, the archive master, not the smaller share copy.

### Where it sits beside what is already here

- `docs/MEDIA_STANDARD.md` and `config/media-standard.json` are the production contract (the brief, the proof, the independent review, the signed receipt); this page is the level of finish that contract is reviewed against. The references are never production inputs, and they are not among that standard's exemplars; whether they become exemplars is Krish's decision.
- `config/rejection-floor.json` (read through `scripts/floor.py`) holds what Krish rejected, in his words, with dates: the examples of what does not fly. A standard there binds a check once he approves or rewords it; its drafts are the engine's reading.
- `config/ve/design-lock.json` holds the approved key frames for one ve format and one module (the two passports), matched by structural similarity. The reference cuts are never matched pixel for pixel.
- `config/style-references.json` is the bank of styles; every style in it has to reach these aims.

## The qualities

The aims, one by one: what great looks like, examples in the references, what does not fly (his dated words, and the references' own slips), and the moments to compare beside. Each is a description to aim at, never a checklist.

### 1. Premium finish: every frame looks made and owned

**What great looks like.** At full size every frame looks deliberately designed and belongs to the brand, as from a world-class media channel: never a default template, a slide, clipart, a widget, an outline icon or a test render, and no label that adds nothing to the content (Krish, 28 Oct: "It's just the ones that say "Krish's read" or "illustrative" that are stupid because they add no value to the content."). The finished file is clean: no glitch frames, blinks, ghosted doubles or stray hardware, and no soft media beside crisp graphics without a reason. In the references: Friday 00:02, where every piece of the phone plate is owned; four readable layers at Friday 00:54.4; the torn receipt at Monday tall 00:20; both end cards.

**What does not fly.** "These look like PowerPoint cliparts... These just look like cheap tacky emoji PDF infographics" (26 Oct, rd1f92c1e7f). "the visuals look like Microsoft Excel from 20 years ago" (F19). "that stupid box around character.ai? That's a horrible, tacky, unprofessional, low-quality visual" (28 Oct, rf670596592). "I hate all these stupid little abbreviations and marks" (the ILLUSTRATION tag and KRISH'S TEST stickers, removed under ruling 4). In the references themselves: ghosted doubles at Monday tall 00:42.9 and 01:17.9 and at Monday wide's act breaks, a face-on-face dissolve at Monday tall 01:21.35, a one-frame caption blink at Friday 01:02.07, a soft upscaled screen recording at Monday wide 00:24 to 00:27, and waxy fingers on Friday's plates (suspected).

**Compare beside.** Friday tall 00:02; Friday tall 00:54.4; Monday tall 00:20; Monday wide 00:44; Friday tall 01:15 to 01:18; Monday tall 01:21.7 to 01:25.7.

### 2. Pictures that explain: every part adds meaning

**What great looks like.** Every picture adds meaning beyond the words (Krish, 29 Oct: "They have to be additive in meaning. I'm all up for visually clear ideas."). A visually clear idea with the real facts on it is welcome, a comparison included, as the two passports carry CHINA and the real 35%. One look from the brand book and a small set of parts, each part carrying the message and none repeating the words spoken; the aim is fewer random parts, never fewer pictures. Things change state on the word that needs it: stamped, filled, moved from one owner to another, counted up, struck out, ringed. In the references: Friday has two worlds, the hand-held phone and the passports, and switches between them three times (00:16.40, 00:45.10, 01:00.10); the CHINA stamp at 00:22 and "? OUT OF 3" filling to 2 at 00:52.6. Monday tall's THE PEOPLE rides an arrow into Disney's empty slot at 00:43.9 while THE LAWSUITS stays behind. The passports return whenever a story is about where an AI lives.

**What does not fly.** A picture that adds nothing beyond the words, or stands in for the facts: the 16 October car race standing for an AI. "I do not want a voiceover, captions, and then visuals which are just words" (25 Oct, r41d447d5d3). "there is barely any motion design apart from ridiculous arrows animating incorrectly" (27 Oct, r70dce346e5). "still don't move enough. They don't catch the eye enough. There's not enough happening... just three arrow circles" (28 Oct, r95c7303330). F05: things enter and then hold, and a loop redraws with no cue. F06: numbers lose their meaning across transitions.

**Compare beside.** Friday tall 00:22 to 00:36; Monday tall 00:41 to 01:03.

### 3. Motion craft: weight, ease, stagger, exits

**What great looks like.** Every move has weight: things arrive fast and settle softly, with at most a small spring past the resting point. Builds are staggered in reading order, type arrives in time with speech, numbers count up and slow into their value, strokes draw on like a pen. Exits get as much care as entrances. Nothing moves for its own sake. In the references: the CHINA stamp slams in and settles at Friday 00:22.0, the marker loop draws on at 00:25.9, rows rise one after another at Monday tall 01:06, the receipt rises past its rest and settles at Monday wide 01:39.9, and the counter slows hard into 75% at Monday tall 01:02.7.

**What does not fly.** "ridiculous arrows animating incorrectly" (27 Oct, r70dce346e5). Annotations that restart with no cue (F05). In the references themselves: Monday wide's layout reflows move at one stiff constant speed (00:26.9, 00:49.6), and Friday's stickers vanish on a hard cut at 00:33.27.

**Compare beside.** Friday tall 00:22.0; Monday wide 01:39.9.

### 4. Cinematic feel: light, focus, depth, a living world

**What great looks like.** The picture is a lit world the camera moves through, never a flat slide deck. Grounds carry light; focus works like a lens, and on a source page everything blurs except the quoted words. Real plates have depth and gentle living motion, screen content sits in the device with the glass over it, and a long hold gets a slow push. For a reel he puts the level plainly: "I'm not expecting an Instagram reel to contain a full cinematic video. I'm expecting it to contain good motion design." (27 Oct, r33a4a44d56). In the references: the hand-held phone with cotton bolls soft behind at Friday 00:02 to 00:16, the stage with drifting light at Monday wide 00:34, the slow push on a document at Monday wide 01:28.

**What does not fly.** F01: schematic boxes. "There's no creative blend between real-world imagery, design, and aesthetic" (26 Oct, rd1f92c1e7f). "The imagery is all just generated visuals from subtitles, really, as opposed to real-world stuff" (28 Oct, r66145fce35). In Friday itself: the passport scenes are locked off between events, so their holds read as still graphics.

**Compare beside.** Friday tall 00:02 to 00:16; Monday wide 01:28 to 01:40.

### 5. Movement and pace: alive, and timed to meaning

**What great looks like.** The body of the piece is never dead: something new arrives on the beat of the sentence that needs it, and a hold exists only so a card can be read, still breathing with a drift or a slow push. There is one opening and one close. Under test, the hook is the intro (ruling 8), and the first picture after it is a motion-designed statement that grabs. There is no fixed count of big moments (Krish, 28 Oct: "Do not be intensely literal here as every piece is different"): each piece earns its own peaks, kept simple, classy and on brand, and proposed in the storyboard he signs. In the references: Friday's opening statement from 00:00.67, Monday tall's MILLIONS MADE FRIENDS HERE then BANKRUPT from 00:03.9, and Friday's OUR CALL card held to be read at 01:02.1.

**What does not fly.** "We've wasted one of the most important frames on such a boring visual treatment... This should be a motion-designed, headline-grabbing statement... provocative and visually intense" (28 Oct, rbbf0b955c4). "why are there two separate intro sequences? that should NEVER happen." (21 Oct, rf77645a51c). "we also don't need three separate outro transitions and screens. Ever." (28 Oct, r04686da8b0). In the references themselves: Friday opens on empty brand dark for its first frames, and Monday tall's story card stands still after it builds.

**Compare beside.** Monday tall 00:03.5 to 00:13.5.

### 6. Branding as a system

**What great looks like.** The brand runs through every frame as a system, never as a watermark: the house palette with fixed meanings, the house type voices, the house caption style and the series identity. The brand book places the marks (Krish, 28 Oct: "I'd stick to the brand book for now."): each lockup has one job (p. 04), with clear space, and its hands-off rules (p. 05) keep the logo on ink, level and untouched. For a Short, `docs/STUDIO.md` applies the book (the placement Krish approved on 26 September 2026, for the job-based Studio): the mark on an ink tile top left on every beat, and the stacked logo once in the ending band. Where a reference departs from them, the book and that placement win; whether the every-beat tile binds a quick-edit tall cut is Krish's decision. Outside brands appear as the company's official mark in full colour or its own published one-colour version, whichever fits the rest of the production (Krish, 28 Oct: "I don't really care. I think it depends on the rest of the production."), at equal size, with no effects and no tilt. We never recolour or redraw a mark ourselves; setting a mark in a house colour the company does not publish is Krish's decision on rights (ruling 6). In the references: Friday's small wordmark and mind.the.gap pill, and its caption slab becoming the brand band at 01:15.13; Monday tall's end card at 01:21.7.

**What does not fly.** "its not even on brand" (27 Oct, r89ec46b420). F07: colours and fonts present but the system not applied, with no mark tile, no channel pill and rotated logos. "there are no brand colours of mine" (26 Oct, rd1f92c1e7f). In Monday tall itself: a yellow top rule that comes and goes with nothing in the story to call for it.

**Compare beside.** Friday tall 01:15 to 01:18; Monday tall 01:21.7 to 01:25.7.

### 7. Typography: few voices, fixed jobs, words that add

**What great looks like.** A small set of type voices, each with one job and one place, the same all the way through: a heavy condensed display for headlines with one meaning word in a brand colour, a monospace for sources, dates and figures, a heavy sans for captions. Type is large and legible with a clear hierarchy and builds in time with speech. On-screen words add a source, a date, an exact number, a name or the changed word, and never repeat the sentence being spoken. Labels that name a source, a date, a record or what is on screen are fine, such as AT STAKE or CHESKY TO BLOOMBERG (Krish, 28 Oct: "I don't mind those labels."), and they stay few (Krish, 28 Oct: "minimal random components and labels"). A label that adds nothing is out (Krish, 28 Oct: "It's just the ones that say "Krish's read" or "illustrative" that are stupid because they add no value to the content."). In the references: USING A / CHINESE AI? on a coral slab at Friday 00:02, the dated mono label on the DeepSeek recording at Friday 00:57.4, the receipt set in mono at Monday tall 00:20.

**What does not fly.** "Thats 3 layers of words, which is pointless. You need to creatively accomplish visual clarity with as few words as possible" (25 Oct, r41d447d5d3). A sticker that repeats the caption, such as WRONG at Friday 00:32. In Friday itself: the coral slab always falls on the first word of line two, so it lands on filler words such as THE (00:28).

**Compare beside.** Friday tall 00:02; Monday tall 00:20.

### 8. Composition and layout: the whole frame, one focal point

**What great looks like.** The whole frame is used. Each frame has one focal point, and each layer keeps one place and one colour job, so several layers stack and still read. Margins are generous and consistent; nothing covers his face, captions never cross onto the proof, and nothing important sits where a platform draws its own buttons. A layout changes state as one designed reflow. In the references: four readable layers at Friday 00:54.4, the same proof grid every time in Monday wide (00:22, 00:44, 01:20).

**What does not fly.** "The use of the screen is terrible... Everything's cramped into corners, misaligned" (F19). In the references themselves: the proof band over the passport's machine line at Friday 00:28, a chip hiding the character.ai wordmark at Monday tall 00:43.1, and Monday wide's captions running almost the full width of the panel.

**Compare beside.** Friday tall 00:54.4; Monday wide 00:44.

### 9. Colour and grade: an owned palette where colour means something

**What great looks like.** One owned palette across every frame, each colour with a meaning: a dark lit ground, warm paper for reading, mint for the fact that matters, the channel colour for identity. Photography and screen media are graded into that world with no seam, and colour can tell part of the story. In the references: Friday's dark plate with one coral slab at 00:02, the mint evidence band at Friday 00:28, the grid's dots turning grey once BANKRUPT lands at Monday tall 00:13.3.

**What does not fly.** "there are no brand colours of mine" (26 Oct, rd1f92c1e7f). F07: the cream and ink meaning lost under dark photos. Coral never stands for a country, a warning or a failure. In both Monday cuts: the camera picture is warm-cast, partly clipped and never graded against the graphics.

**Compare beside.** Friday tall 00:02; Monday tall 00:16 to 00:24.

### 10. Texture and depth: material, never a flat template

**What great looks like.** Flat graphics get material and the frame has layers, something in front and something behind, with focus between them, so the finish feels printed and physical. Which material is the piece's own choice. In the references: grain, security lines and halftone on the passport at Friday 00:31.5, the torn-edged receipt at Monday tall 00:16.2, confetti in front of and behind BANKRUPT at Monday tall 00:13.3.

**What does not fly.** "cheap tacky emoji PDF infographics" (26 Oct, rd1f92c1e7f). F01: schematic boxes, labels and connectors.

**Compare beside.** Friday tall 00:31.5; Monday tall 00:16 to 00:20.

### 11. Transitions: motivated and seamless

**What great looks like.** Every change has a reason and carries the thought on: the outgoing element defocuses, dims or sinks while the next builds or rises; a chapter turns through a short brand beat, a designed layout move or a camera move into the next thing. It is seamless, with no stray flash, blink, ghosted double or glitch between pictures, and no stock wipes, spins or whooshes. In the references: the dark beat into TWO PASSPORTS at Friday 00:16.40, the caption held across the cut at Friday 00:45.10, one document defocusing as the next rises at Monday wide 01:39.7.

**What does not fly.** "weird flashes between the visuals... should beautifully transition like a seamless fluid enjoyable movement" (12 Oct, r9850f607b7). "there still seems to be a small visual glitch before the split screen kicks in." (23 Oct, r77f6601b0c). "there are so, so many more glitches and cuts" (26 Oct, r4648c55645). In the references themselves: the ghosted cross-dissolves in Monday tall and at Monday wide's act breaks, its VOID change and its end-card change (the SLIP moments below).

**Compare beside.** Monday wide 01:39.7; Friday tall 00:16.4.

### 12. Captions: burned in, branded, calm, in sync

**What great looks like.** Captions are burned in and designed as part of the brand, in one fixed zone. They are calm, in sync with the voice, and break where a thought breaks. The key word or number gets the same mint mark the proof uses, and captions step aside while a card carries the words. In the references: the caption building word by word at Friday 00:01.0, "passports," in mint at Friday 00:18, the slab stepping aside for the OUR CALL card at Friday 01:02.1, the mint chip matching the receipt at Monday tall 00:20.

**What does not fly.** "captions are non existent" (27 Oct, r0ff1eb179e). F08: only sidecar files, no visible captions. In Monday tall itself: phrases that end on filler words, such as "So why did Google and" (00:13.5).

**Compare beside.** Friday tall 00:18; Monday tall 00:20.

### 13. Proof visuals: real, dated and designed

**What great looks like.** Every claim shows on screen who produced it and when, and the proof is real and designed: a real page with the exact phrase highlighted and the rest soft, a labelled and dated screen recording zoomed until it reads, money as receipts whose lines build as they are spoken, a number hidden until it is proved, a forecast labelled as ours with a date and a confidence. In the references: the CHESKY TO BLOOMBERG card at Friday 00:08, the dated DeepSeek recording at Friday 00:57.4, OUR CALL at Friday 01:02.1, the receipts and the blurred article at Monday tall 00:16 to 00:31, the court filing at Monday wide 02:06.

**What does not fly.** "The imagery is all just generated visuals from subtitles, really, as opposed to real-world stuff" (28 Oct, r66145fce35). "The passport should have sample countries in there (maybe Canada, USA) so it's clearer and more life like" (24 Oct, r6114bed409). In Monday tall itself: a screen-recording slug dated after the piece (00:08, inferred) and a quoted fragment cut off with its context blurred (00:24).

**Compare beside.** Friday tall 00:50 to 01:02; Monday tall 00:16 to 00:31.

### 14. Sound finish

**What great looks like.** The sound is finished: an even voice from start to end, clean silences, tight sync, and delivery loudness through the existing gate. The licensed bed is audible under the whole of every cut, wide or tall, low under his voice (Krish, 28 Oct: "Yes I think music should be audible throughout but just lower."), rising only at the intro, the outro and chapter cards, as his 19 October words name them. Under test, one sound sits under a piece's biggest moment and nothing anywhere else, from a small set he approved by ear first (ruling 11). In the references, measured, not yet heard (the first Critic confirms each by ear): both are mastered with headroom and an even voice; light ticks under Friday's cold open, a pulse under its proof, music under Monday wide's opening story card and short swells at its act turns.

**What does not fly.** "This MUST go out with music" (12 Oct). "on the deeper cut, the audio needs to be able to be heard the entire time, but just really low unless its intro, outro or or chapter card" (19 Oct, s81602cf68b). "The version with my face has no audio/video sync." (27 Oct, r87fc74b4c1). In the references themselves (measured, not yet heard): the bed drops out at Friday 01:05.7 and Monday tall 01:06, and Monday wide's speech gaps fall to near digital silence. The small hits once read into Monday wide are withdrawn until someone listens.

**Compare beside.** Monday wide 00:00 to 00:33; Friday tall 00:27 to 01:05.7.

### 15. Krish on camera: real, steady, in sync

**What great looks like.** When he is on camera his picture is real, steady and in sync: his real room, steadied only, his face clear and never covered, and nothing in frame pulling the eye away. The camera half is the weakest part of the references, so aim higher than it. In the references: the steady presenter in the lower half of Monday tall, with captions on the seam and his face clear (00:16 to 00:24).

**What does not fly.** "the background blur on both videos is so weird, I look like I am in some sort of green fire" (28 Oct, r878b8d2745). F10: the picture about a second out of sync. In the Monday camera itself: a soft, warm-cast image with clipped highlights, the mic transmitter in his hand (Monday tall 00:09.6) and too much headroom.

**Compare beside.** Monday tall 00:16 to 00:24.

## Reference moments

Examples to compare against, never timestamps to enforce. Play each one in motion, at full size, with sound. Timestamps are into the file named in `config/reference-cuts.json`; this list and that file's `reference_moments` say the same thing word for word (`python3 scripts/floor.py --check`).

### Friday tall (23 October, voiceover)

- 00:00.67 to 00:04: USING A / CHINESE AI? builds on a living phone plate, with headline, coral slab, italic deck, word-by-word caption and a card tracked into the screen. The opening statement and the type system.
- 00:08 to 00:16: The CHESKY TO BLOOMBERG quote card tracked into the phone while the plate sways, with a hand-drawn underline and server racks soft behind. Cinematic plate and named source.
- 00:16.40 to 00:16.83: A dark brand beat; TWO PASSPORTS lands first, then the page rises and fades up. A chapter transition.
- 00:22.0 to 00:22.3: The CHINA stamp slams in oversized and tilted, then settles. Motion with weight.
- 00:25.9: A mint marker loop drawn round CHINA in a few frames. Hand-drawn emphasis on the one thing that matters.
- 00:31.5: Passport paper with grain, security lines, halftone round the flag and stickers with offset shadows. Texture.
- 00:50 to 00:52.6: '? OUT OF 3' held back, then filled to 2. A number withheld until it is proved.
- 00:54.4: Headline, a phone card with a circled entry, a caption and a mint band, all four readable. Composition.
- 00:56.07 to 00:58.5: The phone swings and pushes into the dated DeepSeek screen recording, with the sentence underlined and quoted. The signature move, spent on the proof.
- 01:02.1 to 01:05.7: The OUR CALL card held to be read while the captions step aside. A read-hold and caption discipline.
- 01:15.13 to 01:18: The caption slab becomes the brand band strapped across the passport. A branded close that completes the metaphor.
- 00:00.00 to 00:00.66: SLIP, below the bar, do not copy: empty brand dark on the first frame.
- 01:02.07: SLIP, below the bar, do not copy: a one-frame caption blink before the OUR CALL card.
- 01:05.7 to 01:15.6: SLIP, below the bar, do not copy: the music bed drops out (measured, not yet heard).

### Monday tall (26 October, split screen)

- 00:00 to 00:00.9: The story card builds piece by piece in reading order. Staggered build, the craft only: the hook is now the intro (under test).
- 00:03.9 to 00:05.6: MILLIONS MADE FRIENDS HERE arrives word by word as spoken while the grid spreads. Type in time with speech.
- 00:12.96 to 00:13.7: The BANKRUPT impact (flash, oversized slam, crawling tapes, debris) while the grid loses its colour. A big moment, with colour telling the story.
- 00:16.2 to 00:24: A torn-edged receipt rises, its lines build, and its mint figure matches the caption's mint chip. Texture, proof and captions speaking one language.
- 00:24 to 00:31: An article blurred except for the quoted phrase. Focus used as a lens, and honest proof.
- 00:43.9 to 00:51: THE PEOPLE rides an arrow into Disney's slot while THE LAWSUITS stays behind. Motion that explains.
- 00:57.8 to 01:03.6: Empty slots fill as each company is named, then the counter slows hard into 75%. State change on the word.
- 01:21.7 to 01:25.7: One end card, its lines revealed one at a time, the underline drawing on. One close.
- 00:42.9 to 00:43.1: SLIP, below the bar, do not copy: cross-dissolved layouts showing ghosted doubles.
- 01:17.9 to 01:18.2: SLIP, below the bar, do not copy: cross-dissolved layouts showing ghosted doubles.
- 01:21.35 to 01:21.6: SLIP, below the bar, do not copy: a face-on-face dissolve.
- 01:06 to 01:14.5: SLIP, below the bar, do not copy: the music bed drops out (measured, not yet heard).

### Monday wide (26 October, split screen)

- 00:00 to 00:33: Measured, not yet heard: the music under the opening story card, a low bed under the hook and a tight voice edit. Sound finish.
- 00:34 to 00:36: A stage with a grid, two drifting light pools and a vignette. A lit ground.
- 01:15.0 to 01:19.4: Logos drop into the RENTED box. A transition that carries the thought on.
- 01:28 to 01:40.6: A slow push on the CTO document with one phrase in focus, then it defocuses as the receipt springs up and settles. Cinematic hold, transition and craft.
- 02:43.5 to 02:56: Comparison receipts count up into a side-by-side board. Proof that sums up.
- 03:29.2: The counter rolls to 75% on 'I'm 75% sure'. A state change on the word.
- 00:45 to 04:31: SLIP, below the bar, do not copy: the speech gaps fall to near digital silence, the bed with them (measured, not yet heard).
- 00:26.97 to 00:27.16: SLIP, below the bar, do not copy: a ghosted cross-fade at an act break.
- 00:32.79 to 00:33.04: SLIP, below the bar, do not copy: a ghosted cross-fade at an act break.
- 01:19.45 to 01:19.83: SLIP, below the bar, do not copy: the change to the VOID stamp shows a ghosted double.
- 03:48.9 to 03:49.1: SLIP, below the bar, do not copy: a ghosted cross-fade at an act break.
- 04:39.2 to 04:39.45: SLIP, below the bar, do not copy: the change to the end card shows a ghosted double.

## Under test: the current defaults

Choices Krish made for now, to be judged on real engagement (Krish, 29 Oct: "I'd pick number one here but I think that we need to test and learn."). Each is the default today, never a refusal and never a never. Each piece records which it used on its making record, `production_choices`, with `python3 scripts/post-pack/making.py <piece> choices <creative-direction.json>`, so a retrospective can join the choice to how the piece did. To change a default, change `under_test` in `config/reference-cuts.json`: the creative direction's template and the record read it there. The list he confirmed on 29 October (ruling 12) puts the same three under test: "hook as intro, lead picture per piece, one sound on the big moment".

1. **The opening: the hook is the intro** (`production_choices.opening`, default `hook_is_intro`; ruling 8). Friday 23's way: the first frame is the hook in the brand's dress, with the logo and the series tag in the corners from the start. No story card and no logo intro before it. The close stays one calm outro, held long enough to read.
2. **The lead picture: chosen per piece** (`production_choices.lead_picture`, `series_picture` or `story_object`; ruling 9). The storyboard he signs shows both as stills: the series picture from the brand book (its device, p. 11: Monday the money map and the receipt, Wednesday the shipped thing apart with every part stamped, Friday threads on a time axis that bend and meet in a dated call) and a story object, like Friday 23's two passports. Claude's pick is marked; his signature accepts it unless he ticks the other. No storyboard waits on a tick.
3. **One sound on the big moment** (`production_choices.big_moment_sound`, `big_moment_only` or `none`; ruling 11). One sound under a piece's biggest moment, such as a low thud as BANKRUPT slams in, and nothing anywhere else. A small set is chosen and played to him first, and nothing is used before he approves it by ear; until then a piece uses none and records none. The Epidemic Sound subscription behind the music probably covers sound effects; that is still to be checked, and no spend is assumed.

## What is not the bar

- The length, shape or orientation of any cut, the split's proportions and the margins. Nothing here says a voiceover piece is 90 seconds or any other length.
- Cut counts, scene-change rates, caption change rates, frame timings, levels, tempo, spectrum, bitrate or frame rate. They describe the references; the existing gates set the only numeric limits.
- A count of big moments or of visual ideas. Each piece earns its own.
- Copying a device or a motif: the passport, stamps and stickers, the hand-held phone, the receipts, the hazard tapes, the BANKRUPT slam, the confetti, the VOID stamp, cotton bolls, server racks or the grid of character cards.
- Word-by-word captions or phrase captions; which material a piece uses; whether it uses mono labels that name something; whether it is voiceover, on camera or both.
- Where the references put the brand mark (the brand book places it, quality 6), their sampled colours (`config/ve/brand-tokens.json` is the palette), and whether outside logos are in full colour or the company's own one-colour version (ruling 6).
- The references' own slips and their music drop-outs. The bed is audible throughout every cut (Krish, 28 Oct: "Yes I think music should be audible throughout but just lower.").

The studies measured each file's scene changes, still holds, loudness, spectrum and palette. Those numbers describe the three files only and are left out of this page and out of `config/reference-cuts.json` on purpose, so nobody mistakes them for targets.

## Krish's rulings, 28 and 29 October 2026

Each question as it was put to him, his exact answer and what changed. An answer he gave by picking an option is recorded as Krish picked: "the option". Answers 5 and 7 are recorded and settle nothing by themselves.

1. **Music.** All three references drop the bed for stretches; on 19 October he said of the deeper cut, "the audio needs to be able to be heard the entire time, but just really low unless its intro, outro or or chapter card". Does the same hold for the tall cuts? His answer: "Yes I think music should be audible throughout but just lower." Changed: an aim. Quality 14, "What is not the bar", the reference moments (the three drop-outs are slips) and the sound comparison points (Friday's stops before its drop-out).
2. **Labels.** Friday carries labels such as AT STAKE and CHESKY TO BLOOMBERG. Do these sit against his "no eyebrow text" words? His answer: "I think that sounds better for number 2. I don't mind those labels. It's just the ones that say "Krish's read" or "illustrative" that are stupid because they add no value to the content." Changed: the floor (now never 4, held by the copy lint) for eyebrow kickers, AI-provenance and illustration tags and labels that tag something as Krish's (his read, his take, his test); quality 7 keeps labels that name a source, a date, a record or what is on screen.
3. **Brand mark.** The brand book asks for a mark tile on every beat; Monday does not carry one in its body. His answer, in his general words: "I'd stick to the brand book for now." Changed: an aim. Quality 6 cites the brand book and how `docs/STUDIO.md` applies it. The question's premise was wrong: the book itself does not ask for a mark tile on every beat; `docs/STUDIO.md` does, for a Short. Whether that every-beat tile binds a quick-edit tall cut such as Monday tall is Krish's decision.
4. **Stale documents.** May `docs/ve/design/TEMPLATE.md` (the ILLUSTRATION tag), `docs/ve/design/formats/H-motion.md` (the KRISH'S TEST stickers) and `config/style-references.json` (the treated background) be removed? His answer: "Yes remove those." Changed: the ILLUSTRATION tag and the KRISH'S TEST stickers are gone for good from compile, composition QC, the renderer, the ve spec, the design docs, crew cards, plate notes and fixtures, and a test's own label speaks as the publication ("OUR TEST"). In `config/style-references.json` the bank marks the treated background "not for us", with his words; the formats that listed it no longer do, and the style trial refuses it.
5. **Readings that go further than his words.** One visual idea per piece (quality 2); one big impact, and at most one loud transition (qualities 4 and 11); a sting opens every piece (quality 14). His answer: "I think you need to go a bit deeper and ask me proper questions here." Changed: answered by the four proper questions put to him on 29 October (rulings 8 to 11). The three readings are dropped. His recorded words already settle the rest: no fixed count of big moments; the first picture after the opening grabs; every part serves the message and words on screen never repeat the words spoken; no stray flash, blink, ghosted double or glitch between pictures; one opening and one close; the look comes from the brand book; the passports return whenever a story is about where an AI lives. The bar's own slips are corrected: Friday switches worlds three times, not four; Monday wide's ghosted act-break fades are slips, not the bar; the small hits at Monday wide 01:12.45, 02:42.9 and 03:29.2 are withdrawn until someone listens; and no sting exists (`config/intro-sting.json` is still a candidate).
6. **Outside logos.** Monday's cuts show most outside companies' logos in one house colour. The approved media standard says accurate official marks, never redrawn. Is a one-colour house treatment allowed, using only each company's own official one-colour mark? His answer: "I don't really care. I think it depends on the rest of the production." Changed: an aim. Quality 6: the company's official mark in full colour or its own published one-colour version, whichever fits the rest of the production; we never recolour or redraw a mark ourselves. His answer covers the company's own one-colour mark only: whether we may set a mark in a house colour the company does not publish is still Krish's decision on rights.
7. **Which files.** Are the Friday tall and Monday tall files named in `config/reference-cuts.json` the latest cuts he meant? His answer: "I think so but I'm not sure. The ones I meant are in the publish board at content.krishraja.com for last Friday and Monday, just gone." Changed: the board check on 28 October found all three files are exactly the ones the Friday 23 October and Monday 26 October tabs serve, so each identity is confirmed ("Which files these are"). This answer is recorded, not ruled: it confirms the bytes, not his approval of them.
8. **Opening.** Two of his 12 October rules each open a video: a short animated make your mind up intro before his face (house rule INTRO_STING; no design was ever approved) and an animated intro made for the story (house rule STORY_INTRO_OUTRO; Monday 26 opens on its story card). Friday 23 has neither. Which one opening should every video have? Option one was "The hook is the intro", Friday 23's way. His answer: "I'd pick number one here but I think that we need to test and learn. We need to figure out what the right tone is over time based on real engagement. Let's go with number one for now." Changed: under test, the opening (`production_choices.opening`). It replaces both 12 October opening rules, so there is no story card and no logo intro; the close stays one calm outro. The house rules INTRO_STING and STORY_INTRO_OUTRO change in place only with his yes in person.
9. **Lead picture.** The brand book gives each series its own picture; Monday 26 leads with its series picture and Friday 23 with a new object made for its story, the two passports. From now on, what should a video's main picture be? His answer: Krish picked: "Choose per piece". Changed: under test, the lead picture (`production_choices.lead_picture`). The creative direction carries both stills and Claude's pick (`docs/CREATIVE_DIRECTION.md`), and ve's Gate 1 shows them (`docs/ve/ENGINE.md`).
10. **Comparisons.** His 16 October rule says pictures never act out a comparison (house rule ANALOGY_IN_SCRIPTS_ONLY); Friday 23's passports act one out, and on 28 October he called them a powerful visual for every story about where an AI lives. May the picture show the everyday thing a script compares something to? His answer: "I think my point was that pictures never add zero value above and beyond the words. They have to be additive in meaning. I'm all up for visually clear ideas." Changed: an aim. Quality 2: every picture adds meaning beyond the words; a visually clear idea with the real facts on it is welcome; a picture that adds nothing beyond the words, or stands in for the facts (the 16 October car race), is out. Articles stay professional. The house rule changes in place only with his yes in person.
11. **Hit sounds.** Neither reference gives a stamp or a slam a sound of its own (measured, not heard). Should moments like these make a sound? His answer: Krish picked: "Only the big moment". Changed: under test, the sound on the big moment (`production_choices.big_moment_sound`), quality 14. Nothing is used before he approves a small set by ear.
12. **The floor.** Is this the floor: the short list of clear nevers that are the only things the engine may hard-block? With it, the engine's best guess: the eight nevers, then what to reach for and what is under test; everything else becomes an aim to reach for, a choice under test, or an example of the kind of thing that doesn't fly. His answer: Krish picked: "Yes, that's the floor". Changed: the floor is his eight nevers, in his order, in place of the five the engine drafted, each with his earlier words or the rule it rests on and the gate that already holds it, or held at review. The aims and what is under test agree with the list's lines. The rejection floor's draft standards for one opening and one close (`s9d6db813a0`, `sad5604ad3b` and `se67ed0142d` in `config/rejection-floor.json`) now match never 7 and wait on the Rejections route to record his approval; that file is the Rejections engine's to change, never this page's.

## Changing the bar

Only Krish changes the bar, adds a reference or moves its standing from draft to approved. A new reference joins when he names a finished file. This page and `config/reference-cuts.json` change together: `python3 scripts/floor.py --check` fails if the floor's nevers here and there differ in their listed words or their order, if his confirmation or the list's aims and under test lines are missing from their sections, if the quality names, the reference moments or the Compare beside points here and there disagree, if his words or a ruling's answer differ, if a reference does not say whether its identity is confirmed, if a sound moment does not say whether it was heard, or if a measured field is written into the references as if it were a target. It cannot see a figure inside a sentence, so none is written in one.
