---
card: ve-card-1-format-master
kind: engine_core
model: gpt-6.1-sol
effort: medium
max_minutes: 50
max_calls: 45
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-card-1-format-master
write_allow: [apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/layouts/**, apps/renderer/src/engine/audio.tsx, apps/renderer/src/engine/index.ts, apps/renderer/src/Root.tsx, apps/renderer/src/engine/engine.test.ts, fixtures/ve/engine-core/**]
read: apps/renderer/src/engine/props.ts, apps/renderer/src/engine/clock.ts, apps/renderer/src/engine/devices/types.ts, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/v2/MindmakeStory.tsx (lines 330-470 only: trimBefore and Audio patterns)
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# FormatMaster: the one composition every ve cut renders through

## Goal
Build FormatMaster, the single Remotion composition that renders any EngineRenderProps (props.ts) in 9:16 or 16:9 on one clock, plus the five layouts and the audio track. No per-piece code, ever.

## Contract
1. `FormatMaster.tsx` exports `FormatMaster(props: EngineRenderProps)`. Call `useEngineFrame()` from `./clock` exactly once here (the only frame read in the engine) and pass `frame` down. Render, in order:
   (a) a full-bleed `tokens.ink` background;
   (b) every `segments[]` entry as `<Sequence from={fromFrame} durationInFrames={durationFrames}><OffthreadVideo src trimBefore={trimBeforeFrames} muted/></Sequence>`, cropped by `crop` when given;
   (c) for each beat, a `<Sequence>` over its frames that lays out `beat.uses` objects in the layout's slots, in order, via `DEVICES[object.device]` from `./devices/registry`. Throw `Error('ve: no device <id>')` if one is missing.
   (d) `<BrandFrame props beat frame/>` from `./BrandFrame` over every beat;
   (e) `<EngineAudio/>`.
2. `layouts/index.ts` exports `slotsFor(layout, aspect): Box[]` for P1 (full-frame plate plus one HUD slot), P3 (60/40: graphic slot above the plate in 9:16, left in 16:9), P6 (picture-in-picture card at 40-45% width, radius 40), F1 (full-frame plate plus two overlay slots) and F3 (full-frame graphic slot).
   - Tall slots keep key content inside X 120-888, Y 288-840.
   - Wide slots keep content inside title-safe 96, 54, 1824, 1026.
   - Author both aspects separately; never scale one into the other.
3. `audio.tsx` exports `EngineAudio({audio})`: one `<Audio src={stem.src} trimBefore={stem.trimBeforeFrames}/>` from frame 0, plus each sfx as `<Sequence from={atFrame}><Audio src volume={10**(gainDb/20)}/></Sequence>`.
4. In `Root.tsx`, add `VeFormatMasterTall` (1080x1920) and `VeFormatMasterWide` (1920x1080), both 30 fps, with `calculateMetadata` that zod-parses the props with `EngineRenderPropsSchema` and sets `durationInFrames`. Touch nothing else in `Root.tsx`.
5. `index.ts` re-exports `FormatMaster`, `slotsFor` and `EngineAudio`.
6. `engine.test.ts` (vitest, no rendering) checks that:
   - `slotsFor` keeps every tall slot inside the safe box and every wide slot inside title-safe;
   - parsing `fixtures/ve/engine-core/props.json` (a minimal 2-beat voiceover cut you write) succeeds;
   - `FormatMaster` throws on an unknown device.

## Acceptance (every command must exit 0 inside your sandbox)
Sandbox note: your sandbox may not reach node_modules, so `npx tsc` or `vitest` may not start. If so, do not install anything, do not change config and do not retry: write the code carefully to the contract, check it by reading, and say so in open_questions. Claude runs every acceptance command outside the sandbox.

npx tsc --noEmit
npx vitest run apps/renderer/src/engine/engine.test.ts

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-card-1-format-master", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
