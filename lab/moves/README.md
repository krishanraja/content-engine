# The moves library

A move is one motion that says one thing: a count, a drop, a before-and-after, people, a place. Timing is fixed by
the move (its vitals). The look comes from the style and the brand skin. Any style calls it, timed to the words
that cue it. Krish, 2026-11-10: "build the moves library".

- `<id>/move.json`: what it says (number, contrast, list, quote, evidence, process, timeline, before-after, person,
  place), what it needs (text, number, screenshot, footage, face), energy, engine (canvas or three), its code, and
  the approved cut it was proved in.
- `<id>/move.mjs`: `draw(g, t, p)` for a 2D move (canvas), `update(meshes, t, p)` for a 3D one (three.js).
  - `p.c` holds the skin colours and `p.e` the house easings.
  - `p.times` holds the cue times in seconds.
  - Every frame is a function of t alone.
- `index.json`: every move there is, lab moves and the ve engine's devices together (`config/ve/devices.json`).
  `node lab/moves/check.mjs` keeps it valid; `--write` rewrites it.
- `gallery.mjs`: every 2D move looping in one grid
  (`NODE_PATH=$(npm root -g) node lab/moves/gallery.mjs OUT.mp4`).

The first 16 were lifted out of The Ladder and The Living Screen, unchanged: both styles now call them, and their
frames are pixel-identical to before (12 stills each compared by PSNR, all infinite, on 11 Nov 2026).

ve reaches these moves through one package: card `ve-style-0-three-and-moves` (`docs/ve/cards/styles-3d/`) moves them to
`packages/moves/`, which both the lab and the renderer import, so a device built for The Ladder or The Living Screen
calls the same move the lab cut was approved with.
