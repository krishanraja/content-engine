# Identity lab round 2: brief

Write files only in this folder (docs/ve/cards/identity-round2/). Do not launch Chromium (it cannot start in your sandbox; the host renders afterwards). Do not commit. Do not edit files outside this folder.

The founder picked mark D (docs/ve/cards/identity-lab/marks/d-face-off*.svg: two half-discs, cream left, mint right, one beat out of register) and wordmark W0 (docs/ve/cards/identity-lab/wordmarks/w0-clean*.svg: MAKE YOUR MIND/UP in Anton outlines, cream with mint UP; the -ink.svg file is the one-colour ink version). His words: "I like D, w0 (but i want better / more varieties of spacing), I cannot even see how Tonal Lamp is any different to the others, I like S1 and S3 equally but feel like I need to see more varieties".

Build: study.html (one file; ?view=<sheet> switches sheets; sets window.ready once fonts and images have loaded), render.py, NOTES.md. Copy the Windows driver pattern from docs/ve/cards/tonal-ab/render.py exactly (anonymous_driver patch, channel="chromium", headless, offline=True, --allow-file-access-from-files). NEVER use page.route (it deadlocks the driver). render.py writes PNGs to .scratch/identity-round2/out/. Read docs/ve/cards/tonal-ab/ab.html and docs/ve/cards/identity-lab/lab.html first and reuse their grain, font loading and layout approach.

Assets (relative file paths from the HTML): fonts in .scratch/tonal-ab/ (Anton-Regular.ttf, DMMono-Regular.ttf, Fraunces-Upright-Variable.ttf). Photos in .scratch/why-ladder/assets/: evo-cover.png, evo-topdown.png, evo-specimens.png, still-timer.png, still-record-phone.png, still-jukebox.png. Use no other photos. No faces, no people, no personal names anywhere.

Locked look: ink #0C1512 with 7% grain, cream #F4EFE4, mint #7EF0C0 (the answer), coral #FF6A4D, butter #FFD84D, lilac #B7A6FF. Anton, Fraunces (SOFT 50, WONK 0), DM Mono. Type on a colour block is always ink. No em dashes, no exclamation marks, British spelling in every label. Labels in DM Mono, small, never touching a rule or the sheet edge. Nothing clipped; every sheet fits its viewport with no scroll overflow.

## Sheet 1 "wordmark-spacing" (2400 x 2000)
Ten W0 spacing variants on grained ink. Show each large (about 1000 px wide). Under it, show it at 200 px wide beneath a sample two-line Anton headline on burnt ink. This is the real social placement: the wordmark sits under the headline on the same left edge, with clear space of about half the wordmark height. Then show it at 110 px wide. Build from the Anton font with exact letter-spacing and word-spacing values, or reuse the W0 path outlines with adjusted advances. Record every value in NOTES.md.
- V1: current W0 as is (baseline).
- V2 tight: tracking about -1%, word space about 0.18 em.
- V3 open: tracking about +6%, word space about 0.35 em.
- V4 optical:
  - word gaps equal to one Anton stem width;
  - slash narrowed, with equal air both sides;
  - UP kerned so the last three characters stop crowding at small sizes (the known W0 weakness).
- V5 slash breathes: normal tracking, extra air around the slash only.
- V6 two lines: MAKE YOUR over MIND/UP, left aligned, tight leading (about 0.92).
- V7 two lines, no word spaces: MAKEYOUR over MINDUP, with UP in mint and no slash.
- V8: MAKE YOUR MIND over a much larger mint UP, left aligned.
- V9 horizontal lockup: D mark left of V4, with a gap of one cap height. Mark height equals cap height plus a hair.
- V10 stacked lockup: D mark above V6, left aligned.

Give each variant a one-line DM Mono caption with its code and key values.

## Sheet 2 "block-finish" (2400 x 2000)
He could not see the old tonal lamp, so make every difference unmistakable.

Layout: four rows (coral, butter, lilac, mint). Each row is a set of large panels (about 520 x 420), each with a two-line ink Anton line. Split each panel so its left 30% stays plain flat for comparison.

Treatments:
- F0: flat.
- F1: flat with visible grain on the colour (about 12%, the same feTurbulence grain as ink).
- F2 strong lamp: radial, about a 30% white hotspot at top centre, falling to about 12% black at the bottom corners, same hue throughout.
- F3: strong lamp plus grain.
- F4 strong vertical sweep: about 22% white at the top to 14% black at the bottom.

Rules:
- No hue shifts, no multi-colour gradients, no gradient text.
- Ink #0C1512 must hold at least 4.5:1 contrast at every point where text sits. Reduce a treatment's darkening for a colour if needed, and say so.
- Put the computed minimum and maximum ink contrast for each colour and treatment in NOTES.md as a table.

## Sheet 3 "show-art-s1" (2400 x 1800)
Six S1 podcast cover variants. Show each as a 700 px square with its own 150 px and 56 px reductions beside it.

S1 = a full-bleed photo burning into ink (a vertical photo-to-ink fade, the only gradient allowed), with the D mark and W0 on the ink.

Vary:
- photo: use all six photos across the variants;
- burn depth: about 35%, 45% and 60%;
- arrangement:
  - V4 on one line, lower left;
  - V6 on two lines, lower left;
  - V10 stacked lockup, lower left;
  - V9 horizontal lockup;
  - one with the D mark large and W0 smaller.

The name must still be recognisable at 56 px. Caption S1a to S1f with photo, burn depth and arrangement.

## Sheet 4 "show-art-s3" (2400 x 1800)
Six S3 type-only cover variants, in the same 700/150/56 layout.
- Grounds: mint, coral, butter, lilac, one on grained ink (cream type with mint UP), and one more of your choosing.
- Type on colour is ink.
- Compositions:
  - the name in three huge lines filling the width;
  - the name set so large it bleeds off the right edge;
  - the D mark as the hero, with W0 small beneath;
  - V6 on two lines filling the width;
  - V8 with the giant UP;
  - grain on the colour for one of them.
- No extra copy, except that at most two variants may carry the approved brand line "Who gets paid. What's real. Where the pitch and the product part ways." in Fraunces.
- Caption S3a to S3f.

An ink wordmark on a colour block is a proposal, not yet a rule (the current floor says the wordmark sits on ink only). Note that in NOTES.md.

## NOTES.md
Include:
- one short paragraph per sheet;
- what each variant tests;
- the spacing values;
- the contrast table;
- how to run it: python docs/ve/cards/identity-round2/render.py from the worktree root.

Static-check what you can: HTML parses, every asset path exists, SVGs are valid, contrast maths holds. Finish with:
- the files written;
- the sheet names render.py produces;
- anything you could not verify.
