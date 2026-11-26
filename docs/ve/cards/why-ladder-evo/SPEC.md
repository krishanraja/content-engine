# makeyourmindup, coming of age: the why-ladder frame set in the evolved house style

This is an evolution of the existing brand, not a new one. It keeps all of its DNA:
- ink, cream, mint and the section colour (Friday coral here);
- Anton for the one loud headline;
- Fraunces for the human line;
- the real wordmark;
- grain on ink;
- square corners;
- the "unpicked" operating-table photography;
- the site's leader-line callouts with small boxed mono tags ("the stuffing / REAL").

The premium pass works by restraint:
- one loud thing per frame;
- generous margins;
- images and words live in separate zones;
- every decoration that reads cheap is retired (see `tokens.json` `retired_defaults`): no shadows, stickers, swipe, halftone or tilt, and no translucent panels over photos.

Build one HTML page (`render/ladder.html`) that draws six 1080x1920 scenes from `tokens.json` and `piece.json`, plus `render/render.py` that captures them with Python Playwright. Use the same approach as `docs/ve/cards/why-ladder/render/render.py`; reuse its Windows `anonymous_driver` workaround verbatim. Captures go to `.scratch/why-ladder/evo/scene-{1..6}.png` and `contact.png`. `?play=1` plays all six in order with the motion in `tokens.json`. No colour, size or word may be typed into the code: read everything from the two JSON files.

## Laws
- **Fonts:** Anton (display, uppercase), Fraunces (human line, `SOFT` 50, `WONK` 0) and DM Mono (labels), all loaded from the files named in tokens. No other font, and no visible fallback.
- **Ink areas:** every ink area carries the 7% grain. Photos are full-bleed and never sit under a translucent panel. Words go either on solid ink, on a solid section-colour block (ink type only), or on the photo's own naturally dark area, where contrast passes.
- **Accents:** one section-colour element per scene, plus at most one mint element (mint means the answer).
- **Callouts:** a 2 px cream leader line runs from the exact detail to a boxed DM Mono tag. The tag has a 2 px cream border, no fill and no shadow, and a lower-case mono descriptor sits above it ("the meter").
- **Strength tags:**
  - DOCUMENTED is solid-bordered;
  - INFERRED is solid-bordered at 70%;
  - OPEN is dashed.
- **Wordmark:** `wordmark.png`, 200 px wide, on ink only, bottom-right inside the safe box. It appears on the cover and the landing only.
- **Safe area:** everything sits inside x90-990, y200-1500, except full-bleed photos and colour blocks.
- **Text:** no word overlaps another, nothing is cut off, and every word is spelled exactly as in `piece.json`.

## The rail (the ladder as a seam being unpicked)
- **Line:** a 3 px vertical line at x60 from y200 to y1500. It is cream at 20% on ink or photo, and ink on a colour block.
- **Rungs:** one node per rung, each 18 px, spaced `rung_gap` apart, starting at y300.
  - The current rung is a section-colour filled node with its number in DM Mono beside it.
  - A finished rung is a cream filled node with its 2-4 word label in DM Mono at x84.
  - A future rung is a cream 20% hollow node with no label.
- **Strength on finished segments:** documented is a solid 3 px line, inferred a solid 2 px line, and open a dashed line.
- **Parked branch:** a short dashed spur angled up-right from the node, with the lower-case mono word "parked".

## Scenes
1. **Cover.**
   - `evo-cover.png` runs full-bleed over the whole frame; its lower half is naturally dark.
   - One callout: a leader line from the white kitchen timer, near x300 y495 on the 1080x1920 frame, rising to a tag at the upper left, with descriptor "the meter" and tag "0:30".
   - The section label "mind.the.gap" (DM Mono lower case, coral) sits at y1000.
   - The headline, `piece.title`, is Anton 150 px cream, in 3 lines at y1050-1460.
   - The approved byline photo is a 120 px square at x90, y1540. The wordmark sits bottom-right at the same row, ending y1660.
2. **Step card, WHY 1.**
   - `evo-topdown.png` runs full-bleed at y0-1040, untouched.
   - From y1040 to y1920 a solid coral block wipes up over 12 frames.
   - On the coral block, in ink:
     - "WHY 1" in DM Mono at y1100;
     - the question in Anton 128 px at y1150-1440, at most 3 lines.
   - No other words. The rail crosses both zones.
