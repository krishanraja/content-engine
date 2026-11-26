# Why-ladder frame set: "Load-Bearing" (concept stage mock)

A premium modern news look for makeyourmindup. Each rung of the why-ladder is load-tested on screen: the evidence lands, and on at most two rungs a real rival claim (the challenger) is weighed beside it. **Stroke weight is strength**: the rail segment under a documented rung is 12 px solid, inferred 4 px solid, open 4 px dashed. A weak rung stays visibly thin everywhere, cover included.

Build one HTML file that draws six 1080x1920 scenes from `tokens.json` (all colours, sizes, eases) and `piece.json` (all words, images, crops). Capture each scene to PNG with Playwright. The same HTML has a play mode that runs the scenes in order with the motion below. No colour, size or word may be typed into the HTML or script that is not read from those two files.

## Laws (every scene)
- One type family: Fraunces from the repo's TTFs, `font-variation-settings: "SOFT" 0, "WONK" 0`, `font-feature-settings: "tnum", "lnum"`. Roman = the evidence chain. Italic = anything still contested (challenger, open rung, the handed-over question).
- One accent per scene (Friday citron here), and only on the thing being tested at that moment.
- At most two layers of words per scene besides the rail labels and the source line. Never a text-only scene: every scene carries a real image over at least 40% of the frame.
- Flat fills only: no gradients, scrims, shadows, glow, blur, rounded pills, badges, emoji or arrows. Dimming is a flat overlay at fixed opacity.
- Everything inside the safe box x90-990, y200-1500, except full-bleed images, which run edge to edge.
- Never redraw, recolour or crop the wordmark; place `wordmark.png` at 170 px wide, bottom-right, ending x990 y1490, on a graphite area only.
- Never alter screenshots or photos: scale, crop and position only. Spell every word exactly as in piece.json.

## The rail (signature part)
- **Expanded** (step card): graphite panel at 92% opacity, x60-330, y200-1500, over the live image. The spine at x112. Nodes are 24 px circles at the `rung_y` positions. A finished rung has a filled paper node and its label (30 px, 600) at x146-318. The current rung has an accent-filled node, and the accent spine segment runs up to it. Future rungs get a hollow steel node and no label.
- **Collapsed** (plates): the panel shrinks to x60-150 and shows nodes only. Segment stroke weights follow strength.
- **Fork** (split rung): the spine branches at the rung's node, 34 px to the right. The branch's node and segment take the branch's strength (the parked branch here is dashed, steel). The word "OR" sits in small caps beside the fork node.
- **Loop**: a 2 px steel hairline arc on the right of the spine, from the looping rung's node back to the target node, ending in a 10 px dot.

## Scenes
1. **Cover** (also the vertical thumbnail).
   - The timer still is full-bleed, y0-1060, cropped so the timer and singles sit in the upper-left third.
   - Below it, graphite y1060-1920. The headline (112 px, 600, paper, two lines) sits at x90-990, y1110-1350.
   - Under the headline, the **horizontal strength rail**: a spine across x90-990 at y1430, with one node per rung (rungs 1-3) at true stroke weights. The parked branch is a short dashed spur rising from node 2. No labels.
   - The byline row: the approved headshot (byline.png) as a 150 px square photo at x90, y1500-1650, untouched (no cut-out, no name). The wordmark sits bottom-right on the same row.
   - Key items stay inside the 3:4 grid crop y240-1680.
2. **Step card, WHY 1**.
   - The record-and-phone still is full-bleed.
   - The rail is expanded, with rung 1 current.
   - The question block is a graphite panel at 92%, x330-990, y200-560. Inside it: "WHY 1" (34 px caps, steel) at y250, and the question (76 px, paper) from y300.
   - No other words.
3. **Evidence plate, WHY 1 (document)**.
   - The Spotify screenshot, cropped per piece.json, is scaled to fill x150-1080, y200-1300 (full-bleed right).
   - Everything outside `focus_rows` gets a flat 45% graphite overlay. The focus rows stay at full brightness.
   - An 8 px accent change bar sits in the left margin of the focus rows, 20 px left of the text, matching its height. It is never behind the words.
   - The rail is collapsed. Rung 1's segment is drawn at 12 px.
   - A graphite band at y1300-1500 holds the plate note (56 px, paper) and one source line: strength word in small caps, then " · " and the source (30 px, steel).
