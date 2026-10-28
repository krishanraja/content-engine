---
card: ve-e-4-glass
kind: device
format: hand-held-screen
model: gpt-6.1-sol
effort: medium
max_minutes: 45
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-e-4-glass
write_allow: [apps/renderer/src/engine/kit/glass/*, apps/renderer/src/engine/kit/glassKinds.ts, apps/renderer/src/engine/kit/glassRegistry.ts, apps/renderer/src/engine/devices/hand_phone_stage/*, tests/ve_glass_test.py]
read: apps/renderer/src/engine/**, docs/ve/design/formats/ref/H/build.py (f1 to f5, strip, prov, pennant), docs/ve/design/formats/ref/H/index.html, docs/ve/design/formats/H-anatomy.md, docs/ve/design/formats/H-motion.md, config/ve/design-lock.json, apps/renderer/src/engine/devices/evidence_card/index.tsx
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, Math.random, useCurrentFrame, raw hex colours, svg overflow:visible inside the glass plane, redrawing or retyping the real recording
---

# Glass contents: what the phone shows in each beat of format H

## Why
`hand_phone_stage` (card ve-e-3) draws the hand, the phone and an empty glass plane in perspective, with a registry of glass kinds (`kit/glassRegistry.ts`, one built-in `blank`). This card adds the four real kinds from `H-anatomy.md` and `ref/H/build.py`. Glass components draw in glass units where one unit equals one canvas pixel at the current camera scale `k`, so type stays at its true size (30 px minimum) at any zoom.

## Kinds (register each in `kit/glassKinds.ts`; props `{frame, sinceFrames, tokens, params, k}`)
1. `prompt` (beat open; `H-motion.md` F1): a mono chip `SAME WORK PROMPT · ONLY THE COUNTRY CHANGES` (Plex Mono 30, +0.09em, mint outline), the prompt card (Archivo 33/500, cream on ink soft, `params.lead`), and the slot reel: `params.active` then `params.next` country words in Anton 84 UPPERCASE, `ACTIVE` mint, `NEXT` dimmed, rolling from active to next with a mask over 12 frames at `params.rollAt` (frames since the fill event). Keep the first `30*k + 20` px free for the notch.
2. `cards` (beats result_a, result_b): brutal cards (square, 2 px cream border, hard 10 px shadow, no blur), one per `params.cards[]` = `{name, flags: [{station, planted}], score?}`. Names Archivo 900 stretch 112%, 34..46 px; a pennant per station (planted: mint flag on a cream pole, drops 40 px and rotates -12 to 0 over `MOTION.dropFrames`, SLAP; bare: pole with a dashed ghost); the score is Anton 136 (150 for a lone 0 or 1) and ticks with a slap when `params.scoreAt` frames pass. Port `pennant` from `build.py`. The 3x2 result is never a table: cards with flags, not rows with cells.
3. `footage` (beat evidence): the REAL recording, `params.src` (image or video, same loading as `devices/evidence_card`), placed unmodified in the glass rotated 90 degrees clockwise (so the camera roll to -104.5 degrees makes it upright), `<img>`/`<Video>` only, never redrawn or retyped, with no sheen over it and a hole in the grain. `params.underline` `{x, y, w}` in recording pixels is exposed so a scribble can be placed through the same transform (export a helper `footagePointToCanvas`).
4. `bubble` (beat verdict): the refusal bubble: `params.label` (Plex Mono 30, mint, UPPERCASE) over `params.quote` (Archivo 44/600 cream, up to 4 lines) in an ink-soft card with a 2 px cream border, entering with `ENTER` over 12 frames. Quote text is data, verbatim.

## Rules
Colours from tokens only (no `#`, no `rgb(`). No `overflow:visible` svg. No text under 30 px (units are canvas px at scale `k`; pass `k` into sizes). Every kind is a pure function of its props. `hand_phone_stage` must pass the current camera `k` and `sinceFrames` since the `fill` event into the component; keep its public params unchanged and only extend `device.test.ts` with new cases (do not delete tests).

## Tests: `kit/glass/glass.test.ts` (vitest, SSR to static markup like the existing device tests)
- each kind throws on a missing required param and renders at frames 0, 5 and 30;
- `prompt`: the reel shows `active` before `rollAt` and `next` after; font sizes scale with `k` and are never below 30 px when `k = 1`;
- `cards`: a planted flag appears only after its drop frame; the score is the number given; no `<table>` and no cell borders;
- `footage`: the markup contains the source element with a rotate(90deg) transform and no text nodes; `footagePointToCanvas` agrees with `Screen.u2c` from `kit/phoneGlass.ts` to 1e-6;
- `bubble`: the quote renders verbatim, 44 px;
- all five H beats render through `hand_phone_stage` with `fill` events without throwing.
`tests/ve_glass_test.py`: the four kind ids are registered in `kit/glassKinds.ts`; existing tests pass.

## Acceptance
npx vitest run apps/renderer/src/engine
node node_modules/typescript/bin/tsc --noEmit --pretty false
python tests/ve_glass_test.py
python tests/ve_phone_stage_test.py

## Return
Final message only JSON per config/ve/task-result.schema.json (`card`, `files_changed`, `commands`, `open_questions`). If vitest is blocked (EPERM) say so. Stop after two failed attempts at the same acceptance command and report it.
