---
card: ve-e-2-overlays
kind: device
format: hand-held-screen
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-e-2-overlays
write_allow: [apps/renderer/src/engine/kit/*, apps/renderer/src/engine/devices/headline/*, apps/renderer/src/engine/devices/sticker/*, apps/renderer/src/engine/devices/stamp/*, apps/renderer/src/engine/devices/stat_strip/*, apps/renderer/src/engine/devices/marquee/*, apps/renderer/src/engine/devices/registry.ts, config/ve/devices.json, tests/ve_overlays_test.py]
read: apps/renderer/src/engine/**, apps/renderer/src/house/**, docs/ve/design/formats/ref/H/index.html, docs/ve/design/formats/ref/H/build.py, docs/ve/design/formats/H-anatomy.md, docs/ve/design/TEMPLATE.md, config/ve/design-lock.json, apps/renderer/src/engine/devices/CONTRACT.md
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, raw hex or rgb colours in a device, Math.random, useCurrentFrame in a device, blurred box-shadows, font sizes under 30 px (28 only for the ILLUSTRATION tag), any change to the five existing devices
---

# Overlay devices: headline, sticker, stamp, stat_strip, marquee

## Why
Every approved frame is a hero object plus overlays: the loud headline, stickers, verdict stamps, a mint stat strip, a marquee. They are the brand's kit of parts, drawn from `docs/ve/design/TEMPLATE.md` and measured in `H-anatomy.md` (sections 2 to 4) and `ref/H/index.html` (the CSS). Today there are no such devices, so a spec could only use the old widgets that Krish rejected. Reuse `apps/renderer/src/house/components.tsx` (`Swipe`, `Sticker`, `SectionPill`, `MonoLabel`, `Grain`) and `kit/lock.ts` from card ve-e-1 (zones and thresholds; if it is not on your branch, create the same file with the constants you need and keep it identical to the lock JSON). Every device draws in absolute canvas pixels on the STAGE layout (full-canvas `box`) and takes colours from `tokens` only.

## Devices (each in `devices/<id>/` per `CONTRACT.md`: index.tsx, schema.ts, state.ts, fixture.json, device.test.ts)
1. `headline` verbs `enter`, `exit`. Params `{lines: string[1..2], swipe?: {line, word}, dek?: string, at?: {x,y,w}}` (default: the lock's headline zone). Anton, UPPERCASE, line-height 0.88, size = the largest in 150..240 px that fits the zone width (use `engine/fit.ts`); the one swiped word is an ink word on a `tokens.channel` block skewed 8 degrees with a 14 px halftone dot pattern (CSS radial-gradient, no image). Dek: Fraunces italic, 42..46 px, line-height 1.16, cream, beside a one-word headline or under a longer one (as `H-anatomy.md` says). Never tilted. Enter: lines slide up 24 px and fade with `ENTER`, 3-frame stagger per line.
2. `sticker` verbs `enter`, `exit`. Params `{text, tiltDeg: -8..5, at: {x,y}, tone: 'channel'|'cream'}`. Plex Mono 600 at 30 px+, UPPERCASE, pill, 2 px ink border, hard 5 px offset shadow (no blur), ink type on the colour block. Enter: drops from 60 px above over `MOTION.dropFrames`, rotation settling from tilt+12 to tilt.
3. `stamp` verbs `stamp`, `exit`. Params `{kind: 'outline'|'block'|'dashed', top?: string, main: string, tiltDeg: -6..6, at: {x,y,w,h}, leader?: {to: {x,y}, label?: string}}`. Plex Mono 700, UPPERCASE, tracking 0.18em, 3 px border; `block` is a `tokens.channel` block with ink type; `outline` is a cream outline with cream type; `dashed` is a dashed outline for unknowns. `leader` is a thin cream line from the stamp to an ink dot with a cream ring on the part (a verdict is on a PART, never a person). Slap: scale 1.25 to 1 over `MOTION.slapFrames`, opacity 0 before the `stamp` event.
4. `stat_strip` verbs `enter`, `count_to`, `exit`. Params `{label: string, numeral: string, unit?: string, at?: {x,y,w}}` (default: the lock's lower_line). A `tokens.mint` block, ink type: Plex Mono label 30 px +0.14em UPPERCASE left, Anton numeral 94..100 px right. The resting numeral may be `?`; `count_to` changes it with a slap. Rises 56 px on enter. Show `dataset.producerLabel` if the object has a dataset (see `CONTRACT.md` rule 5).
5. `marquee` verbs `enter`, `exit`. Params `{items: string[], at?: {y,h}}` (default: the lock's marquee zone, full width). `tokens.channel` band, ink Plex Mono 600 30 px, items separated by `TickerStar`, scrolling left at a constant speed that is a pure function of `frame - object.fromFrame` (no modulo of the raw frame: use progress arithmetic on a long strip). Decoration only.

## Kit invariants (write them as one helper in `kit/` and call it from every device test)
Render each device's React element tree to static markup (`react-dom/server`) at a settled frame and assert: no `blur(` and no `box-shadow` with a non-zero blur radius; every font-size >= 30 px; font families only from `HOUSE_FONTS`; every colour is one of the passed tokens (no `#`, no `rgb(`); Anton text is uppercase; `headline` has no `rotate` in its transform while `sticker` and `stamp` stay within their tilt ranges; `stamp` border is 3 px; nothing positioned outside the 1080x1920 canvas; before the first event nothing visible.

## Tests and acceptance (every command exits 0)
Each device test checks state before and after its verbs, the brand invariants above, and that text longer than the zone is shrunk (headline) rather than overflowing. `tests/ve_overlays_test.py` (unittest): `config/ve/devices.json` lists the five devices with exactly the verbs above and compile accepts each verb only for its device; existing tests pass.
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false
python tests/ve_overlays_test.py
python tests/ve_qc_modules_test.py

## Return
Final message only JSON per config/ve/task-result.schema.json: {"card": "ve-e-2-overlays", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}. If the sandbox blocks vitest (spawn EPERM) say so in open_questions; Claude re-runs it. Stop after two failed attempts at the same acceptance command and report it in open_questions.