3. **Evidence plate, WHY 1.**
   - Ink ground with grain.
   - The Spotify document as a crisp card: the `piece.json` crop of `m-spotify.png`, at full brightness and never dimmed, with a 1 px cream hairline border. It sits at x150-990, y230-1010, scaled to width, top-aligned. Clip it at the card's bottom edge inside a hard rectangle.
   - A 6 px coral bar runs in the card's left margin beside the focus rows.
   - A leader line runs from the end of the focus rows to a tag on ink at the right. Its descriptor is "the rule" and its tag is DOCUMENTED.
   - Under the card, `plate.note` in Anton 112 cream sits at y1080-1330.
   - The source line is DM Mono 24 cream 70% at y1380.
4. **The challenger, WHY 2.** Ink ground with grain, in two zones.
   - **Top zone (the evidence):**
     - "20 s+" and "5 s" as Anton 170 px numerals at y260 and y560: left-aligned at x150, and right-aligned at x990.
     - A 3 px cream line joins them, with a coral 20 px dot on the 5 s end.
     - The years "1986" and "2015" sit in DM Mono under each numeral.
     - The tag DOCUMENTED sits under the right numeral; above the tag, the descriptor "the evidence".
     - The source line goes at y820.
   - **Rule:** a 1 px cream 20% hairline at y880.
   - **Bottom zone (the claim):**
     - "or" in Fraunces italic 60 px at y920;
     - the TIME crop as a crisp card at x150-990, y1000-1300;
     - a leader line from its headline to an OPEN dashed tag, with the descriptor "the claim, parked".
     - The rival text in Fraunces italic 44 px cream sits at y1340, and its source line at y1400.
5. **Recap stack.** This is a cream light section, cream ground with no grain, and everything on it is ink.
   - **Contact strip:** four crisp evidence cards in a row at y220-520: Spotify `thumb_crop`, the chart (redrawn in ink), Fortune's crop, and TIME's crop. Each uses object-fit contain on a 1 px ink hairline. TIME is at 50% opacity and labelled "parked".
   - **Ruled list:** rows from y600, 150 px each, with a 2 px ink rule above each row and below the last.
     - Each row: the rung number in DM Mono, the label in Fraunces 48 ink, and the strength tag right-aligned (ink border).
     - The parked row is indented 80 px, in Fraunces italic, with a dashed rule.
   - A loop arc on the right edge runs from row 3 back to row 1, labelled "more plays, more pay" in DM Mono lower case.
   - One coral element: the current or last rung's number.
6. **Landing.**
   - `evo-specimens.png` runs full-bleed over the whole frame, with its dark lower half used for type.
   - "what this shows" in DM Mono lower case, mint, at y1020 (the one mint element).
   - The insight in Fraunces 62 cream at y1070-1290.
   - A 2 px coral rule, 120 px long, at y1320.
   - The question in Fraunces italic 50 cream at y1350-1470.
   - The wordmark bottom-right.

## Motion (play mode, 25 fps, ease from tokens, decelerating only)
- Type reveals 28 px up over 12 frames.
- Leader lines draw over 10 frames, then tags fade in over 8.
- The coral block wipes up over 12 frames.
- Photos ease in from 1.03 to 1.00 over the hold.
- Holds: cover 2.0 s, step 1.5 s, plate 3.0 s, challenger 3.5 s, recap 3.0 s, landing 3.0 s.
- No bounce, overshoot, slap, scale-pop, tilt or typing.

## Revision 1 fixes (internal QA, before showing)
Keep everything else exactly as it is: scenes 1, 2 and 6 are right.
1. **Rail labels** never rotate. A finished rung's label is horizontal DM Mono at x84, at most 180 px wide. If the scene's content occupies that space (scene 4), show the rung number only and drop the label. The "parked" spur's word sits to the right of the spur's end and never touches the rail or other text.
2. **Scene 3.**
   - The crop now ends at y1470, on a clean line boundary, so no text line is cut. The card ends where the crop ends.
   - The callout tag ("the rule" / DOCUMENTED) sits fully on ink, right-aligned to x990 and at least 24 px below the card's bottom edge. Its leader line runs from the end of the focus rows, down the card's right margin, to the tag.
   - The Anton note and the source line move down accordingly, keeping the same gaps.
