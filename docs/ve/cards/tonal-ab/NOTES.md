# Tonal blocks and podcast cover proofs

Run on the host from the worktree root with `python docs/ve/cards/tonal-ab/render.py`. Both 2400 × 1500 sheets and the three individual 3000 × 3000 cover masters go to `.scratch/tonal-ab/out/`. To open the HTML directly, use `?view=blocks-ab` or `?view=show-art`.

## Colour

The three rows share the same approved portrait frames, lilac panel, crops and type. At 50% view each row includes a 216 px high strip of bare coral, mint and lilac on the right. Read the strip vertically to compare the same surface from highlight to shadow.

The lamp mixes the base with 20% white at top centre. The elliptical light returns to base 70% down the centreline and settles to 6% black at the bottom. The sweep runs vertically from 10% white through the base at midpoint to 10% black. Both use sRGB interpolation and the same 7% monochrome grain below the type.

| Surface | Treatment | Light endpoint · ink contrast | Dark endpoint · ink contrast | Contrast bounds with grain |
|---|---|---:|---:|---:|
| Coral | Lamp | #FF8871 · 7.96:1 | #F06448 · 5.85:1 | 5.05–8.47:1 |
| Coral | Sweep | #FF795F · 7.20:1 | #E65F45 · 5.38:1 | 4.66–7.70:1 |
| Mint | Lamp | #98F3CD · 14.17:1 | #76E2B4 · 11.76:1 | 10.01–14.45:1 |
| Mint | Sweep | #8BF2C6 · 13.80:1 | #71D8AD · 10.72:1 | 9.16–14.09:1 |
| Lilac | Lamp | #C5B8FF · 10.32:1 | #AC9CF0 · 7.75:1 | 6.70–10.81:1 |
| Lilac | Sweep | #BEAFFF · 9.51:1 | #A595E6 · 7.11:1 | 6.12–10.07:1 |

Contrast uses linearised sRGB relative luminance against #0C1512. Endpoint values are rounded to 8-bit RGB before grain. The bounds allow a fully black grain pixel at the deepest endpoint and a fully white one at the lightest, rounding channels outward at each stage. Intermediate colours sit within these limits because every channel decreases from light to dark.

## Podcast cover

Current is a local copy of the supplied 3000 px JPEG. Each proof places a 700 px cover beside its own 150 px and 56 px reductions. The three alternatives use the same compositions for the masters and reductions.

- S1 Burn keeps the record and tools full bleed. The bottom 45% fades into ink, with the clean cream-and-mint W0 wordmark anchored at lower left. The mark carries the name alone.
- S2 Colour field sits the operating-table crop inside a butter margin. Ink Anton carries the name directly on butter. Final production needs the one-colour ink wordmark file being designed by the parallel job.
- S3 Type only gives the name three large lines on mint. A ruled Fraunces sign-off supplies the smaller editorial voice. At 56 px, judge the cover by recognition of the name.

Static checks covered syntax, image decoding, asset paths and calculated contrast. Round 2 has not been rendered. Laptop-size review of these three treatments and the S1 wordmark remains pending.