4. **Challenger beat, WHY 2 (chart + rival claim)**.
   - Ground: the record-and-phone still under a flat 78% graphite overlay.
   - Chart at x190-990, y240-860. One 6 px paper line joins the two points; the y axis runs 0-25 s, unlabelled except the endpoint texts. The years sit under the line in 30 px tnum steel. The accent is an 18 px dot on the 2015 endpoint. The series label is 30 px steel above, the note "A quarter of the wait" 48 px paper at the top right of the chart area, and the source line under the chart.
   - Challenger card at x190-990, y940-1460: "OR" in 34 px small caps steel; the TIME screenshot crop as a crisp card at full opacity; then the claim in 48 px italic paper; then the source line with strength word OPEN.
   - The rail is collapsed. Rung 2 is documented (12 px). The parked fork is dashed steel, with its node hollow.
5. **Recap stack** (rung 3 and the end; also the carousel cover).
   - Top half, y200-900: a contact sheet of the real evidence, three cells across, x90-990 with 12 px gutters. The cells are the Spotify focus rows, the chart (redrawn small) and the Fortune screenshot. The TIME crop sits as a fourth, narrower cell, dimmed 45%, marked parked.
   - Bottom half, y940-1460: the rung list. Each row is 120 px: tabular rung number, then label 44 px paper, then a full-width strength rule under the row at that rung's stroke weight and style. The parked branch row is indented 80 px, steel, italic, with the label "attention? parked".
   - The loop is drawn as a hairline arc at the right edge from row 3 to row 1, labelled "more plays, more pay" in 26 px steel italic.
   - The accent sits on the last finished rung's rule only.
6. **Landing card**.
   - The jukebox still is full-bleed, y0-900.
   - Graphite y900-1920.
   - "WHAT THIS SHOWS" (34 px caps, steel) at y950. The insight (64 px, paper) at y1000-1230.
   - A 4 px dashed accent rule at y1270, x90-400.
   - The question (52 px italic, paper) at y1310-1460.
   - The wordmark sits bottom-right.

## Motion (play mode, 25 fps; every move uses tokens.motion.ease, a decelerating curve)
- The plate glides 40 px up and fades in over 10 frames. The rail draws to the new node over 10 frames. The stroke then grows to its weight over 6 frames.
- The challenger card enters from the right over 12 frames, holds 20 frames, then its node and segment settle into the dashed parked fork over 8 frames.
- The step question shrinks and slides into its rail label over 10 frames when leaving the step card.
- The recap is a 12-frame pull-back.
- Push-ins never exceed 1.03 scale. There is no bounce, overshoot, elastic, scale-pop, slap or typing anywhere.
- Holds: cover 2.0 s, step 1.5 s, plate 3.0 s, challenger 3.5 s, recap 3.0 s, landing 3.0 s.

## Revision 1 fixes (internal QA, before any showing)
Keep everything that already works: the graphite and citron, the Fraunces settings, the landing card, the chart line and accent dot, the recap rung list with its strength rules, and the loop arc. Change only the following.
1. **Full-bleed imagery runs to the bottom edge (y1920) on scenes 2, 3 and 4.** Below y1500 the frame shows the image, never an empty graphite band. Graphite appears only as panels behind words. Scene 3's image under its note band also continues below it.
2. **Step card (scene 2).**
   - The current rung never shows a label; labels appear only on finished rungs. With no finished rungs, the rail is the collapsed node strip (x60-150, y200-1500 at 92%), not the expanded panel.
   - The question panel is one plain rectangle at x170-990, y200-560, 92% graphite.
   - There is no L-shape and no second panel.
3. **Document plate (scene 3).**
   - Use the new crop from piece.json, a mobile capture. Scale it to the full width x150-1080 so the source text renders at roughly 44-50 px.
   - The crop's top edge falls in the margin above the headline "How your streams are counted", so no text is clipped at a frame edge. The whole page is legible.
   - The focus rows keep full brightness; everything else in the document gets the flat 45% overlay.
   - The accent change bar sits in the left margin, aligned to the focus rows after scaling.
   - Keep the note band, but make it a graphite panel at x150-990, y1320-1500, with the image continuing around and below it.
