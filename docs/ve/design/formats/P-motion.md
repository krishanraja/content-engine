# TWO PASSPORTS · motion notes (mind.the.gap module, 1080x1920, 30 fps, about 20 s)

## Governing idea

One table, one camera, two passports. Every AI holds two: where its company was born and where it lives. The module treats them as two real paper passports dealt onto the same ink table. The camera dives into passport 1 (BORN), turns to passport 2 (LIVES), then lets both pages fold down into two paper tabs while the mint stitching and ribbon become mind.the.gap's own device: two threads on a time axis that bend and meet at the test and end in a dated call. Stamps are the only verdicts and always slap; the mint scribble is the human hand pointing at the one thing that matters in that beat; everything else slides, wipes or draws on. The ribbon that ties the two passports in frame 1 is the same mint thread that becomes the gap in frame 4, so the viewer has already seen the metaphor before it is named.

## Timeline (600 frames)

| beat | frames | content |
|---|---|---|
| F1 title | 0 to 114 | TWO PASSPORTS |
| F2 born | 114 to 234 | passport 1 stamped |
| F3 lives | 234 to 354 | passport 2 (sample, blank) |
| F4 gap | 354 to 486 | threads bend and meet |
| F5 verdict | 486 to 600 | dated call and sample result |

Frame numbers below are local to the beat (f0 = first frame of the beat). Each beat's last 6 to 18 frames are the hand-off into the next.

## Tokens used

- ENTER: 400 ms = 12 f, cubic-bezier(0.05, 0.7, 0.1, 1)
- EXIT: 200 ms = 6 f (the brief gives only the duration; I use cubic-bezier(0.4, 0, 1, 1))
- STAGGER: 3 f between siblings
- SLAP: 5 f. Keys: f0 scale 1.55 and 10 degrees off its resting tilt, opacity 0; f1 scale 1.30, opacity 0.7; f2 scale 1.00 (impact, the paper dips 0.5% and the camera takes a 5 px shake that decays over f2 to f5); f3 scale 0.965 (squash); f4 scale 1.012; f5 rest at its design tilt. The stamp is multiplied into the paper, so the grain shows through as it lands.
- HERO: cubic-bezier(0.16, 1, 0.3, 1) for page moves and camera dives
- DRAW-ON (scribbles, threads): stroke-dashoffset from path length to 0 over 10 f (scribbles) or 18 to 30 f (threads), ENTER curve. While a scribble is drawing, 3 hand-wobble variants of the path swap every 2 f (line boil, plus or minus 1.5 px); once drawn the boil drops to 1 px and keeps going.
- AMBIENT (nothing fully stops): 1.5% drift. Pages float plus or minus 3 px on a 0.4 Hz sine, the ground rosette turns 3 degrees across the beat, the stitched thread shimmers (dash offset creeps 6 px per second), grain re-seeds every 2 f.

## F1 · TWO PASSPORTS (title beat), 114 f

Scribble: a hand-drawn curly brace (mint 8 px, 17 px ink keyline) over the pair of passports. It points at "these two, together". Drawn left tip to right tip over f56 to f66, overshooting the right tip by 6 px, then settling.

1. f0 to f12, ground fade-up: the ink table and the printed rosette fade from black (ENTER). Light bands slide 40 px across the felt over the whole beat (parallax, 0.3x).
2. f2 to f14, swipe wipe: the coral highlighter behind TWO wipes left to right through a skewed mask (ENTER). At f8 to f13 the word TWO slaps from scale 1.12 to 1 (SLAP).
3. f10 to f49, kinetic type: PASSPORTS rises letter by letter from a mask line, 60 px up, STAGGER 3 f per letter, nine letters (ENTER each).
4. f20 to f34, dek: the three Fraunces lines slide up 24 px and fade in, STAGGER 3 f.
5. f24 to f44, page deal: passport 1 rises from below (260 px, HERO, 20 f); passport 2 follows 6 f later from 300 px, HERO. Their cast shadows grow as they land (blur 0 to 80 px).
6. f36 to f52, ribbon unspool: the mint ribbon draws down the gap between the pages (dash-offset, 16 f, HERO); the swallow-tail cut appears on the last 2 f.
7. f46 to f51 and f52 to f57, sticker drops: BORN then LIVES (STAGGER 6 f). Each drops from 40 px above at 14 degrees off tilt and slaps to its tilt (-6 and +4 degrees); the hard shadow grows from 0 to 5 px on impact.
8. f56 to f66, scribble draw-on (above).
9. Camera, whole beat: push-in 100% to 103% (ease-out). Parallax by depth: ground 0.6x, pages 1.0x, title 1.0x, ribbon 1.2x (it sits highest above the table).
10. Ambient: page float, ribbon sways 4 px, stitched thread shimmer, grain.

