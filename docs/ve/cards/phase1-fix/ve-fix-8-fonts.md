---
card: ve-fix-8-fonts
kind: pipeline_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 30
max_calls: 30
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-fix-8-fonts
write_allow: [config/ve/fonts.json, scripts/ve.py, scripts/velib/fonts.py, tests/ve_fonts_test.py]
read: scripts/ve.py, scripts/velib/common.py, config/ve/brand-tokens.json, apps/renderer/src/house/fonts.css, assets/fonts/makeyourmindup/**
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, any change to apps/renderer (the engine keeps loading its fontsource faces), editing or deleting the font files
---

# Make the brand fonts a permanent, offline, hash-checked asset

## Why
The four makeyourmindup faces live in Krish's Drive brand kit (`H:\My Drive\Ventures\Active Ventures\makeyourmindup\1 Brand kit (permanent)\fonts`). CI, Codex sandboxes and other machines cannot see Drive, so design mocks pulled fonts from the network and nothing proved the right files were in use. Claude has already copied the kit's files (OFL licensed) into `assets/fonts/makeyourmindup/`: Anton-Regular.ttf, Archivo-Variable.ttf, Fraunces-Italic-Variable.ttf, IBMPlexMono-{Regular,Medium,SemiBold,Bold}.ttf and OFL-*.txt. Do not edit them.

## Contract
1. `config/ve/fonts.json`: `{"source": "<kit fonts folder path above>", "dir": "assets/fonts/makeyourmindup", "families": [{"role": "display|structure|dek|data", "family": "...", "files": [{"file": "...", "weight": "...", "style": "...", "sha256": "<computed from the real file>"}], "license": "OFL-<name>.txt"}]}`. Roles match `type_roles` in `config/ve/brand-tokens.json` (display Anton, structure Archivo, dek Fraunces italic, data IBM Plex Mono). Compute the sha256 values by running a script over the real files; never invent them.
2. `scripts/velib/fonts.py`: `check() -> (ok, lines)` verifies every file exists, its sha256 matches, and each family's license file exists and is non-empty; `css(rel_dir) -> str` returns `@font-face` rules (local `src: url('<rel_dir>/<file>')`, `font-display: block`, Archivo with `font-weight: 100 900` and `font-stretch: 62% 125%`, Fraunces `font-style: italic` weight range, Plex Mono at each weight) under the family names `MYMU Anton`, `MYMU Archivo`, `MYMU Fraunces`, `MYMU Plex Mono`, so a mock or tool can use the exact kit files; `sync(kit_dir, update_manifest=False)` copies from the kit folder when it exists, refusing (exit 1, naming the file) when a kit file's hash differs from the manifest unless `update_manifest=True`, which rewrites the hashes.
3. `scripts/ve.py`: new `ve fonts check`, `ve fonts css [--rel PATH]`, `ve fonts sync [--from DIR] [--update-manifest]` (default `--from` is the manifest's `source`; if it is absent say so and exit 1). `ve doctor` gains a hard check `brand fonts` that runs `check()` and a soft (WARN) check that the Drive kit folder is reachable. Keep every existing doctor row.
4. `tests/ve_fonts_test.py` (unittest): manifest hashes match the real files; all four roles present and matching `brand-tokens.json`; license files exist; `css()` names all four `MYMU` families and every file in the manifest; `sync` from a temp copy of the folder succeeds and from a temp copy with one byte changed is refused and names the file; `check()` fails when a file is removed from a temp copy. Also assert every `font-family` name `apps/renderer/src/house/fonts.css` declares for the four roles is one of `MYMU Anton`, `MYMU Archivo`, `MYMU Fraunces`, `MYMU Plex Mono` (the engine and the mocks share the same family names).

## Acceptance (every command exits 0)
python tests/ve_fonts_test.py
python scripts/ve.py fonts check
python scripts/ve.py doctor
python scripts/ve.py fonts css --rel ../../assets/fonts/makeyourmindup

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fix-8-fonts", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