4. **Challenger card (scene 4).** Use the new TIME crop at the full card width (x190-990), so the masthead and headline are readable. Keep "OR", the italic claim and the OPEN source line.
5. **Recap contact sheet (scene 5).**
   - Each cell shows a deliberate crop, never mid-sentence fragments.
   - The cells are:
     - Spotify, using `thumb_crop` (the focus rows only);
     - the chart, redrawn;
     - Fortune, using its crop (headline, byline, date);
     - TIME, using its crop, dimmed 45% and labelled "parked".
   - Images scale to fit their cell with `object-fit: cover`, anchored at the left and top.
6. **Cover (scene 1).**
   - The photo runs from y0 to 1180. The headline sits at y1220-1460.
   - The horizontal strength rail sits at y1510 and uses 28 px nodes. Rungs 1-2 are 12 px solid, rung 3 is 4 px solid, and the parked spur rises 70 px from node 2, dashed 4 px, in steel.
   - The byline photo is a 120 px square at x90, y1560-1680. The wordmark sits bottom-right on the same row, ending x990, its bottom at y1680.
   - Nothing important sits below y1680.

## Revision 2 fixes (internal QA)
1. The separator between the strength word and the source is the middle dot character U+00B7 with one space on each side. ladder.html line 106 currently holds a double-encoded mojibake sequence; write it as the JS escape "·" so the file encoding cannot break it again.
2. **Scene 3:** honour the crop's bottom edge (piece.json crop y1 is now 1810), so the document ends just above the note panel at about y1300. Below that, the note panel and then the full-bleed photo; no document text shows below the panel.
3. **Scene 4:**
   - The series label "Average intro, US top-10 hits" sits at x190, y250, in 30 px steel.
   - The note "A quarter of the wait" sits on one line at x190, y300, at 48 px.
   - The chart line and its points sit between y420 and y760, with the years at y800.
   - The source line is one line at y860. If it is too long, reduce the letter-spacing of the strength word only, never the font size.
   - The "OR" beside the rail fork must not touch the rail strip's edge; place it at x160 or remove it, since the card already says "OR".
4. **Source lines everywhere** are a single line. The plate panels are wide enough for that: scene 3's note panel spans x150-990.
5. **Scene 5 contact sheet:**
   - A 2x2 grid fills x90-990, y200-900: two columns of 444 px with a 12 px gutter, and two rows of 344 px with a 12 px gutter.
   - The cells are: top-left, Spotify `thumb_crop`, scaled to the cell width and centred vertically on a paper ground; top-right, the chart, redrawn to fill the cell; bottom-left, Fortune's crop; bottom-right, TIME's crop, dimmed 45%, with "parked" in 26 px italic steel at its bottom-left inside the cell.
   - Images use object-fit cover, anchored left and top.

## Revision 3 fixes (internal QA)
1. **Scene 4 chart.**
   - The two points move down: "20 s+" to y520 and "5 s" to y800. The years go to y850 and the source line to y910.
   - Each endpoint label sits on the side of its point away from the line: "20 s+" above-left of its point and "5 s" below-right of its point, at least 16 px from the line.
   - Keep at least 60 px of clear space between the note's baseline and any chart label.
2. **Scene 5 contact sheet.**
   - Every image cell uses object-fit: contain (never cover), centred in its 444 x 344 cell on a paper ground, with 16 px inner padding. No text or image is cut at a cell edge.
   - The TIME cell keeps its 45% dim and its "parked" label, which sits on the paper ground below the image.

## Revision 4 (Claude, coordinate repair only)
Scene 4: the dim panel now spans x170-990, y220-960, so it covers the source line. The chart sits inside it with 44 px padding (x214, width 752). The challenger card is at x170-990 from y985, with 24 px inner padding. The "5 s" label sits right of its point, vertically centred on it, inside the panel. The rung 2 source is shortened to the journal and year so its line fits at normal tracking.
