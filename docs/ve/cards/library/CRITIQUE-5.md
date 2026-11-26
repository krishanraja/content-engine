# Critique 5 · Round 10 read at true size, and the Round 11 brief (25 Nov 2026)

Read against STANDARD.md, IMAGERY.md, Krish's words of 25 Nov ("The final card for videos should animate stunningly", "Carousels should be able to generate their own images and the first card and CTA should have the wordmark on them", "I also want a large variety of generated stock imagery") and the current @makeyourmind.up covers (DfXkxIjFo_8, Df9nTEcFF3c).

## What Round 10 got right (keep exactly)
- Why cards are full now: photo upper half burning into the why colour, question at full width. Wide why cards are strong.
- Piece, 21 November and how-to covers read like the current Instagram covers: scene, two-tone Anton, Fraunces dek, V4 bottom right.
- The how-to CTA (S3h, Follow for more, URL, colour-bar foot) is the best close so far.

## What fails

### 1. The video outro is not "stunning" (grade C+)
- The bars rise and then collapse to a thin foot after about one second. The best moment (four tall bars, the old-TV test card Krish likes) is thrown away.
- The settled vertical close leaves the lower 40% of the frame empty ink with the wordmark in the upper half. That is the "empty feeling" Krish flagged.
- The wide close crams the wordmark top-left with the URL just above the foot; the frame centre is empty.
- Mid-reveal frames clip lines through letters ("V  UR", "MIND/" cut at the cap line). On a hard mask that reads as a glitch, not a reveal.
- The vertical outro is 2 seconds with 1.2 seconds of motion. Too short to land.

**Round 11 outro, both formats:**
- Beat 1 (0 to 0.6 s): a full-frame old-TV colour-bar test card snaps on (coral, butter, lilac, mint at full height, the 7% grain, one frame of horizontal roll or scanline flicker on the snap). This is the house motif.
- Beat 2 (0.6 to 1.4 s): the bars drop as a stepped staircase to the foot and **stay substantial**: the staircase occupies the lower 22 to 28% of the frame in vertical (the tallest mint step at least 280 px of 1920), the lower 20 to 24% in wide. They become the stage the wordmark stands on.
- Beat 3 (1.0 to 2.2 s): S3h assembles: MAKE, YOUR, MIND/, UP, with whole-word masks (no line clipping through glyphs; the mask edge must sit in the gap between lines or move with the word). The D's cream half and mint half slide in from opposite sides and lock with a small overshoot (no more than 4% of the D width) on the house ease.
- Beat 4 (2.2 to 2.8 s): Follow for more and the URL arrive. One short colour flicker runs across the staircase left to right (each step brightens once, 2 frames, in order) as the full stop.
- Hold: vertical at least 1.2 s calm; wide holds to the end-screen length it already reserves.
- Composition of the settled close: the wordmark group (S3h, Follow for more, URL) is optically centred in the space above the staircase in vertical, with S3h at least 72% of the frame width. In wide, the group is centred in the area that the YouTube end-screen rectangles leave free, and the staircase spans the full foot. No quiet band larger than 18% of the frame height anywhere.
- Vertical length 3.6 s (90 frames at 25 fps); wide keeps 6 s.
- The settled frame must still match the static close item pixel for pixel. Update the static closes (`video-vertical-outro`, `video-wide-outro`, and the how-to CTA if it shares the component) to the new settled composition so they stay identical.

### 2. The how-to step is cramped (grade C)
- The screenshot card's heading sits against the card edge with no inner padding; the card's left edge does not align with the "01 / 10" counter.
- The lower third under the steps is unfilled while the screenshot is squeezed.
- Fix: card left edge aligns to the counter's ink; inner padding at least 32 px all round; screenshot scaled up to use the freed space; the steps on the 40/64 px spacing scale; nothing in the lower 8% except the counter dots if any.

### 3. The advice cover shows placeholder copy and a stand-in still in review
- "[ONE THING TO TRY]" in grey is a template placeholder rendered as if it were a design. Every review render uses real sample copy. Use: headline "Make it read your contract first." with "first." in mint; dek "One prompt that flags the clauses that cost you money."
- Give it a bank image (see 5).

### 4. Why 2 vertical: dek too close to the headline
- "What changes at that point?" sits nearer than 40 px to "COUNT?". Apply the 40 px headline-to-dek rule on all six why cards and check by ink.

### 5. Wire the stock bank (48 generated stills) into the Library
The bank is at `.scratch/bank/bank-00.png` to `bank-47.png` (ignored, never commit media) with its prompts in `.scratch/bank/bank-prompts.json` (each entry has `index`, `style` 1 to 5 and `params.prompt`, `params.aspect_ratio`). Model GPT Image 2.6 on Higgsfield, 2k, 2 credits each, generated 25 Nov 2026.
- Register every bank image in the Library as a house still with: id `bank-NN`, `imagery_style` (1 Story scene, 2 Operating table, 3 Analogue world, 4 Screen composite, 5 Sector sets), aspect, prompt, model, date, credits. Put the register in a committed JSON (no image bytes) next to library.json.
- Make the Library's slot picker offer bank stills filtered by the slot's `imagery_style` and aspect, with a focus box so the subject sits in the upper 60%.
- Review defaults (so Krish sees the bank in use): piece cover `bank-05` (cat at the radio mic); advice cover `bank-11` (singer with the crocodile puppet); good-news cover `bank-01` (kit manager and the boots); how-to cover `bank-30` (laptop and mint hourglass, Screen composite); why 1 `bank-12` (guitar on the operating table); why 2 `bank-23` (kitchen timer on singles); why 3 `bank-21` (jukebox); landing and off-day backgrounds from style 5 (`bank-40` stadium tunnel, `bank-38` recording booth); the colour-bar TV `bank-20` and the TV wall `bank-28` for analogue slots. Wide video why cards use 16:9 bank images where one fits the style (`bank-18`, `bank-27`, `bank-28`), otherwise crop by focus box.
- Keep the 21 November cover's real photograph (a real event stays a real photo; generated images never stand in for reported fact). Add a rule in IMAGERY.md wording: generated images illustrate an idea; a reported event uses a credited real photograph.

## Gates for Round 11
- `render.py --alignment-only` passes with 0 failures; ink spacing passes.
- Both outro MP4s re-encoded; a 10-frame contact strip of each saved next to ROUND-11.md (not committed if it is media; save under `.scratch/library/out/`).
- A ROUND-11-proof.jpg review sheet at 360 px showing: both outro contact strips, the six why cards, the four covers with bank images, the how-to step, the CTA and an off-day background card.
- Write ROUND-11.md in plain English: what changed, the measured numbers, and anything not done.
