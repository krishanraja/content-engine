# Identity study, round two

## Wordmark spacing

The large specimens share a 1,000 px measure. Taller lockups fit to height to leave room for the social placement. Each placement uses the same two-line headline, a left-aligned 200 px signature and half its box height of clear space. A 110 px signature sits alongside.

All variants reuse the approved Anton outlines. Dimensions use 100 drawing units per em. Tracking is added between adjacent letters. Specified word and slash gaps measure clear horizontal space between outlines. Unspecified joins retain the original advances.

| Code | What changes |
| --- | --- |
| V1 | Original W0 paths, positions and view box. Zero adjustment. |
| V2 | Tight line. Tracking −0.01 em, word gaps 0.18 em. |
| V3 | Open line. Tracking +0.06 em, word gaps 0.35 em. |
| V4 | Optical line. Word gaps 0.1553 em, the width of the left M stem. Slash width 78%, with 0.08 em clear on either side. U to P gap 0.06 em. |
| V5 | Original tracking and word gaps, with 0.15 em on either side of the slash. |
| V6 | MAKE YOUR above MIND/UP. Original joins, left aligned, baseline step 0.92 em. |
| V7 | MAKEYOUR above MINDUP. The former word and slash joins use 0.02 em of air. Baseline step 0.92 em. |
| V8 | MAKE YOUR MIND above mint UP at 2.5 times the cap size. Second line starts 0.94 em below the first. |
| V9 | D at 0.92 em wide and 0.899 em high, then 0.86 em of clear space to V4. Cap height is approximately 0.86 em. |
| V10 | D at 0.85 em wide above V6. The name starts 0.97 em below the top of the mark. |

## Block finish

Read each row across with the same hue and ink headline. The left 30% of each panel retains its flat fill. F0 stays flat throughout. F1 adds 12% monochrome grain. F2 moves from a 30% white radial hotspot through the base colour to 12% black at the far corners. F3 layers F1 over F2. Coral F3 uses 6% corner darkening to meet the contrast floor. F4 sweeps from 22% white to 14% black.

### Ink contrast, minimum to maximum

| Ground | F0 | F1 | F2 | F3 | F4 |
| --- | --- | --- | --- | --- | --- |
| Coral | 6.55–6.56 | 5.13–7.35 | 5.13–8.85 | 4.57–9.71 | 4.93–8.14 |
| Butter | 13.41–13.42 | 10.26–13.94 | 10.26–14.74 | 7.92–15.11 | 9.74–14.39 |
| Lilac | 8.75–8.76 | 6.80–9.70 | 6.80–11.20 | 5.32–12.00 | 6.47–10.52 |
| Mint | 13.35–13.36 | 10.20–13.87 | 10.20–14.68 | 7.84–15.05 | 9.72–14.34 |

Ratios use WCAG relative luminance against solid #0C1512. The bounds cover the entire field, including the flat strip. Grain is bounded by pure black and white at its stated opacity. For F3 the grain is composited after the lamp. Channels and ratios are rounded outwards, so the realised grain pattern may occupy a narrower range.

## Show art S1

Each square uses one object photograph. Burn depth measures from the bottom to the start of the fade. The field reaches solid ink before the signature. Both cover sheets display the 700 px artwork at 567 px. Each cover has its own top-aligned column of 150 px and 56 px reductions, with 24 px to the column and 16 px between reductions.

| Code | Photo | Burn | Arrangement |
| --- | --- | --- | --- |
| S1a | evo-cover | 35% | Optical line with D beside it |
| S1b | evo-topdown | 45% | V6 on two lines with a separate D |
| S1c | evo-specimens | 60% | V10 stacked, lower left |
| S1d | still-timer | 45% | V9 with a cap-height gap |
| S1e | still-record-phone | 60% | Large D above a smaller optical line |
| S1f | still-jukebox | 35% | Original W0 beside D |

## Show art S3

The same three sizes test how much of the identity survives on type alone. S3a fills mint with three width-matched lines. S3b pushes those lines into a deliberate right-edge bleed on coral. S3c gives the D silhouette most of the butter square, with W0 below. S3d sets V6 across lilac. S3e puts the oversized mint UP on grained ink. S3f repeats that hierarchy in ink on grained butter. An ink wordmark on colour is a proposal for review. The current production floor places the wordmark on ink only.

## Host render

Run `python docs/ve/cards/identity-round2/render.py` from the worktree root. The four PNGs are written to `.scratch/identity-round2/out/`. Compare the 56 px reductions at actual size when judging recognition.

## Round 2b · Directory test

T1 tests whether the D and two-line V6 lockup read as a stamp on the luggage tag. T2 tests the one-line V4 with a mint sticker at the top-right edge. Both print in ink using multiply blending. S3g tests whether S3a's three-line setting holds at 56 px on grained ink, with cream lettering and a mint UP.

The 1024 px square tag-a.png came from Higgsfield gpt_image_2_6, job e02eaf9d, as a blank tag with no generated text. The directory stand-ins are synthetic artwork with invented titles. Both 56 px panels use the same slot order.

## Sheet 7 · The full look

Open `study.html?view=full-look` for the 2400 × 3000 board. The kit, seven placements and five usage rules show where D stands alone, where the wordmark accompanies a headline and how the carousel colours lead to the mint answer. The host renderer captures it as `full-look.png`.

## Full look v2

- AI, UNPICKED. → WE TAKE AI CLAIMS APART, ONE WHY AT A TIME.
- PAID AT 0:30. → SPOTIFY PAYS AFTER 30 SECONDS
- THE NEW PRODUCER → WHY SONGS START WITH THE CHORUS NOW
- WHO GETS PAID? → WHO GETS PAID WHEN AI WRITES A SONG?
- WHO SETS THE CLOCK? → WHO DECIDED 30 SECONDS?
- Listen for the first thirty seconds. → Spotify counts a stream at 30 seconds, so the hook moved to the front.
- What the clock can tell us about the chorus. → Spotify counts a play at 30 seconds. Songwriters noticed.
- Who gets paid? → Who gets paid when AI writes a song?

Four grained steps rise from coral through butter and lilac to mint behind the two-line channel banner. The D overlaps the lower-left edge. Avatars carry the S3g name in #1A2822 behind the cream and mint D. Show art reverses the layers, with both D halves in #1A2822 behind the original type. The favicon keeps the plain D.

## Full look v3

Cream type contrast on the two ghost fills, calculated on ink before grain: cream ghost #313834 (10.49:1) and mint ghost #234135 (9.75:1). The kit shows both marks at their native pixel sizes. The two-line banner sits within the coloured area shared by all four steps.

## Full look v4

The D crosses the S3g letter outlines. The offset gap keeps the original lettering colour. The avatar uses the plain D on grained ink.

| Letter colour | Contrast against ink (#0C1512), before grain |
|---|---:|
| Cream (#F4EFE4) | 16.18:1 |
| Mint (#7EF0C0) | 13.35:1 |

## Full look v5

S3h uses the two-colour D at cap height in YOUR. The kit compares it with S3i at 400, 150 and 56 px. S3i keeps the cream letters, cuts an ink seam and turns the letters under the right half mint. Mint (#7EF0C0) against ink (#0C1512) measures 13.35:1 before grain.

The three questions pair records, the Spotify stream definition and a timer with coral, butter and lilac. The thumbnail and mint answer cards use the source logo row. The newsletter leads with the same stream definition, marked in its margin, beneath the centred V9 masthead.