3. **Scene 4.**
   - Chart numerals keep the case written in `piece.json` ("20 s+", "5 s"), with no uppercase transform. Show the unit "s" at 60% of the numeral size, baseline-aligned.
   - The "the evidence" / DOCUMENTED tag sits under "2015", right-aligned to x990, with its leader rising to the coral dot. No text touches the chart line: keep 24 px clear.
   - The "or" heading, the TIME card and its tag keep their positions. The "the claim, parked" descriptor sits above its tag without touching the card.
4. **Scene 5.** The contact strip becomes a 2x2 grid at x90-990, y220-760, with cells 444 x 264 and 12 px gutters, each holding one evidence card with object-fit contain on a 1 px ink hairline and 12 px padding:
   - top left: Spotify `thumb_crop`;
   - top right: the redrawn chart (numerals in Anton, the case as in `piece.json`);
   - bottom left: Fortune's crop;
   - bottom right: TIME at 50% with "parked".
   The ruled list starts at y820.
- Revision 2 (Claude, coordinate repair): scene 4's claim leader now starts at the TIME card's bottom edge and no longer crosses its headline.

## Notes pass (Krish, 24 Nov 2026, after approving the direction)
His notes: one look rather than day colours, "as simple to look at as possible", keep the joy ("the irreverant enjoyable tonality has been replaced by boring corporate sentences", "we've lost some element of joy which i suspect went away with all the colour. I didn't want to make this completely homogenuos"), and be careful with the wordmark.
Rebuild every scene to these rules. Where they conflict with earlier sections of this spec, these win.

**Colour.**
- Colour codes the climb, not the weekday. Read `tokens.colour_rules`. Rung 1 is coral, rung 2 butter, rung 3 lilac. Mint is the answer.
- Each frame uses one colour family, and uses it big.

**Scenes.**
1. **Cover.**
   - Keep it as is (photo, callout, cream "mind.the.gap" label, Anton headline, wordmark) with these changes: no byline photo, and the callout now reads "the new producer" / "0:30".
   - The headline stays cream on the photo's dark area. The wordmark stays bottom-right, small.
2. **Step card, WHY 1.** As now (photo top, block from y1040), with the rung 1 colour block, coral. The new question appears in Anton ink, entering line by line.
3. **Evidence plate, WHY 1.**
   - Use the new note and callout words.
   - The margin bar and the rail node take rung 1's colour.
   - The ink ground keeps its grain.
4. **Challenger, WHY 2.**
   - The whole top zone, y0-900, becomes a flat butter block (rung 2), set in ink: the numerals "20 s+" (1986) and "5 s" (2015), an ink line between them, the callout "the receipts" / DOCUMENTED, and the source.
   - The bottom zone stays ink: "or", the TIME card, "We all became goldfish." in Fraunces italic cream, the callout "the goldfish theory" / OPEN, and the source.
   - The rail node takes rung 2's colour.
5. **Recap.**
   - Cream ground, as now.
   - Each rung number sits in a filled square in its rung colour: coral 1, butter 2, lilac 3. The parked row has no colour and a dashed rule.
   - Use the new labels.
   - Keep the 2x2 evidence grid and the loop arc.
6. **Landing.**
   - The photo runs y0-900.
   - From y900 down, a flat mint block. On it, in ink: "what this shows" (DM Mono), the insight (Fraunces 64, roman), a 2 px ink rule, and the question (Fraunces italic 52).
   - No wordmark on this frame.

**Simplicity.**
- At most one callout per frame.
- No element exists only for decoration.
- If something can go, it goes.

**Motion.** Follow the new `tokens.motion` exactly:
- hard cuts between scenes;
- Anton lines rise 60 px over 8 frames, staggered by 4;
- colour blocks wipe up over 8 frames;
- leader lines draw over 6 frames, then the tag steps in;
- the chart numeral ticks down from 20 to 5 while the line draws;
- the TIME card slides 120 px over 10 frames;
- the landing shows the insight, pauses 12 frames, then shows the question.
It should feel brisk and witty. Everything still decelerates: no bounce or slap.
- Notes pass repair (Claude): right-hand callouts put the descriptor under the tag, and the leader drops into the tag's top centre, so no leader crosses text.
