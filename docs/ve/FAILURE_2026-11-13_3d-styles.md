# Failure note: the 3D style test cuts (13 Nov 2026)

## What was asked

Land The Ladder and The Living Screen as ve styles through Codex cards, then render one test cut per style on
Krish's house test take (voice only, full-screen style, no face) for his yes or no.

## What shipped

- Both devices were built, checked and merged: `ladder_stage` (krishanraja/content-engine#547) and `living_screen`
  (#584), with the framing fix (#608) and a count fix (#620: counts show only the decimals their sources carry).
- Two 54 s 9:16 cuts on the take: one small 3D set held in a 590 px band, a plain three-word caption box under
  it, the bottom 40% of the frame empty, about one device event per spoken beat (roughly every 5 s), and a near-still
  camera.
- It took about three days, mostly to fixes, checks and renders that were lost when the container restarted (each
  render wrote its file only at the end).

## His verdict (Krish, 13 Nov 2026, exact words)

"no, these are both terrible. the captions should be decoupled from the animation styles, these captions are boring
and not active enough. The motion design is terrible, the use of the screen space is terrible, the motion is 10X too
slow, not immersive and engaging at all."

## Why it failed (observed)

1. **Captions are not a layer of their own.** Every style shares one house caption box (`kit/lock.ts`). A style
   cannot bring active captions, and captions cannot be chosen apart from the style.
2. **Motion was paced to the script's beats, not to a cut density.** One event per beat (about every 5 s) is far
   below short-form pace. Nothing measured events per second.
3. **Screen space was spent on safety, not the picture.** The set was fitted into a small safe box between the
   number and the captions; most of the frame was empty.
4. **Judged from stills, never at speed.** The review was contact sheets every 2 s and single frames. Nobody
   watched either cut at speed beside a professional reference before it went to Krish.
5. **Slow renders hid the problem.** 3D in software WebGL (4 cores, no GPU) ran at about 150 frames per 5 min, so
   each look took hours to see. Whole-file renders died on container restarts; chunked stills
   (`ve-render.mjs --stills` in batches, skipping frames on disk) fixed that.

## What stays

- Both styles stay **work in progress**: `needs_device` stays on both in `config/style-references.json` and
  `apps/renderer/src/engine/kit/motion-profiles.json`, so neither routes to a real piece.
- The devices, their tests, the 3D renderer support and the chunked-still render route stay on main.

## The bar for the next attempt

- Captions are their own swappable ingredient (style, motion, placement), independent of the motion style.
- Every ingredient (captions, motion style, transitions, camera, layout, sound) is modular and chosen per piece.
- Pace and coverage are measured against a professional reference cut (events per second, share of the frame in
  use), not judged by eye from stills.
- Every test cut is watched at speed, beside its reference, before Krish sees it.
- The next session explores and integrates https://github.com/OpenMontageInc/OpenMontage thoroughly toward this.
