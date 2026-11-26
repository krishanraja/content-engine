# Round 11 · The test-card close and the house stills

[Review sheet at 360 px per card](ROUND-11-proof.jpg) · [Vertical outro](.scratch/library/out/motion/video-vertical-outro.mp4) · [Wide outro](.scratch/library/out/motion/video-wide-outro.mp4)

## The sign-off

The four colours fill the screen on the first frame. A single horizontal roll marks the snap. At frame 15 the bars start dropping into the staircase. MAKE enters as a whole word. YOUR arrives with the two halves of its O, followed by MIND/ and mint UP. The D settles after travelling 2.6 drawing units past the join, about 1.75% of its assembled width. The invitation and site enter at frame 55. Each step brightens once, for two frames, starting on frames 55, 56, 57 and 58.

| Native measurement | Vertical | Wide |
| --- | ---: | ---: |
| Runtime at 25 fps | 90 frames, 3.6 s | 150 frames, 6 s |
| Calm hold, from frame 60 | 30 frames, 1.2 s | 90 frames, 3.6 s |
| Four settled step heights | 120, 240, 360, 480 px | 59, 119, 178, 238 px |
| Tallest step as a share of frame height | 25% | 22.0% |
| Largest quiet horizontal band | 221 px, 11.5% | 77 px, 7.1% |
| Top and bottom of the signing group | 215–1228 px | 58–786 px |

The portrait S3h paints 790 px wide, or 73.1% of the frame. In both formats the group’s vertical midpoint is within two pixels of the midpoint above the staircase. The wide group’s horizontal midpoint is x 539 in the 1100 px signing area. In landscape the fourth step begins at x 1560, beyond the subscribe element. Both final native rasters match their static closes pixel for pixel. The carousel how-to CTA keeps its approved composition and its own foot.

Neighbouring steps overlap by one frame as the flicker travels. It lands with the invitation and leaves the portrait cut its full 1.2-second hold. The masks move with the words. The original painted paths sit inside all four mask rectangles throughout their travel. A separate reviewer decoded the MP4s and checked the word entrances and the two-frame pulses. [Portrait contact strip](.scratch/library/out/outro-vertical-strip.jpg) · [Landscape contact strip](.scratch/library/out/outro-wide-strip.jpg)

## The reading line

All six video why cards have **40 clear native pixel rows** between the painted headline and the first caption line on their sheets. The caption uses the same placement in the sequence. The photo still takes the upper 53% and burns into the rung colour.

The how-to counter and the screenshot frame both start at x 65. The screenshot card is 950 × 490 px, with a 2 px edge and at least 32 px of clear inner padding. Four crops of the original Spotify page preserve the heading and complete definition. The digits in “30 seconds” paint 39 px high. The gap from the card to the prompt is 41 px. The prompt and each numbered instruction have 64 px of ink clearance to the next instruction. The last ink ends at y 1202, leaving 148 px clear at the foot.

The advice cover reads “Make it read your contract first.” Only “first.” is mint. Its dek reads “One prompt that flags the clauses that cost you money.”

## The bank and the dated edition

The [house-still register](house-stills.json) contains all 48 original prompts, style numbers, requested aspects, actual dimensions, model, provider, generation date, resolution, credits and individual focal boxes. The counts by style are 12 story scenes, eight operating tables, ten analogue scenes, eight screen composites and ten sector sets. The register contains metadata. The images resolve from the worktree’s ignored `.scratch/bank/` directory. The offline registry snapshot is checked against the register.

Open **Choose a house still** beneath a card on a family sheet. Its selector lists the matching style and aspect for that slot and redraws the artwork and its size samples. Across 111 eligible photo slots, all 48 stills are available. Credited photography, camera footage, source screenshots and logos keep their original-source routes.

| Review surface | Photograph |
| --- | --- |
| Piece, advice, undated good-news and how-to covers | bank-05, bank-11, bank-01, bank-30 |
| Portrait and carousel Why 1, 2 and 3 | bank-12, bank-23, bank-21 |
| Wide Why 1, 2 and 3 | bank-18, bank-27, bank-28, all 16:9 |
| Landing and off-day | bank-40 stadium tunnel and bank-38 recording booth |
| Analogue rail | bank-20 colour-bar TV in portrait and bank-28 TV wall in landscape |

The undated good-news cover has its own ID, `carousel-good-news-roundup-cover`. The 21 November cover and slideshow retain the approved headline and date. The incoming template pointed to a jukebox. I recovered Christinne Muschi’s Canadian Press photograph of Anne-Marie Poirier and the Vocality founders from the edition’s filed second card. Its SHA-256 matches the production manifest. The crop excludes the old logo and type. The sheet captions show the photo credits. The source links, filed image names, digests and crop coordinates are in `library.json`. The five story slides, slideshow and closing photo strip now draw from the same five credited photographs in that filed edition. A producer can supply the credited originals through the existing per-piece image pack. [Filed card manifest](../../../plans/2026-11-16-week/goodnews-carousel/cards.sha256) · [Edition’s photo credit](../../../plans/2026-11-16-week/goodnews-carousel/research.md)

## Checks and handoff

- `render.py --alignment-only --rasterizer resvg` measured all 194 active templates at native size. It found zero horizontal ink failures and zero spacing failures. The quiet-band check counts a row as occupied when artwork clears the grained ink on at least 1% of its width. [Ink measurements](.scratch/library/out/ink-alignment.json) · [Measured spacing](.scratch/library/out/ink-spacing.json)
- `verify_static.py` passed 396 declared spacing pairs, 1,358 stress previews and the four sequence timelines. The embedded registry matches `library.json`. Both MP4s are H.264, yuv420p, CRF 18 at 25 fps.
- The media and native reports are local review files. The report, proof and media all live inside the Library write boundary. Chromium playback and visual sign-off remain with the host.
