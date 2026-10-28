---
card: ve-card-7-compile-render
kind: engine_core
model: gpt-6.1-sol
effort: medium
max_minutes: 55
max_calls: 50
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-card-7-compile-render
write_allow: [scripts/velib/compile.py, scripts/velib/render.py, scripts/ve.py, apps/renderer/scripts/ve-render.mjs, tests/ve_compile_test.py, fixtures/ve/my-test-19s/words.frames.json]
read: packages/contracts/src/production-spec.ts, apps/renderer/src/engine/props.ts, fixtures/ve/my-test-19s/spec.json, fixtures/ve/my-test-19s/script.words.json, scripts/ve.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# ve compile and ve render

## Goal
Turn a linted spec plus word timings into EngineRenderProps (frames on one clock), and render it through FormatMaster. These are the two commands between lint and qc.

## Contract
- **compile.py: `compile_cut(spec, cut_id, words, assets_dir) -> dict`** matching `EngineRenderPropsSchema`.
  - `words` is `[{w, onset_s}]` on the dialogue master's clock. A frame is `round(onset_s * 30)`.
  - Beat `fromFrame` is the onset of its `span.from_w`. Beat `toFrame` is the next beat's `fromFrame`, or the end of the last word plus 12 frames.
  - Event `atFrame` is the onset of `at_w`.
  - Objects take `fromFrame`/`toFrame` from their persist beats.
  - Caption pages: 2-5 words, breaking at punctuation. `swipeIndex` comes from `cuts.captions.emphasis`.
  - Tokens are resolved from `config/studio.json` (the makeyourmindup theme `house_style`) and the series colour, never hard-coded.
  - `sectionBeat` is true on the first beat.
  - Write the output to `docs/plans/<piece>/ve/props.<cut>.json` and print its sha256.
- **render.py: `render(props_path, out_mp4, scale=1.0)`** runs `node apps/renderer/scripts/ve-render.mjs`. That script bundles `apps/renderer/src/index.ts`, selects `VeFormatMasterTall` or `VeFormatMasterWide` by aspect, and calls `renderMedia` (h264, crf 18, 30 fps), with `--scale` for proofs.
- **Wiring.** Replace the `not_yet` handlers in `ve.py` for `compile` and `render` with these (keep `ingest`, `stills`, `ledger` and `file` as `not_yet`).
- **Tests.** `tests/ve_compile_test.py` compiles `fixtures/ve/my-test-19s` using `words.frames.json` (derive it from `script.words.json`: onset minus 225.80 s). It asserts:
  - every event frame equals its word's frame;
  - beats are contiguous;
  - the output validates through `npx tsx packages/contracts/scripts/check-spec.ts` (the spec) and a zod parse of the props (`node -e` with tsx).

## Acceptance (every command must exit 0 inside your sandbox)
Sandbox note: your sandbox may not reach node_modules, so `npx tsc` or `vitest` may not start. If so, do not install anything, do not change config and do not retry: write the code carefully to the contract, check it by reading, and say so in open_questions. Claude runs every acceptance command outside the sandbox.

python tests/ve_compile_test.py
npx tsc --noEmit

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-card-7-compile-render", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
