---
card: ve-fix-2-compile
kind: pipeline_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 50
max_calls: 50
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-fix-2-compile
write_allow: [scripts/velib/compile.py, scripts/velib/render.py, scripts/ve.py, apps/renderer/scripts/ve-render.mjs, tests/ve_compile_test.py, docs/ve/ENGINE.md]
read: scripts/velib/compile.py, scripts/ve.py, apps/renderer/src/engine/chrome/CaptionTrack.tsx, apps/renderer/src/engine/props.ts, scripts/velib/lint.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, edits outside write_allow, editing cmd_qc or the qc subparser in scripts/ve.py (another card owns them)
---

# Compile, render and CLI fixes from the independent review

## Goal
`ve compile` and `ve render` must refuse anything Phase 1 cannot draw truthfully. Whatever they accept must render without a runtime error.

## Contract
1. **Lint first.**
   - `cmd_compile` and `cmd_render` call `velib.lint.lint(spec_path)` before anything else.
   - Any problem: print each line, exit 1, and write nothing.
2. **Only used objects.** Emit an object only if a beat of this cut lists it in `uses`. Persist-range checks apply only to those objects.
3. **Word ends.**
   - Every word row needs `end_s` (a float, at least its onset). Otherwise raise `ValueError('words need end_s ...')`.
   - `durationFrames = frame(last end_s) + 12`, before any ending.
4. **Ending.**
   - Applies to a whole cut (`excerpt` false) whose spec has `call`.
   - Emit `ending: {fromFrame: frame(last end_s) + 12, url: series.site}`.
   - Add `ENDING_FRAMES = 105` to `durationFrames`.
   - The last caption page ends at `ending.fromFrame`.
   - Excerpt cuts get no ending.
5. **Caption pages fit.**
   - Mirror CaptionTrack's width measure in Python exactly: same constants, with a comment citing the file. Use it so that every page wraps to at most 2 lines.
   - Keep the rest of the current rules: 2–5 words, prefer punctuation boundaries, no one-word orphan unless the word alone fills a line.
   - A single word wider than one line raises `ValueError` naming the word.
6. **Refuse what Phase 1 cannot draw.**
   - A beat whose `plate.source` is not `take` or `none`: `ValueError('... asset plates arrive in Phase 2')`.
   - A used object whose params reference a generated asset: `ValueError` (the generated assets pipeline is not wired yet).
7. **Sound effects.**
   - If `config/ve/sfx-kits/<audio.sfx_kit>.json` exists, with the shape `{"<name>": {"path": "...", "gain_db": -6}}`, emit `audio.sfx: [{src, atFrame, gainDb}]` for every compiled event with `sfx`. `src` resolves under the assets folder.
   - Otherwise emit `[]` and report the missing event ids.
   - `ve compile` writes `compile.<cut>.json` next to the props: `{"lint": "clean", "sfx_missing": [...], "props_sha256": "..."}`.
   - `ve status` adds the blocking reason `sfx kit missing` when `sfx_missing` is non-empty.
8. **Sources stay contained.**
   - `source()` refuses http(s) URLs.
   - It refuses absolute paths and any path that resolves outside the assets folder.
9. **Render checks media.** Before rendering, every spec asset that has `sha256` and is staged must hash to that value. Otherwise refuse and name the asset.
10. **ENGINE.md.** The CLI section matches the real `ve.py` commands and flags exactly. Remove `--proof` and `--all` unless you implement them.

## Tests (tests/ve_compile_test.py, unittest)
- Lint refusal blocks compile.
- An unused object is not emitted.
- A missing `end_s` raises.
- Duration uses `end_s`.
- A whole cut with a call gets an ending and 105 extra frames; an excerpt gets none.
- Every page of `fixtures/ve/my-test-19s` fits 2 lines under the mirrored measure.
- Twelve long words paginate without error, and one over-wide word raises.
- An asset plate raises.
- A kit present produces sfx entries; a kit absent gives `[]` plus `sfx_missing`.
- `source()` refuses `../x`, `C:/x` and `https://x`.
- A sha mismatch refuses render. Unit-test the checker function only; do not render.

## Acceptance (every command must exit 0 inside your sandbox)
python -m unittest tests/ve_compile_test.py

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fix-2-compile", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": [...]}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
