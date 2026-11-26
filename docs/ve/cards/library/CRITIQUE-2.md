# Round 4 critique, read at true size by the host (25 Nov 2026)

Krish, on seeing the round 4 closing card: "why does all of this look misaligned". He is right, and it runs through the set. Fix alignment first and everywhere; it is the first thing he will check.

## 1. Alignment (blocking)

Measured on the host renders by scanning each text line's visible ink at true size:

| Item | What the pixels show |
|---|---|
| video-vertical-close, -outro, carousel-close (and every S3h placement) | S3h's visible left edge is at x 118 (vertical) / 111 (carousel); "Follow for more" starts at 93 / 84; the site line at 91 / 82. The mark sits 25 to 27 px right of the words under it, because the S3h artwork is placed by its SVG frame, which carries built-in margin, while the text is placed by its letters. |
| video-vertical-why-1/2/3, carousel-why-1/2/3 | "WHY 1" sits on the left edge (x 91; carousel x 66) while the question is centred under it (lines at x 122 and 285; carousel 194 and 357). Two alignments on one card. |
| video-vertical-landing (and every italic Fraunces line) | The roman lines start at x 93; the italic question at x 99. Italic overhang is not compensated. |
| social-feed, carousel-cover | Logo chip x 65, headline 66 to 67, V4 65: within 2 px, correct. Keep this as the standard. |

The rule, for every template in the Library:
- **One left edge per card.** Every text block, logo chip and wordmark on a card shares one column edge on the 12-column grid. No centred text anywhere, except a single short line on a Story or a centred lockup that is itself the whole card (an avatar, the show art).
- **Align the ink, not the box.** Place every text line by its visible ink: offset each line by the font's measured left side bearing for its first glyph (canvas `measureText(...).actualBoundingBoxLeft` with the exact font, size, weight, style and variation settings), including the italic overhang. Place every wordmark (S3h, V4, V9) by the bounding box of its drawn paths (`getBBox()` on the paths, never the SVG viewBox). Trim or offset the S3h, V4 and V9 artwork so their drawn left edge lands exactly on the column.
- **Right edges and baselines too.** Where a card has a right-aligned element (the meme V4, a right-hand tag), align its ink right edge to the column's right edge. Stack spacing is measured ink to ink.
- **A check that fails.** Add to render.py a pixel check, run on every item at true size: for each declared column group, find each element's leftmost ink pixel; fail the item if any element in the group is more than 2 px from the group's edge. Report per item. The host will run it; build it so it needs no human eye.

## 2. Empty fields still read as dead

- **Vertical video frames.** The lower part of the why, place, creative-work, quote, chapter, landing and statement-close frames is empty colour. Part of it is the caption band. Do two things:
  1. Centre each card's content group vertically in the zone between the image (or the top safe line) and the top of the caption band, and size the type up until the group fills that zone's width.
  2. On every family-sheet preview and in the sequences, draw the house caption in its band (an example line from the caption script), so the frame is judged as it will be seen. Item exports stay caption-free for the engine.
- **The close.** video-vertical-close must be pixel-identical to the last frame of video-vertical-outro, which is right: the group centred in the safe area, S3h large. Same for the carousel and deck closes.
- **Statement close.** Mint field with a small top-left line and a small S3h on a foot. Set the statement large and vertically centred; S3h at the same size and placement as the close.
- **Carousel document, landing, explainer, simple-advice item, chart; vertical PiP, chapter; social poll, threads text.** Same fault: content parked at the top. Centre the group and enlarge the type to the zone.

## 3. Charts are hairlines
The chart plates (vertical, wide, carousel, newsletter figure, social) draw a thin axis with 0 s to 30 s ticks in small mono. Rebuild the chart as a bold, readable figure: a thick bar or band in the rung colour filling to the threshold, the threshold in Anton at large size, the axis labels in DM Mono at no less than 28 px per 1080 px, and the measure and source line (floor 171). It must read at phone size.

## 4. Remove what does not belong
- **video-vertical-documented and video-vertical-lower-third.** Retire them (status "retired", not rendered on sheets): the long cut is 16:9, so a vertical "long cut only" frame has no use. Keep the wide versions.
- **Captions on an opaque band.** The house caption is "no box": Fraunces 600, cream, the current word in mint, over a soft ink burn behind the words only (the burn is the one allowed gradient). Remove the opaque band from captions, the talking head, split, PiP, plate and voiceover frames. The split screen's seam stays an opaque, hard-edged divider between evidence and face (floor 150); the caption sits on the seam without its own box.
- **Guides inside items.** Dashed guide rectangles (YouTube banner safe box, end-screen element boxes, tall-cover grid crop) appear inside item renders. Guides appear on sheets only, never in an item export.
- **Mint bars on the email header and Substack wordmark.** Remove; V9 alone on ink.

## 5. Copy and content
- **Episode art reads "WHY SHORT SONGS?".** Never rewrite a real title. Use "WHY DID POP SONGS GET SHORTER?" and size it to read at 56 px, or use a slot.
- **Good news uses the real approved edition.** content-engine `docs/plans/2026-11-16-week/goodnews-carousel/deck.json` and `research.md` hold Saturday 21 Nov's carousel, approved by Krish on 18 Nov: the cover headline "This week AI helped people speak, sign and get around." and five real stories with sources. Use its words on the good-news cover, items and the weekly edition's "What else happened", exactly as approved. The photos stay as clearly credited stand-ins; caption each on the sheet "stand-in photo; the edition uses the story's own licensed photo". Do not use the felt robot.
- **Meme and quiz.** The 400 px motion-blurred clock is too soft to be the picture a meme lives on (floor 104, 197: sharp). Use a sharp house still at full width for the meme picture, and for the quiz pair the house timer still with the record-phone still.
- **Slot labels.** Keep them at true size and position, at 60% opacity, as now.

## 6. Small things seen
- Profile banners: S3h floats between the steps and the edge. Put S3h on the left column edge of the all-device safe area, bottom-aligned with the steps' baseline, steps rising to the right edge.
- Wide outro and wide close: optical balance is good; apply the ink-alignment rule.
- Audiogram family: the excerpt slot sits top-left and the waveform floats mid-frame with a large empty field below. Centre the group; waveform full content width.
- Good-news cover: the headline is small for a cover. Set it at cover size, as the feed cover.

## 7. The stress run crashed
`python render.py` threw "carousel-good-news-item body_1 cannot fit at minimum size" on the first stress sheet (video-vertical, long), because the slideshow embeds the good-news item and the error escaped the sheet. Stress sheets must stamp REFUSED in red on the slot and continue; only an individual export may throw. Make every embedded item use the same stamping path.

## When you hand back
List every item whose geometry changed. The host re-renders everything, runs your new alignment check and its own pixel scan, and reviews at true size before Krish sees anything.
