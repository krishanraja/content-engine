---
card: ve-e-3-phone-stage
kind: device
format: hand-held-screen
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-e-3-phone-stage
write_allow: [apps/renderer/src/engine/kit/*, apps/renderer/src/engine/devices/hand_phone_stage/*, apps/renderer/src/engine/devices/registry.ts, apps/renderer/src/engine/props.ts, packages/contracts/src/production-spec.ts, config/ve/devices.json, config/ve/formats/hand-held-screen.json, tests/ve_phone_stage_test.py]
read: apps/renderer/src/engine/**, docs/ve/design/formats/ref/H/*, docs/ve/design/formats/H-anatomy.md, assets/plates/hand-held-screen/*, config/ve/design-lock.json, config/ve/formats/hand-held-screen.json
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, Math.random, useCurrentFrame in a device, raw hex colours, svg with overflow:visible inside the glass plane (it hangs headless Chromium), editing files under assets/
---

# hand_phone_stage: the real hand and phone, one camera that never cuts

## Why
Format H's stage is one real phone in one real hand on a real-world plate. The camera pushes, rolls and re-frames; the UI lives ON the glass in perspective. Reference: `ref/H/build.py` (`homography`, `matrix3d`, `Cam`, `Screen`, `ui_clip`, `fit_bg`, `f1()..f5()`), `ref/H/index.html`, `H-anatomy.md` sections 2 and 6. Port, do not re-derive.

## Contract
1. `kit/homography.ts` (pure): `homography(src, dst)` (8x8 solve, no dependency) and `matrix3d(h)` printing 8 decimals exactly like the Python. `kit/camera.ts`: `Cam {k, rot, tx, ty}` with `p2c`, `c2p`, `css()` and `lerpCam(a, b, t)`. `kit/phoneGlass.ts`: constants (plate 941x1672, glass 352x720, the four quad corners from `assets/plates/hand-held-screen/quad.json`), `Screen` (`u2p`, `u2c`, `css()`, `quadC`) and `uiClipPath()` (port of `ui_clip`, rounded corners, plate px).
2. Parity vectors (the tests assert these to 1e-6, taken from the Python):
   - cam `(1.8, -3.0, -78.7, 535.9)`: `Screen.css()` = `matrix3d(0.48566510,0.09329935,0.00000000,-0.00006900,-0.19396267,0.47665805,0.00000000,-0.00006731,0.00000000,0.00000000,1.00000000,0.00000000,235.83583886,50.24915899,0.00000000,1.00000000)`; glass corners in canvas px (350.0,604.0) (953.8,687.9) (604.5,2008.2) (-40.4,1853.0).
   - cam `(1.95, -104.5, -197.2, 1648.3)`: `matrix3d(0.44830625,0.08612248,0.00000000,-0.00006369,-0.17904247,0.43999204,0.00000000,-0.00006213,0.00000000,0.00000000,1.00000000,0.00000000,235.83583886,50.24915899,0.00000000,1.00000000)`; corners (-217.5,1178.5) (-258.8,519.4) (1218.2,605.1) (1192.7,1323.1); `p2c(0,0)` = (-197.2,1648.3).
   - `c2p(p2c(x,y))` returns (x,y) for several points.
3. `kit/glassRegistry.ts`: `GlassKind` registry mapping a kind id to a React component `(props: {frame, sinceFrames, tokens, params, k}) => JSX` drawn in glass units; register one built-in kind `blank` (an `inkSoft` glass with a faint `mint` glow). Card ve-e-4 adds the real kinds.
4. Device `hand_phone_stage` (full-canvas STAGE slot). Verbs: `enter`, `move`, `fill`, `exit`. Params: `{cameras: {[id]: {k, rot, tx, ty, backdrop: 'cotton'|'cotton_flip'|'hardware', bg?: {k, x, y, rot}}}, start: id, glass: {[kind]: object}}`.
   - Z-order, back to front: ink ground; backdrop plate (`bg` placement if given, else cover the canvas) drifting at 0.35x the camera translation; ink scrims top and bottom; the glass UI plane (div of `GW*k` x `GH*k` px, `transform: matrix3d(...)`, `clipPath: uiClipPath()`, `transform-origin: 0 0`) holding the current glass kind; the hand-and-phone plate (`phone-bezel.png`) above it; `phone-glass.png` sheen over the glass (omit when the glass kind is `footage`). All of it inside one world div carrying `Cam.css()`.
   - `move` (toState = a camera id): interpolate the previous camera to the new one over 18 frames with `HERO`; the backdrop cross-fades over 12 frames when it changes. `fill` (toState = a glass kind) swaps the glass content (cross-fade `MOTION.enterFrames`). The glass plane is rebuilt with the CURRENT interpolated camera's `k` so UI pixels equal canvas pixels at that scale.
   - Ambient: 1.5% scale drift plus a 0.5 degree roll sine (period 90 frames) on the world, pure functions of `frame - object.fromFrame`.
   - Load plates the way `engine/BrandFrame.tsx` loads brand images (follow it, no new path scheme); a missing plate throws, never renders blank.
5. `config/ve/formats/hand-held-screen.json`: add `cameras` with the five approved camera states for beats `open, result_a, result_b, evidence, verdict`, values read from `ref/H/build.py` `f1()..f5()` (after `safe()` and `fit_bg()`; the table in `H-anatomy.md` section 2 is the cross-check). Drop `hand_phone_stage` from `pending_devices`; leave the rest.
6. Register the device (`registry.ts`, `config/ve/devices.json` verbs above); add `move` to the verb enums in `props.ts` and `production-spec.ts` (additive; if card ve-e-1 already added `draw`, keep it).

## Tests and acceptance (every command exits 0)
`phone.test.ts`: the parity vectors; `homography` maps the unit rectangle onto the quad; port `check_cover` and assert the five cameras leave no canvas corner uncovered (F4's declared plate edge excepted). `device.test.ts`: nothing renders before `enter`; at a `move` the camera is the old one at +0 and the new one at +18, monotone between; `fill` swaps the glass kind; markup holds the current `matrix3d(` and no `overflow:visible` or `#` colour; all five cameras render. `tests/ve_phone_stage_test.py`: the format JSON has five cameras with `k` 1.8, 1.9, 2.1, 1.95, 1.55 and rot -3, -10, -1, -104.5, -8; compile accepts `move` and `fill` for this device only.
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false
python tests/ve_phone_stage_test.py
python tests/ve_stage_test.py

## Return
Final message only JSON per config/ve/task-result.schema.json (`card`, `files_changed`, `commands`, `open_questions`). If vitest is blocked (EPERM) say so. Stop after two failed attempts at the same acceptance command and report it.
