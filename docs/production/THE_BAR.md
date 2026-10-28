# The bar: the production quality floor for video

Krish, 28 October 2026, his exact words:

> "the video production quality standards for the latest Friday (AI Passports) and Monday (character.ai) pieces are the floor for what I expect in terms of premium quality, motion design, cinematic feeling, movement, branding etc. Friday's is a voiceover format and Monday's a regular split screen format. Do not be intensely literal here as every piece is different, but I want you to get a feel for the standards we are never to fall beneath ever again"

And, correcting:

> "the long voiceover video is still being post produced so dont just assume that the voiceover format only has a 90sec version, you are only to look for production quality standards"

So this page is about production quality only: finish, motion design, cinematic feel, movement, branding, type, layout, colour, texture, transitions, captions and sound. It says nothing about how long a piece is, what shape it is, how many cuts it has or what a format must contain.

**Friday's long voiceover cut is still in post-production.** It is not part of the reference yet, and nothing here was learnt from it. Another session owns that work; leave it alone. When it is finished, Krish says whether it joins the references.

The references are three finished files: Friday 23 October's tall voiceover cut, and Monday 26 October's wide and tall split-screen cuts. `config/reference-cuts.json` names each one exactly (piece, format family, where it is served on the board, its sha256 and its Drive file id), lists the reference moments below by timestamp, and carries the quality names. `python3 scripts/floor.py --format <maker>` prints a short version of this page for every video maker, before the rejection standards, so every production session reads it at the start (AGENTS.md rule 20).

## The principle

Krish named two finished pieces as the floor: Friday 23 October (AI Passports, voiceover) and Monday 26 October (Character.AI, split screen). The floor is how they feel at their best.

- Every frame looks designed and owned by the brand.
- Motion carries the argument instead of decorating it.
- The world has light, focus, depth and material.
- The brand works as a system.
- Proof is real, dated and designed.
- The sound is finished.

Hold any new piece to this bar, whatever its story, format or length. For each quality below, put the new moment beside the named reference moment and play both in motion, at full size, with sound (never as stills, F03 in `config/failures.json`). Then ask: would this sit beside that without looking cheaper, flatter, slower, busier or less owned?

Do not copy the references. Each piece finds its own object, its own devices and its own big moment, and has to reach the same level of craft with them. The numbers measured from the references describe them and are never targets. The references' own slips, listed under each quality, are not licence to repeat them.

Before a brief, read `python3 scripts/floor.py --format <maker>` and check the finished file against it. The existing gates run first. The Critic's side-by-side covers what no gate measures. Krish's Monday review decides.

### Where it sits beside what is already here

- `docs/MEDIA_STANDARD.md` and `config/media-standard.json` are the production contract: the brief, the proof, the independent review and the signed receipt. This page is the level of finish that contract is reviewed against. Like the media standard's exemplars, the references are never production inputs: nothing is lifted from them into a new piece.
- `config/rejection-floor.json` (read through `scripts/floor.py`) holds what Krish rejected and the standards nothing may fall beneath. This page is the other side of it: what he named as the floor to reach.
- `config/ve/design-lock.json` holds the approved key frames for one ve format (the hand-held screen) and one module (two passports), matched by structural similarity at render. The reference cuts are not key frames and are never matched pixel for pixel; they are a feel to reach.
- `config/style-references.json` is the bank of styles. Every style in it, old or new, has to reach this bar.
- `docs/STUDIO.md` (makeyourmindup branding) and `config/ve/brand-tokens.json` own the palette, the type and the brand rules. Where this page names a colour, the brand book's value is the one that counts.

### How this was read

The qualities come from frame-by-frame studies of the three files, measurements of their sound, and four contact sheets checked by eye. Nobody has yet watched them in motion with sound for this write-up. Anything marked suspected or inferred is not proven. The first Critic to use the bar watches the references whole, at full size, with sound, and corrects this page where it is wrong.

Several of the "below the bar" quotes are about earlier cuts of these same two pieces: Monday's first cuts, rebuilt on 28 October (`docs/plans/2026-10-26-monday/video/REVIEW.md`), and Friday's cuts reviewed on 27 October. The references are the latest files Krish named.

## The qualities

### 1. Premium finish: every frame looks made and owned

**The bar.** At full size, every frame looks deliberately designed and belongs to the brand, as you would expect from a world-class media channel. Nothing looks like a default template, a slide, clipart, a widget, an outline icon or a test render. No frame carries a process or provenance mark. The finished file is clean: no glitch frames, blinks, ghosted doubles or stray hardware, and no soft media sitting next to crisp graphics without a reason.

