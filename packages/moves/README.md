# Shared house moves

Plain ES modules consumed by the style lab and ve. Import a move through
`@mymu/moves/<id>/move.mjs` in bundled code. The file-based lab imports the
same module by relative path, so Chromium needs no package resolver.

Canvas moves expose `draw(ctx, t, params, tokens)`. Three.js moves expose
`update(parts, t, params, tokens)`; `parts` is the move's existing array of
scene meshes/groups. Time `t` and `params.times` are in seconds. Callers
convert supplied engine frames to seconds. No move reads a clock.

The fourth argument supplies the colour tokens. Existing lab callers may
continue supplying `params.c`; it is the default for the fourth argument.
Easing functions remain explicit in `params.e`. Layout, datasets, textures,
and event-derived times remain caller-owned. Helpers and the inventory are
exported as `_kit.mjs` and `index.json`. No build step or runtime dependencies.

`lab/moves/<id>/move.mjs` is a compatibility re-export, never a second copy.
`node lab/moves/check.mjs` imports every implementation and checks both
inventories; `--write` regenerates them from the lab metadata and device bank.

The engine freeze guard uses the directory `packages/moves`: its walker
recurses directories rather than expanding glob expressions.
