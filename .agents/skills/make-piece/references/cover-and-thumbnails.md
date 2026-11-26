# The visual gate

The cover and thumbnails are drawn here with a working headline so the gate can check them; their words are
signed off only after he records (house rule TITLES_AFTER_RECORDING), and they are redrawn then by
thumbnail-designer. Real logos, real pages piled up when the piece is about volume, the house cover as the
Receipt, never his face (`scripts/post-pack/visual_gate.py`). Keep the plan's facts in the repository:
`docs/plans/<plan>/cover-facts.json`, with every logo it draws committed as SVG in `docs/plans/<plan>/logos/`
(git keeps no PNG or JPEG) and its paths relative to the facts (`"logos/<file>.svg"`), so any checkout, a home
computer included, can draw the artwork. Render the covers and the two video thumbnails (house rule
THUMBNAIL_EVERY_SIZE) with the approved cover systems, never freehand (Krish, 26 Nov 2026: "I approve the new
cover thumbnail systems, go"): `python3 scripts/covers/make_covers.py docs/plans/<plan> --out <work
folder>/out`, with every company the piece names in a row or in `"thumbs": {"strip": [...]}`. Read
`docs/ve/cards/library/COVERS-PLAYBOOK.md` and `ART-DIRECTION.md` first. It writes `cover-1200x630.png`,
`thumb-wide-1280x720.jpg`, `cover-1080x1920.png`, `thumb-tall-1080x1920.jpg` and `carousel/slide-01.png` with a
`covers.json` receipt; set `"cover_set"` in post.json to that receipt. A held receipt names what failed. The old
drawer (`scripts/pages/build.py --cover`/`--thumbs`) is retired and runs only with `--legacy`, for an archived
piece.