**In the references.** Friday 00:02: the phone plate carries a cream headline, one coral slab, an italic deck line, a caption slab and the series pill, and every piece of it is owned. Friday 00:54.4: four layers stack and all stay readable. Monday tall 00:20: a torn paper receipt, its mint figure matched by the caption's mint chip. Monday wide 00:44: a receipt sits on a lit stage. Both end cards (Friday 01:15 to 01:18, Monday tall 01:21.7 to 01:25.7).

**Below the bar.** "These look like PowerPoint cliparts... These just look like cheap tacky emoji PDF infographics" (floor record rd1f92c1e7f). "the visuals look like Microsoft Excel from 20 years ago" (F19, which passed all 11 mechanical checks). "that stupid box around character.ai? That's a horrible, tacky, unprofessional, low-quality visual" (rf670596592). "I hate all these stupid little abbreviations and marks" (the ILLUSTRATION tag, KRISH'S TEST stickers and coral marquee, `docs/ve/STATUS.md`). "don't add stupid eyebrow text and asterisks and 'generated by AI' and 'Krish's take'... This needs to feel like a world class media channel" (commit 1881d38). F01: schematic boxes, labels and connectors.

Slips inside the references, never to repeat: ghosted double exposures at Monday tall 00:42.9 and 01:17.9, a face-on-face dissolve at 01:21.35, a one-frame caption blink at Friday 01:02.07, a soft upscaled screen recording at Monday wide 00:24 to 00:27, and waxy fingers on Friday plates at 100% (suspected, generated plates).

**How it is checked.** The Critic watches the whole finished file at full size with sound and frame-steps every change, side by side with the reference moments. F19 proves that passing mechanical checks says nothing about this quality. Where the route has them: ve composition QC and key-frame match (`scripts/velib`), and the quick-edit legibility floor in `kit.py`. Krish's Monday review decides.

### 2. Motion that explains: one visual idea carries the argument

**The bar.** Motion carries meaning. Each piece chooses one visual idea, either a physical object or a designed world that embodies the story, and every proof happens on it, so the viewer learns the grammar once. To show the mechanism, things change state on screen: they get stamped, filled, moved from one owner to another, counted up, struck out, ringed. Each change lands on the word that needs it. A hand-drawn mark in brand colour points at the one thing that matters at that moment.

**In the references.** Friday: the passport system runs from 00:16.6 (TWO PASSPORTS) to 01:15.1 (the brand band strapped across the passport). The CHINA stamp lands at 00:22, a mint loop circles it at 00:25.9, "? OUT OF 3" fills to 2 at 00:52.6, and DeepSeek is judged on the same pages at 01:00.1. Monday tall: at 00:43.9 to 00:44.5 THE PEOPLE rides an arrow into Disney's empty slot while THE LAWSUITS stays behind. At 00:57.8 to 01:00 the empty slots fill as each company is named. Monday wide: at 01:15 to 01:16.4 the logos drop into a RENTED box, and the VOID stamp lands at 01:19.5.

**Below the bar.** "there is barely any motion design apart from ridiculous arrows animating incorrectly" (r70dce346e5). F05: things enter and then hold for a long time, arrows restart, and a loop redraws every 6 s with no cue. "The quality of the motion video is awful" (r6bace5fffd: static symbols animate in, then hold). "still don't move enough. They don't catch the eye enough. There's not enough happening... just three arrow circles" (r95c7303330). F06: numbers lose their meaning across transitions. "I do not want a voiceover, captions, and then visuals which are just words" (r41d447d5d3).

**How it is checked.** Critic side-by-side against Friday 00:22 to 00:36 and Monday tall 00:41 to 01:03: for each beat, the Critic names what changes state and on which word. The ve periodicity check (no repeating loop) and longest-still check catch part of F05, and ve lint allows one scribble per beat. No gate measures whether motion explains, so the Critic and Krish's Monday review own this.

### 3. Motion craft: weight, ease, stagger, exits

**The bar.** Every move has weight. Things arrive fast and settle softly, slowing as they land. A small spring past the resting point is fine; wobble and linear slides are not. Builds are staggered in reading order, so a panel assembles in front of you. Type arrives in time with speech, numbers count up and slow into their value, and strokes draw on like a pen. Exits get as much care as entrances and are quicker. Nothing moves for its own sake.

**In the references.** Friday 00:22.0: the stamp slams in oversized and tilted, reaches size within a couple of frames, then its rotation settles. Friday 00:25.9: the marker loop draws on with an overlapping tail. Friday 00:16.63: the page rises as it fades up. Monday tall 00:00 to 00:01: the opening card builds in reading order. Monday tall 01:06 to 01:07: rows rise one after another and number badges pop from dots. Monday wide 01:39.9 to 01:40.6: the receipt rises past its resting point and settles. Monday wide 02:43.5: the receipts count up. Monday tall 01:02.7 to 01:03.6: the counter slows hard into 75%.

**Below the bar.** "ridiculous arrows animating incorrectly" (r70dce346e5). Annotations that restart with no cue (F05).

Slips inside the references, never to repeat: Monday wide's layout reflows move at one constant speed, which looks stiff beside the spring-eased cards (00:26.9 to 00:27.4, 00:49.6 to 00:50.0), and Friday's stickers vanish on a hard cut at 00:33.27 although their entries were crafted.

**How it is checked.** The Critic frame-steps entrances and exits beside Friday 00:22.0 and Monday wide 01:39.9. No gate measures easing. Krish's Monday review.

### 4. Cinematic feel: light, focus, depth, a living world

**The bar.** The picture is a lit world the camera moves through, never a flat slide deck. Grounds carry light: glows, a vignette, a surface. Focus works like a lens. Elements arrive soft and pull sharp, and on a source page everything blurs except the quoted words. Real or photoreal plates have depth of field and gentle living motion, and screen content is tracked into the device with the glass over it. A long hold gets a slow push. One big impact is saved for the story's turn, and everything around it stays controlled so it lands. Krish puts the level plainly: "I'm not expecting an Instagram reel to contain a full cinematic video. I'm expecting it to contain good motion design."

**In the references.** Friday 00:02: a hand holds a phone, cotton bolls are soft behind, and the card sits in the screen in perspective with a glass streak. Friday 00:08 to 00:16: the quote card is tracked to the screen while the plate sways. Friday 00:56.07: the phone swings and pushes into the screen recording. Monday wide 00:34 to 00:36: a stage with a grid and two drifting pools of light. Monday wide 01:28 to 01:38: a slow push on a document with only the key phrase in focus. Monday wide 01:39.7: the outgoing document defocuses and sinks. Monday tall 00:12.96 to 00:13.7: the BANKRUPT impact.

**Below the bar.** F01: schematic boxes. "There's no creative blend between real-world imagery, design, and aesthetic" (rd1f92c1e7f). "The imagery is all just generated visuals from subtitles, really, as opposed to real-world stuff" (r66145fce35). F05: held stills.

Slip inside Friday, never to repeat: the passport scenes are locked off between events, so their holds read as still graphics beside the living phone plates.

**How it is checked.** Critic side-by-side against Friday 00:02 to 00:16 and Monday wide 01:28 to 01:40. The ve longest-still check catches a dead hold. Nothing measures light or depth. Krish's Monday review.

### 5. Movement and pace: alive, and timed to meaning

**The bar.** The body of the piece is never dead. Something new arrives on the beat of the sentence that needs it: a stamp, a figure, a highlight, a new angle, a build. A hold exists only so a card can be read, and even then the picture breathes with a drift, a float or a slow push. Energy peaks on the proof. The piece breathes in acts, with a felt turn between them. The first picture after the sting is a motion-designed statement that grabs. There is one close.

**In the references.** Friday 00:16 to 01:05: new information keeps arriving, and the OUR CALL card holds at 01:02.1 to 01:05.7 so it can be read. Monday tall: freeze detection finds no still half-second between 00:03.5 and 01:21.7, and the receipts float while they hold. Monday wide: returns to the yellow presenter layout mark the act breaks (00:27, 00:46, 01:22, 02:02). Openings: Friday 00:00.67 to 00:04 (USING A CHINESE AI?) and Monday tall 00:03.9 to 00:13.3 (MILLIONS MADE FRIENDS HERE, then BANKRUPT).

**Below the bar.** "We've wasted one of the most important frames on such a boring visual treatment... This should be a motion-designed, headline-grabbing statement... provocative and visually intense" (rbbf0b955c4). "we also don't need three separate outro transitions and screens. Ever." (r04686da8b0). "They don't catch the eye enough" (r95c7303330).

Slips inside the references, never to repeat: Friday opens on 20 frames of empty brand dark while its ticks already play (00:00.00 to 00:00.66), and Monday's cold-open card stands still for about 2.7 s after it builds.

**How it is checked.** The ve change-density, longest-still and periodicity checks, and the quick-edit coverage check (which counts changes, never meaning). The Critic plays the first five seconds beside Monday tall 00:03.5 to 00:13.5 and asks whether it grabs. Krish's Monday review.

### 6. Branding as a system

**The bar.** The brand runs through every frame as a system, never as a watermark. That means the house palette with fixed meanings, the house type voices, the house caption style, the series identity, and the lockup clearly at the open and the close. Outside brands appear as their real logos, at equal size, drawn into the house look, with no effects and no tilt. A brand colour never stands for a country or a warning. There is one close screen.

**In the references.** Friday 00:00 to 01:18: a small wordmark sits top left and the mind.the.gap pill top right; at 01:15.13 the caption slab becomes the brand band strapped across the passport. Monday tall: the lockup and the follow.the.money pill bookend the piece (00:00 to 00:03.5 and 01:21.7 to 01:25.7), outside logos are drawn as cream monochrome (00:52 to 01:05), and on the end card .ai is in yellow with a mint underline that draws on. Monday wide 00:03.5: the home layout with the MONDAYS card and the BRING A CALCULATOR sticker; 04:39.5: the yellow end card.

**Below the bar.** "its not even on brand" (r89ec46b420). F07: the colours and fonts were present but the system was not applied, with no mark tile, no channel pill, a flattened type hierarchy and rotated logos. "It's not even the right branding" (F19). "there are no brand colours of mine" (rd1f92c1e7f). The tacky box round a logo (rf670596592). Three outro screens (r04686da8b0).

Slips inside Monday tall, never to repeat: a yellow top rule that comes and goes for no reason, and Google left in full colour while every other brand is monochrome.

**How it is checked.** The brand book (`docs/STUDIO.md` brand section, `config/ve/brand-tokens.json`). The ve `brand.mark_tile` check where it applies; it is not applied on STAGE layouts, so the hand-held format has no measured brand check. The quick-edit rule of a real logo for each named company. Critic side-by-side against Friday 01:15 to 01:18 and Monday tall 01:21.7 to 01:25.7. Krish's Monday review.

### 7. Typography: few voices, fixed jobs, words that add

**The bar.** Use a small set of type voices, each with one job and one place, the same way all the way through. A heavy condensed display face carries headlines, with one meaning word picked out in a brand colour. A monospace carries records: sources, dates, figures. A heavy sans carries captions. A human italic, or a real publication's own serif inside its own page, appears only where it carries a voice. Type is large and legible with a clear hierarchy, so the eye never hunts, and it builds in time with speech. On-screen words add something: a source, a date, an exact number, a name or the changed word. They never repeat the sentence being spoken. A label names a record, never a process, a provenance note or an opinion tag.

**In the references.** Friday 00:02: USING A / CHINESE AI? on a coral slab, with the italic deck "You may already be." Friday 00:57.4: a mono label reads SCREEN RECORDING DEEPSEEK 24 OCT 2026. Monday tall 00:20: a receipt set in mono, with "$2.7B (REPORTED)" as a printed hedge. Monday tall: the source slugs sit bottom left all the way through, and at 01:22 the end-card question is set huge and flush left. Monday wide 03:22: OUR PREDICTION.

**Below the bar.** "Thats 3 layers of words, which is pointless. You need to creatively accomplish visual clarity with as few words as possible" (r41d447d5d3). "stupid eyebrow text and asterisks and 'generated by AI' and 'Krish's take'" (commit 1881d38). F07: a flattened type hierarchy. The floor pattern "tiny or misaligned elements".

Slip inside Friday, never to repeat (also visible on the contact sheet): the coral slab always falls on the first word of line two, so it lands on filler words, such as THE in A THIRD OF THE TIME (00:28) and THEM in ANSWERED THEM ALL (00:34).

**How it is checked.** The ve composition QC (minimum text size), the quick-edit `kit.py` legibility floor, and quick-edit `visual_clarity` (word budget, phrase overlap with the narration). The copy lint for eyebrows and provenance notes exists only on an unmerged branch (1881d38), so the Critic checks those by eye. Critic side-by-side against Friday 00:02 and Monday tall 00:20. Krish's Monday review.

### 8. Composition and layout: the whole frame, one focal point

**The bar.** The whole frame is used. Each frame has one focal point, and each layer keeps one fixed place and one colour job, so several layers can stack and still read. Margins are generous and consistent. Headlines sit at a fixed height, the main object sits in the middle, and source lines anchor to one corner. Nothing covers his face, captions never cross onto the proof, and nothing important sits where a platform draws its own buttons. When the layout changes state, it moves as one designed reflow.

**In the references.** Friday 00:54.4: the headline TWO OF THREE., a phone card with a circled entry, the caption and a mint band, all four layers readable. Monday tall 00:46: the LAWSUITS STAY BEHIND diagram, with the slug bottom left and the caption on the seam. Monday wide 00:22, 00:44 and 01:20: the same proof grid every time. Monday wide 00:03.5: a symmetrical home layout.

**Below the bar.** "The use of the screen is terrible... Everything's cramped into corners, misaligned" (F19: small widgets in fixed corner boxes, a grid of cells, a dead lower half). The floor pattern "Never dead space, cramped corners, tiny or misaligned elements".

Slips inside the references, never to repeat: at Friday 00:28 to 00:33 the proof band sits on top of the passport's machine line; at Friday 00:52.6 to 00:54.8 a card sized for two entries shows only one; at Monday tall 00:43.1 to 00:44.0 a chip hides the character.ai wordmark; Monday wide's captions run almost the full width of the panel; Friday's top chrome and caption slab were never checked against TikTok and Reels screen furniture.

**How it is checked.** Where ve is used, ve composition QC checks fill outside the caption zone, text size, a clear caption zone, safe edges and margins. Critic side-by-side against Friday 00:54.4 and Monday wide 00:44. Krish's Monday review.

### 9. Colour and grade: an owned palette where colour means something

**The bar.** One owned palette holds across every frame, and each colour carries a meaning: a dark lit ground, warm paper for reading, mint for the fact that matters, the channel colour for identity. Photography and screen media are graded into that world, so you cannot see a seam between picture and graphics. Paper is warm off-white, never pure white. Colour can tell part of the story. The rhythm of dark "world" scenes and bright "explainer" scenes tells the viewer which mode they are in.

**In the references.** Friday 00:02: a dark green-black plate, a warm hand and a single coral slab. Friday 00:22 to 00:44: cream pages on the dark ground. Friday 00:28: the mint evidence band. Monday tall 00:06 against 00:13.3: the grid's avatar dots turn grey once BANKRUPT lands. Monday tall 00:16 to 01:21: a lit graphics ground with a warm glow and a teal glow. Monday wide 00:44: a cream receipt with a mint figure.

**Below the bar.** "there are no brand colours of mine" (rd1f92c1e7f). F07: the cream and ink meaning was lost under dark photos. The house rule that coral is never a country, a warning or a failure (`docs/ve/design/TEMPLATE.md`).

Gap inside both Monday cuts, never to repeat: the camera picture is warm-cast, partly clipped and never graded against the graphics.

**How it is checked.** The brand tokens. Critic side-by-side against Friday 00:02 and Monday tall 00:16 to 00:24. No gate measures grade. Krish's Monday review.

### 10. Texture and depth: material, never a flat template

**The bar.** Flat graphics get material, and the frame has layers. Paper has grain, fine lines, torn edges, a soft shadow and a slight tilt. Brand cards and stickers carry hard offset shadows. Colour fields carry halftone dots or a print offset. Stamps have rules, and marker strokes have a keyline. Particles in front, a grid or glows behind, and focus all add depth. The finish feels printed and physical. Which material a piece uses is its own choice.

**In the references.** Friday 00:31.5: security lines and grain on the page, halftone round the flag, stickers with offset shadows. Friday 01:03.5: a double-outlined stamp and a prediction card with a hard shadow. Friday 01:17: a stack of page edges under the brand band. Monday tall 00:16.2 to 00:17.3: a torn-edged receipt rises, tilted, then straightens. Monday tall 00:02: offset shadows tinted to their fields. Monday tall 00:13.3: confetti both in front of and behind the word. Monday wide 00:10: BANKRUPT with an offset ghost layer.

**Below the bar.** "cheap tacky emoji PDF infographics" (rd1f92c1e7f). F01: schematic boxes, labels and connectors. The floor pattern "Never clipart, outlined icons or emoji infographics; blend real-world imagery with brand design and colours".

**How it is checked.** Critic side-by-side at full size against Friday 00:31.5 and Monday tall 00:16 to 00:20. No gate measures texture. Krish's Monday review.

### 11. Transitions: motivated, seamless, one loud moment at most

**The bar.** Every change has a reason and carries the thought on. The outgoing element defocuses, dims or sinks while the next one builds or rises. A chapter turns through a short brand beat or a designed layout move, or the camera moves into the next thing. A caption or sound carried across a cut can glue it. At most one loud transition, saved for the turn. Never a flash, a blink, a ghosted double exposure or a doubled frame between visuals, and never stock wipes, spins or whooshes.

**In the references.** Friday 00:16.40 to 00:16.67: a dark beat, the headline lands first, then the page fades up. Friday 00:45.10: the caption holds across the cut. Friday 00:56.07: the dive into the screen recording. Monday wide 01:39.7 to 01:40.4: one document defocuses as the next rises. Monday wide 01:15.0 to 01:16.4: the logos blur out as RENTED blurs in. Monday tall 01:10.9 to 01:11.7: the rows grey out and FOUNDERS? rises from a blur. Monday tall 00:13.0: the one loud flash and slam.

**Below the bar.** "weird flashes between the visuals... the title card flashes up for about 0.1s before the next card... should beautifully transition like a seamless fluid enjoyable movement" (12 October, floor record r9850f607b7). F09: joins with 2 ms fades. "there are so, so many more glitches and cuts" (r4648c55645).

Slips inside the references, never to repeat: Monday tall cross-dissolves between two layouts and shows double exposures at 00:42.9 to 00:43.1 and 01:17.9 to 01:18.2, and a face-on-face dissolve at 01:21.35 to 01:21.6.

**How it is checked.** The ve `joins.decoder` check. The Critic frame-steps every card change, as the floor's own check asks, beside Monday wide 01:39.7 and Friday 00:16.4. Krish's Monday review.

### 12. Captions: burned in, branded, calm, in sync

**The bar.** Captions are burned into the picture and designed as part of the brand: a heavy sans in cream on an ink block, with a hard offset edge in the channel colour, always in one fixed zone. They are calm: they switch or build cleanly and never bounce. They stay in sync with the voice and break where a thought breaks. The key word or number gets the same mint mark the proof uses, so caption and picture speak one language. They never cover his face or the proof, and they step aside while a text card is carrying the words.

**In the references.** Friday 00:01.0 to 00:01.7: the caption builds word by word. Friday 00:18.0: "passports," in mint. Friday 01:02.1: the slab disappears while the OUR CALL card carries the words. Monday tall 00:20: a mint chip on "$2.7" matches the receipt's mint figure, and the captions straddle the seam. Monday wide 00:26: two staggered boxes with a yellow shadow. Krish on the ve caption style: "The captions are nice, but thats about it" (r8b16abe865).

**Below the bar.** "captions are non existent" (r0ff1eb179e). F08: only SRT sidecar files, no visible captions. His sign-off to burn them in (r45ca9143a5). The floor pattern "Captions match the words".

Slips inside the references, never to repeat: Monday tall phrases end on filler words such as "So why did Google and" (00:13.5), and Friday's first caption word may show about 0.3 s before the voice (suspected, from measurement).

**How it is checked.** ve `captions.ocr` checks the words only, not the style. The quick-edit delivery checks. Critic side-by-side against Friday 00:18 and Monday tall 00:20. Krish's Monday review.

### 13. Proof visuals: real, dated and designed

**The bar.** Every claim shows on screen who produced it and when, and the proof is real and designed. A real page shows the exact phrase highlighted and the rest soft. A real screen recording is labelled and dated, zoomed in until it can be read, with hand-drawn rings on what matters. Money appears as receipts whose lines build as they are spoken, with a printed hedge where a figure is only reported. A number stays hidden until it is proved, then fills in. An abstract deal becomes a diagram that moves. A forecast is labelled as ours, with a date and a confidence. Real logos, real products and real examples, such as sample countries, keep it lifelike.

**In the references.** Friday 00:08 to 00:16: the CHESKY TO BLOOMBERG card. Friday 00:50 to 00:52.6: "? OUT OF 3" fills to 2. Friday 00:57.4: the dated DeepSeek screen recording, its key sentence underlined and pulled out as a quote. Friday 00:58.5 to 01:00.1: the route map draws lane by lane. Friday 01:02.1: OUR CALL, DUE 2026-12-31, 90% SURE. Monday tall 00:07.6 to 00:09.0: rings draw round characters and the 79.1m count. Monday tall 00:16 to 00:31: receipts and a blurred article with its phrase highlighted. Monday wide 02:06 to 02:18: a court filing with the key phrase highlighted. Monday wide 02:44 to 02:56: the receipts side by side.

**Below the bar.** "The imagery is all just generated visuals from subtitles, really, as opposed to real-world stuff" (r66145fce35); he asked for his own screen recording, zoomed in, with hand-drawn circles. "The passport should have sample countries in there (maybe Canada, USA) so it's clearer and more life like" (r6114bed409). F06: numbers lose their meaning across a transition.

Slips inside the references, never to repeat: the Monday tall screen-recording slug says 28 OCT 2026 on a piece dated 26 October (inferred; check it), and a cut-off quoted fragment has all of its context blurred.

**How it is checked.** The fact gate owns truth; this bar covers only how proof looks. The quick-edit rule of a real logo for each named company. Critic side-by-side against Friday 00:50 to 01:02 and Monday tall 00:16 to 00:31. Krish's Monday review.

### 14. Sound finish

**The bar.** The sound is finished, not just loud enough. It meets delivery loudness and headroom through the existing gate. The voice is even from start to end, the joins are clean with no chopped words, the silences are clean with no hiss, and lip sync is tight. A licensed bed can be heard under the whole cut, low under speech and lifting at the open, the turns and the close. A sting opens the piece, and the music follows the shape of the story. Small sound hits on graphic events are welcome where they help.

**In the references.** Both references are mastered to delivery loudness with headroom and a very even voice. Friday 00:00 to 00:04: light ticks under the cold open. Friday 00:27 to 01:05.7: a pulse under the proof. Monday wide 00:00 to 00:03.5: a stereo sting. Monday wide 00:54, 01:25, 02:24, 03:07 and 03:32: short swells at the act turns. Monday wide 01:12.45, 02:42.9 and 03:29.2: small hits as the logos land, the receipts drop and the counter rolls. Monday tall 01:21.7 to 01:25.5: the bed comes forward under the end card. Krish on the earlier voice audio: "The audio is fine." (rc62cff421a).

**Below the bar.** "This MUST go out with music" (12 October). "on the deeper cut, the audio needs to be able to be heard the entire time, but just really low unless its intro, outro or or chapter card" (19 October, floor standard s81602cf68b). F09 and "so, so many more glitches and cuts" (r4648c55645). F10 and "The version with my face has no audio/video sync." (r87fc74b4c1).

Measured inside the references but not heard, so not proven: in all three cuts the voice falls away sharply above about 8 kHz, so it lacks air (suspected cause, not proven); the bed sits far under the voice and may vanish on a phone speaker; Monday wide's gaps drop to near digital silence with no room tone.

**How it is checked.** The existing gates: loudness of -14 LUFS, plus or minus 1, with true peak at or below -1 dBTP, and lip sync within 40 ms (quick-edit); the ve loudness, long-silence, sync and joins checks. The bed, the tone of the voice and the joins need a human listen at full length, on headphones and on a phone speaker (`config/failures.json`, `cut-called-done-unheard`). The Critic listens beside Monday wide 00:00 to 00:33 and Friday 00:27 to 01:18. Krish's Monday review.

### 15. Krish on camera: real, steady, in sync

**The bar.** When he is on camera, his picture is real, steady and in sync. It shows his real room, steadied only, with his face clear and never covered by graphics or captions, and tight lip sync. There is no treated, blurred or filled background, and nothing in frame pulls the eye away. The camera half is the weakest part of the references, so never fall below it and aim higher.

**In the references.** Monday tall: the presenter fills the lower half, steady, and the captions sit on the seam with his face clear (00:16 to 00:24). Monday wide 00:03.5: the centred home layout. In both cuts the framing holds steady for the whole piece.

**Below the bar.** "the background blur on both videos is so weird, I look like I am in some sort of green fire... you have never really done this treatment before and its really gone wrong" (r878b8d2745). F10: the picture is about 1.05 s out of sync. The rule never to pillarbox or blur-fill his portrait (`docs/plans/2026-10-23-friday/locked/motion-system.md`).

Weak spots in the Monday camera, never to repeat: the image is soft and warm-cast, highlights clip on the lamp and window, the wireless mic transmitter shows in his hand at Monday tall 00:09.6 to 00:13.5, and there is too much headroom.

**How it is checked.** Quick-edit motion checks (stabilisation), the lip-sync gate within 40 ms, and ve `sync.av_xcorr`. The Critic watches at full size beside Monday tall 00:16 to 00:24. Krish's Monday review.

## What is not the bar

- The length of any cut. Nothing here says a voiceover piece is 90 seconds or any other length. The long voiceover cut is still in post-production and was not studied.
- Aspect ratio or orientation. The split seam at y=1000, the 608 px presenter panel, the zone percentages and the 72 px margins are readings from these files.
- Cut counts, scene-change rates, events per second, caption change rates and freeze-detect results. They describe the references; none of them is a target.
- Frame-level timings such as 2 to 4 frame snaps, a 0.4 s settle, a 70 px overshoot or 78 px a frame. They describe how these references move; they are not specifications.
- Any loudness, bed level, tempo (about 105 BPM), spectrum, bitrate or frame-rate figure beyond what an existing gate already sets.
- Copying a device literally: the passport, stamps and stickers, the hand-held phone, the receipts, the hazard tapes, the BANKRUPT slam, the confetti, the VOID stamp, the VS card, the three-lane route map or the 75% counter. Each piece finds its own object and its own big moment.
- The specific story's motifs: cotton bolls, server racks, flags, Chapter 11, the grid of character cards.
- Word-by-word captions versus phrase captions. Both references meet the bar in different ways.
- Whether a small brand mark sits on every frame. Friday has one and Monday carries the brand through palette, type and captions between its bookends. Placement is the brand book's call.
- Which material a piece uses: grain, halftone, grid, torn paper or something else.
- The colour values sampled from frames. `config/ve/brand-tokens.json` is the source of the palette.
- Whether a piece is voiceover, on camera or both. The bar applies to any format.
- The references' own slips, listed under each quality. They are not licence to repeat them.
- The music drop-outs measured in both references (Friday 01:05.7 to 01:15.6, Monday tall 01:06 to 01:14.5, Monday wide during the argument). They conflict with his 19 October words, so they are not a technique to copy until Krish rules.

The studies also measured each file's scene changes, still holds, loudness, spectrum and palette. Those numbers describe these three files only. They are left out of this page and out of `config/reference-cuts.json` on purpose, so nobody mistakes them for targets. The existing gates set the only numeric limits.

## Reference moments

Play each one in motion, at full size, with sound. Timestamps are into the file named in `config/reference-cuts.json`.

**Friday 23 October, tall (voiceover)**

- 00:00.67 to 00:04: USING A / CHINESE AI? builds on a living phone plate, with headline, coral slab, italic deck, word-by-word caption and a card tracked into the screen. The opening statement and the type system.
- 00:08 to 00:16: the CHESKY TO BLOOMBERG quote card tracked into the phone while the plate sways, with a hand-drawn underline and server racks soft behind. Cinematic plate and named source.
- 00:16.40 to 00:16.83: a dark brand beat; TWO PASSPORTS lands first, then the page rises and fades up. A chapter transition.
- 00:22.0 to 00:22.3: the CHINA stamp slams in oversized and tilted, then settles. Motion with weight.
- 00:25.9: a mint marker loop drawn round CHINA in a few frames. Hand-drawn emphasis on the one thing that matters.
- 00:31.5: passport paper with grain, security lines, halftone round the flag and stickers with offset shadows. Texture.
- 00:50 to 00:52.6: "? OUT OF 3" held back, then filled to 2. A number withheld until it is proved.
- 00:54.4: headline, a phone card with a circled entry, a caption and a mint band, all four readable. Composition.
- 00:56.07 to 00:58.5: the phone swings and pushes into the dated DeepSeek screen recording, with the sentence underlined and quoted. The signature move, spent on the proof.
- 01:02.1 to 01:05.7: the OUR CALL card held to be read while the captions step aside. A read-hold and caption discipline.
- 01:15.13 to 01:18: the caption slab becomes the brand band strapped across the passport. A branded close that completes the metaphor.

**Monday 26 October, tall (split screen)**

- 00:00 to 00:00.9: the opening card builds piece by piece in reading order. Staggered build.
- 00:03.9 to 00:05.6: MILLIONS MADE FRIENDS HERE arrives word by word as spoken while the grid spreads. Type in time with speech.
- 00:12.96 to 00:13.7: the BANKRUPT impact (flash, oversized slam, crawling tapes, debris) while the grid loses its colour. The one loud moment, with colour telling the story.
- 00:16.2 to 00:24: a torn-edged receipt rises, its lines build, and its mint figure matches the caption's mint chip. Texture, proof and captions speaking one language.
- 00:24 to 00:31: an article blurred except for the quoted phrase. Focus used as a lens, and honest proof.
- 00:43.9 to 00:51: THE PEOPLE rides an arrow into Disney's slot while THE LAWSUITS stays behind. Motion that explains.
- 00:57.8 to 01:03.6: empty slots fill as each company is named, then the counter slows hard into 75%. State change on the word.
- 01:21.7 to 01:25.7: one end card, its lines revealed one at a time, the underline drawing on. One close.

**Monday 26 October, wide (split screen)**

- 00:00 to 00:33: the sting under the cold open, a low bed under the hook and a tight voice edit. Sound finish.
- 00:34 to 00:36: a stage with a grid, two drifting light pools and a vignette. A lit ground.
- 01:15.0 to 01:20.0: logos drop into the RENTED box, then the VOID stamp lands. Transitions that carry the thought on.
- 01:28 to 01:40.6: a slow push on the CTO document with one phrase in focus, then it defocuses as the receipt springs up and settles. Cinematic hold, transition and craft.
- 02:43.5 to 02:56: comparison receipts count up into a side-by-side board. Proof that sums up.
- 03:29.2: the counter rolls to 75% on "I'm 75% sure", with a small sound hit. Sync of picture, word and sound.

**Slips: below the bar, do not copy**

- Friday 00:00.00 to 00:00.66: empty brand dark on the first frame.
- Monday tall 00:42.9 to 00:43.1 and 01:17.9 to 01:18.2: cross-dissolved layouts showing ghosted doubles.
- Monday tall 01:21.35 to 01:21.6: a face-on-face dissolve.
- Friday 01:02.07: a one-frame caption blink before the OUR CALL card.

## Open questions for Krish

Reported, not resolved. Until he rules, the bar keeps his words.

1. **Music.** Both references drop the bed for stretches. On 19 October he said the music must be heard the entire time, just really low. The bar keeps his words.
2. **Mono labels.** Friday carries labels such as "AT STAKE" and "CHESKY TO BLOOMBERG". These may sit against his "no eyebrow text" words. The bar keeps labels that name a source, date or record and drops process or provenance tags.
3. **Brand mark.** The brand book asks for a mark tile on every beat; Monday does not carry one in its body.
4. **Stale documents.** These still conflict with his 28 October removal of marks and his "green fire" rejection: `docs/ve/design/TEMPLATE.md` line 52 (the ILLUSTRATION tag), `docs/ve/design/formats/H-motion.md` (the KRISH'S TEST stickers) and `config/style-references.json` (the treated background, still listed).

## Changing the bar

Only Krish changes the bar or adds a reference. A new reference joins when he names a finished file. This page and `config/reference-cuts.json` change together: `python3 scripts/floor.py --check` fails if the quality names here and there drift apart, if a measured value (a length, a ratio, a rate, a level) is written into the references as if it were a target, or if a reference moment names a cut or quality that is not there.