Hand-off to F2, f96 to f114: the camera dives into passport 1. The whole scene scales 1.0 to 2.04 about the top-left corner of passport 1 and translates up 180 px (HERO, 18 f), so the 440 px page becomes the 900 px page of F2. The title and dek exit up (EXIT, 6 f from f96); passport 2, the ribbon and the stickers slide out right with the scale. Cut point: the page edge lands at x 72, y 432.

## F2 · BORN, 120 f

Scribble: a hand-drawn loop around the CHINA stamp (the odd one out). A rounded-rectangle spiral, mint 8 px with ink keyline, starting top left, 1.12 turns, growing 3% so the end overlaps the start. Draws over f56 to f66.

1. f0 to f8, dive settles: the page overshoots to 102% and relaxes to 100% (HERO). The mint stitch along the spine snaps to rest.
2. f4 to f24, kinetic type: BORN rises letter by letter, STAGGER 3 f, 4 letters (ENTER).
3. f14 to f26, dek: three lines slide up 20 px, STAGGER 3 f.
4. f18 to f23, sticker drop: PASSPORT 1 OF 2 drops onto the page corner (SLAP) at +4 degrees. A counter inside it ticks 0 to 1 over f20 to f26 (the "1").
5. f26 to f31, stamp 1: the USA stamp slaps (SLAP) at -5 degrees with the camera shake. At f32 to f38 its flag fades up from multiply, printed on the paper (ENTER, 6 f delay).
6. f44 to f49, stamp 2: the CHINA stamp slaps at +3 degrees, STAGGER of 18 f after stamp 1, with a bigger shake (7 px). Its flag fades up at f50 to f56.
7. f56 to f66, scribble draw-on around CHINA (above). The USA stamp dims to 70% on f56 to f62 so the loop owns the eye.
8. Camera (ENTER curve stretched over the 120 f beat): push-in 100% to 102.5%; page parallax 0.5x against the headline 1.0x; the rosette on the table turns 1.5 degrees.
9. Ambient: page float, stitch shimmer, grain.

Hand-off to F3, f102 to f120: the page turns. Passport 1 slides left out of frame (EXIT, 6 f) while passport 2 slides in from the right (HERO, 14 f). A mint wipe line runs left to right along the leading edge (the stitched spine of the incoming page), so the cut reads as turning to the other passport. The headline BORN exits up (EXIT).

## F3 · LIVES, 120 f

Scribble: a double hand-drawn underline beneath the DeepSeek `???` (the blank). Mint 8 px with keyline; first pass left to right over f70 to f76, second pass f73 to f80, 3 f stagger.

1. f0 to f14, the page arrives from the right (HERO). Behind it the hardware plate in the header band drifts down 40 px to rest (parallax 0.4x), which sells depth.
2. f4 to f22, kinetic type: LIVES rises letter by letter (STAGGER 3 f, ENTER).
3. f16 to f28, dek: three lines slide up, STAGGER 3 f.
4. f20 to f25, sticker drop: PASSPORT 2 OF 2 (SLAP) at -5 degrees; counter ticks 1 to 2.
5. f30 to f46, ghost stamps: the dashed outline of stamp A traces itself (dash-offset around the perimeter, 12 f), then the `???` slaps lightly (SLAP, 3 px shake, "no ink, only a question"). The flag slot hatching wipes in diagonally.
6. f46 to f62, the same for stamp B (DeepSeek), STAGGER of 16 f.
7. f58 to f63, the SAMPLE sticker slaps across both stamps (SLAP, 10 degrees off to -6, 6 px shake). It is the loudest move in the beat on purpose: it is the honesty label.
8. f70 to f80, scribble draw-on (above).
9. Camera: push-in 100% to 102%; dashed outlines keep marching (dash offset, 8 px per second) so the blank never feels finished.
10. Ambient: page float, stitch shimmer, grain.

