# iso_world

STAGE device. Cells are integer [column, row] pairs on a shared 2:1 diamond grid.
Blocks have unique cells and ids. Heights are in storeys. Optional short labels
are pinned above blocks. Evidence pictures reference keys in params.images;
each entry has src, pixelWidth and pixelHeight. Logos remain upright.
Numerical source data belongs in object.dataset; its producer label is drawn.

Event toState values:

- enter: any nonempty string; lands the ground and resets the system.
- add: block id; one actor drops on its named cue.
- fill: JSON {"id":"source","height":2}; grows that block.
- carry: route id; follows its cells by distance and holds at its endpoint.
- move: block id; slides the orthographic view without rotating it.
- highlight: block id; mint emphasis and a short height pulse.
- exit: any nonempty string; blocks sink in reverse arrival order.

All events use engine clock timing. Space add cues by at least dropFrames to
keep one dropping actor at a time. drawCanvas accepts decoded pictures keyed
by image src, supplied by the caller. SVG loads the same evidence paths.
The fixture uses geometry-only blocks; evidence-path rendering is tested
separately. Automated still checks compare SVG output, not raster pixels;
raster and at-speed creative review remain with verify-card.
