ve card habits-device-1 for 2026-11-17-tue-habits (device): photo_plate, a full-bleed picture plate

Build one new library device for the ve renderer, `photo_plate`, so a voiceover short can show a real photo, a real video clip or a generated still full-bleed behind the captions. The format voice-led-pictures names a picture-plate device it never had; this is it. Claude orchestrates and checks; you build. Never render, assemble, trim, caption, mix or file a cut. Never publish, push or commit (leave the working tree changes for Claude to review). Network is off.

Read first: apps/renderer/src/engine/devices/CONTRACT.md (the device contract: follow it exactly), apps/renderer/src/engine/devices/registry.ts, config/ve/devices.json, apps/renderer/src/engine/devices/film_frame/ and evidence_card/ (how media src and EngineImageSchema are handled, how a mint ring region is drawn), apps/renderer/src/engine/devices/verbs.test.ts, config/ve/brand-tokens.json, lab/styles/swiss-kinetic/STYLE.md (the picked motion style: Swiss grid, kinetic type; the plate must sit inside it, never fight it).

Write only: apps/renderer/src/engine/devices/photo_plate/{index.tsx,schema.ts,state.ts,fixture.json,device.test.ts}, one entry in apps/renderer/src/engine/devices/registry.ts, one entry in config/ve/devices.json, and the device's row wherever verbs.test.ts or a registry test requires a device to be listed (find them; change nothing else).

What it draws:
- One picture, `image` (EngineImageSchema: src, pixelWidth, pixelHeight) or one muted clip `video` ({src, pixelWidth, pixelHeight, trimBeforeFrames default 0}), exactly one of the two. Media src is relative to the piece's assets folder, resolved the way evidence_card resolves its src.
- Fit by COVER into the layout box (scale to the larger of box.w/pw and box.h/ph, then crop the middle, or around `focus` {x,y} fractions of the picture, default centre). Never stretch: the drawn picture keeps its own aspect ratio at every frame. Write the cover maths as a pure exported function in state.ts and test it: for a 1024x1536 still into 1080x1920 and a 1920x1080 clip into 1080x1920, the drawn width/height ratio equals the picture's own ratio to 1e-6 and the box is fully covered.
- A slow camera on the picture from `enter` to `exit`: `push` (0 to 0.12, default 0.05) scales up linearly in time towards `focus`; nothing else moves (no wobble, no rotation, no parallax tricks). Use progress()/drift() from ../clock only; no Math.random, no frame modulo.
- `scrim`: 0 to 0.6 (default 0), a flat ink overlay over the whole picture (tokens only; no gradients), so captions read over a busy photo.
- `regions`: a record of named rectangles in fractions of the PICTURE ({x,y,w,h}); the `mark` verb with to_state = a region name draws a mint ring (stroke, rounded, drawn on over 0.35 s with the house curve) around that region, staying locked to the same picture pixels as the push moves. `mark` to_state `none` clears it.
- `source` (optional): a provenance line set in IBM Plex Mono 28 px cream on a small ink chip at the bottom-left of the safe area (outlet and date, e.g. "IIHS · small overlap test"), for real photos and footage only. A generated still never carries a label.
- Verbs: enter (to_state visible: a hard cut in, or with to_state `wipe` a mask wiping up from the bottom over 0.45 s), mark, exit (cut out, or `wipe` down over 0.35 s).
- Both aspects (9:16 1080x1920 and 16:9 1920x1080) work from `box`.
- Colours from tokens only; no raw hex anywhere.

Acceptance (run all, all must pass):
cd apps/renderer && npx vitest run src/engine/devices/photo_plate src/engine/devices/verbs.test.ts
npm run typecheck --workspace apps/renderer   (or `npx tsc --noEmit -p apps/renderer` if that script does not exist)
python3 scripts/ve.py doctor   (no new FAIL)

Reply with the files changed and the acceptance output's last lines. Claude reviews the diff and renders golden stills; your report is not proof.
Good work; Claude reviewed the diff. One addition to photo_plate, same rules, same files only:

Add the verb `move` (add it to config/ve/devices.json's photo_plate verbs and to the device). `move` with to_state = a region name re-aims the camera on the word it fires: over 0.4 s with the house enter curve, the crop's centre travels to that region's centre and the scale steps up so the region fills at least 55% of the box's shorter side (never more than 1.6x the cover scale, never showing outside the picture: clamp the crop inside the picture at every frame). The slow `push` keeps running on top from there. Several `move`s in a row chain from wherever the camera is. `mark` rings stay locked to picture pixels through every move. Put the camera maths in state.ts as pure functions and test: (1) the crop never leaves the picture for any region in a 1024x1536 still at 1080x1920, including a region at a corner; (2) the drawn aspect equals the picture's own aspect at every frame; (3) two moves chain without a jump (the crop at the frame the second move starts equals the crop the first move settled on).

Acceptance, as before:
cd apps/renderer && npx vitest run src/engine/devices/photo_plate src/engine/devices/verbs.test.ts
npx tsc --noEmit -p .   (from the repository root; zero errors)
Reply with the files changed and the acceptance output's last lines.
