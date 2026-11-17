# iso_world

STAGE device. Cells are integer [column, row] pairs on a shared 2:1 diamond grid.
Blocks have unique cells and ids. Heights are in storeys. Optional short labels
are pinned above blocks once they land, drawn last on an ink edge so no block
hides one. Evidence pictures reference keys in params.images; each entry has
src, pixelWidth and pixelHeight. A picture is set on the plane of a face nothing
in the scene stands in front of (the lit left face, else the right face): its
verticals stay upright and only its horizontals follow the 2:1 slope.
Numerical source data belongs in object.dataset; its producer label is drawn.

Event toState values:

- enter: any nonempty string; lands the ground and resets the system.
- add: block id; one actor drops on its named cue.
- fill: JSON {"id":"source","height":2}; grows that block.
- carry: route id; follows its cells by distance and holds at its endpoint.
- move: block id; slides the orthographic view without rotating it.
- highlight: block id; mint emphasis and a short height pulse.
- exit: any nonempty string; blocks sink into their own cells in reverse
  arrival order (a base never leaves the ground).

Framing: the view is fitted once, to the height each block will reach after its
fills, and centred. A tall frame fits inside x 60 to 860 and y 270 to 1080 (above
the house caption box at y 1090); a wide frame inside the middle 90% of the box.
One light from the upper left: lit top, half-lit left face, shaded right face.

All events use engine clock timing. Space add cues by at least dropFrames to
keep one dropping actor at a time. drawCanvas accepts decoded pictures keyed
by image src, supplied by the caller. SVG loads the same evidence paths.
The fixture uses geometry-only blocks; evidence-path rendering is tested
separately. Automated still checks compare SVG output, not raster pixels;
raster and at-speed creative review remain with verify-card.