Hand-off to F4, f100 to f120: the two pages fold into tabs. Page 2 scales to the 328 x 318 right tab and its stamp carries over (HERO, 16 f); at the same time a ghost of page 1 (from F2) scales into the left tab with its CHINA stamp. The right-edge stitch detaches and becomes the dashed coral thread, and the sticker and headline exit (EXIT).

## F4 · THE GAP, 132 f

Scribble: a hand-drawn measure arrow between the two tabs (end tick, double-headed shaft, end tick), mint 8 px with keyline. It points at the empty space itself: the gap. Left tick f38 to f41, shaft with both heads f41 to f48 drawn outward from the centre, right tick f46 to f48.

1. f0 to f16, tabs settle: the folded pages land as the two tabs (HERO); their stamps keep their tilt.
2. f6 to f24, headline: THE wipes up from a mask line; GAP follows with the coral swipe drawing left to right through the skewed mask (ENTER, STAGGER 6 f).
3. f20 to f32, dek: two lines slide up, STAGGER 3 f.
4. f18 to f36, threads draw on: the solid coral thread (BORN) draws from the tab knot to the meeting point over 18 f (HERO) while it bends, its control points moving from straight down to the funnel curve; the dashed coral thread (LIVES) starts 3 f later, and its dashes march (dash offset) even before it finishes drawing.
5. f32 to f37, sticker drop: THE GAP (SLAP) at -4 degrees between the tabs.
6. f38 to f48, measure arrow (above).
7. f40 to f52, knot: the mint dot scales 0 to 1.3 to 1 (6 f overshoot); a ring pulses outward and fades (12 f); THE TEST label slides in from the left (ENTER).
8. f50 to f80, rope: the cream and coral threads twist together down the axis to the end dot (30 f, HERO) while the camera pans down 120 px, so the next passport (page for F5) enters from the bottom.
9. f60 to f70, THE CALL label and the end dot pop (SLAP).
10. Camera and ambient: the thread layer pans 1.2x against the tabs 1.0x and the ground 0.5x; the rosette turns 1.5 degrees; the rope twist advances 8 px per second.

Hand-off to F5, f116 to f132: the rising passport slides up to its resting top edge (HERO, 14 f) while the tabs, threads and knot exit up (EXIT, 6 f). The rope's end dot is carried up with the page and is covered by the dated-call sticker when it slaps on in F5.

## F5 · THE VERDICT, 114 f

Scribble: a hand-drawn loop around 0/1 (the one number that moved). Rounded-rectangle spiral, mint 8 px with ink keyline, draws over f44 to f54.

1. f0 to f14, the page rises into place (HERO) as the hand-off completes. THE VERDICT rises letter by letter, STAGGER 3 f, ten letters (ENTER).
2. f12 to f24, dek: two lines slide up, STAGGER 3 f.
3. f20 to f25, stamp A slaps (SLAP, -2.5 degrees). Its numerals count 0/0 to 2/2 over f20 to f32 (tabular figures).
4. f34 to f39, hero stamp slaps (SLAP, +2 degrees, the biggest shake of the module: 9 px over 4 f, with a 2 f page dent). Its numerals tick 1/1 down to 0/1 over f36 to f42: the number falls as the answer is deleted.
5. f44 to f54, scribble draw-on (above).
6. f50 to f62, the evidence card slides up from beneath the hero stamp (ENTER); the quote types in at 2 characters per frame (about 35 f), and a 3 f flicker at the start shows the answer being swapped.
7. f70 to f75, dated-call sticker: DUE 2027-03 / 70% SURE slaps over the page corner (SLAP, from +14 to +4 degrees). Its "70%" counts up from 0 over f72 to f84.
8. f90 to f114, hold with ambient drift. Camera push-in 100% to 103% over the whole beat. The stamps keep a 1 px ink bleed.
9. Last 6 f (f108 to f114): EXIT, a dip to ink that hands back to the host piece.

## Notes for the build

- Every slap is the same 5-frame curve. Only the tilt and the shake distance change, so the system reads as one hand with one stamp.
- All hand-offs are camera or page moves, never a cross-dissolve. The only dissolves are grain and ground at the very start and end.
- The caption zone (x 72 to 972, y 1180 to 1500) never carries a stamp, scribble or sticker; only page, thread and ground continue behind it.
- With reduced motion on, every beat holds its key frame as drawn here (the PNGs).
