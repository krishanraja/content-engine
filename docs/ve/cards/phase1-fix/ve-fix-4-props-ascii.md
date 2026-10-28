---
card: ve-fix-4-props-ascii
kind: pipeline_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 30
max_calls: 30
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-fix-4-props-ascii
write_allow: [apps/renderer/scripts/ve-render.mjs, apps/renderer/src/engine/transport.ts, apps/renderer/src/engine/transport.test.ts, apps/renderer/src/Root.tsx, apps/renderer/src/engine/FormatMaster.tsx]
read: apps/renderer/scripts/ve-render.mjs, apps/renderer/src/Root.tsx, apps/renderer/src/engine/FormatMaster.tsx, apps/renderer/src/engine/props.ts
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, changing any device or chrome file
---

# Non-ASCII props arrive as mojibake; rendered audio lags by AAC priming

## Evidence (27 Oct proof renders)
- Every "·" that comes from props data (the chip text, the producer label, the evidence outlet) renders as "Â·".
- A "·" written inside a device's own TSX source renders correctly in the same font.
- The props JSON on disk is correct UTF-8, and ve-render.mjs reads it as `'utf8'`.

So the bytes are re-read as Latin-1 somewhere between `renderMedia({inputProps})` and the page. That is inside Remotion, so fix it at our boundary.

## Contract
1. **New module `apps/renderer/src/engine/transport.ts`.** It is pure, with no imports beyond types.
   - `toAsciiProps<T>(value: T): T` deep-copies the value. Every string has each code unit above 0x7E replaced by the literal six-character escape `\uXXXX` (lowercase hex). Every literal backslash first becomes `\u005c`.
   - `fromAsciiProps<T>(value: T): T` reverses the escaping exactly.
   - Both functions leave numbers, booleans, null, arrays and object keys untouched.
2. **ve-render.mjs:** pass `toAsciiProps(inputProps)` to every place `inputProps` reaches Remotion (`selectComposition`, `renderMedia`, any still call), after staging.
3. **The compositions registered in Root.tsx:** run `fromAsciiProps` once on the incoming props before `EngineRenderPropsSchema` parsing and before `FormatMaster`. Do this both in `calculateMetadata` and in the component, so Studio previews with plain props still work: `fromAsciiProps` on a string with no escapes is the identity.

4. **AAC priming.**
   - Evidence: the rendered mp4's audio lags the stem by a constant 42.6 ms, which is 2048 samples (two AAC frames of encoder delay, not trimmed). `ve qc` sync.av_xcorr fails at 40 ms in every segment.
   - In ve-render.mjs, after `renderMedia`, add a correction step:
     - decode the first 10 s of the render's audio and of `props.audio.stem.src` at 48 kHz mono;
     - cross-correlate them within ±200 ms to find the lag in samples;
     - when |lag| > 48 samples, rewrite the file with `ffmpeg -i raw.mp4 -c:v copy -af atrim=start_sample=<lag>,asetpts=PTS-STARTPTS -c:a aac -b:a 320k out.mp4`. Use the ffmpeg already on PATH; never re-encode video;
     - re-measure, and throw if the residual is more than 1 ms;
     - print the lag found and the residual.
   - Put the pure lag-finder in `transport.ts` as `lagSamples(rendered: Float32Array, stem: Float32Array, maxLag: number): number` and unit-test it with a synthetic signal shifted by 2048 samples.

## Tests (transport.test.ts)
- Round trip for "SAME WORK PROMPT · ONLY THE COUNTRY CHANGES", "KRISH'S TEST · 23 OCT", "Sorry, that’s beyond", an emoji (surrogate pair), a literal backslash, and a string that already contains the text `\u00b7`.
- Every string produced by `toAsciiProps` is pure ASCII.
- Nested arrays and objects survive, and numbers are unchanged.

## Acceptance (every command must exit 0; if your sandbox cannot reach node_modules, say so in open_questions and Claude re-runs them outside)
npx tsc --noEmit
npx vitest run apps/renderer/src/engine/transport.test.ts

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fix-4-props-ascii", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
