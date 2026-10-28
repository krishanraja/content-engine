---
card: ve-docs-1-engine
kind: docs
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-docs-1-engine
write_allow: [docs/ve/ENGINE.md, docs/ve/RUNBOOK.md, docs/ve/HANDOFF-2026-10-27.md, .claude/skills/ve/SKILL.md, .agents/skills/ve/SKILL.md]
read: docs/ve/**, scripts/ve.py, scripts/velib/*.py, config/ve/**, apps/renderer/src/engine/devices/CONTRACT.md, apps/renderer/src/engine/devices/registry.ts, .claude/skills/ve/SKILL.md, tests/ve_*.py
never: NOW.md, WORKBENCH.md, docs/plans/**, docs/history/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow
---

# Make the ve docs and skill match what the engine does today, and write the RUNBOOK

## Ground truth (read it, never recall it)
Run `python scripts/ve.py -h` and `python scripts/ve.py <cmd> -h` for every command. Read `config/ve/{budget,devices,invariants,tools}.json`, `config/ve/formats/*.json`, `scripts/velib/*.py`, `apps/renderer/src/engine/devices/registry.ts`. Facts to reflect (verify each in code):
- `ve ledger <piece>` and `ve ledger <piece> add <kind> <n>`, and `ve time <piece> start|stop|status`, exist, with caps from `budget.json` (60 engine min, 3.3M Claude tokens, 2.1M Codex tokens, 12.6M total, 1.2 allowance points).
- compile refuses a verb the device does not draw (`config/ve/devices.json`); test_grid draws `carry`.
- props travel as ASCII escapes; render corrects AAC priming and prints lag and residual.
- QC runs OCR with tesseract and the pinned ffmpeg n8.1.2 (`. scripts/ve-env.sh`).
- `ingest`, `stills` and `file` are still placeholders (exit 2); sfx kits are absent so compile reports `sfx_missing`.

## Tasks
1. `docs/ve/ENGINE.md`: update the pieces table, the CLI block (copy the real command list and flags), the protocol, the budget table (add the caps above and the 1 h engine-time target) and the rules. Keep it <= 8 KB (it is loaded into every session pack; the pack limit is 36 KB). Delete nothing true; fix or remove anything stale.
2. `docs/ve/RUNBOOK.md` (new, <= 5 KB): the step-by-step a producing session follows to finish a piece in under 1 hour of engine time after recording. One numbered step per protocol step S0-S8, each with the exact command, its expected output or exit code, who runs it, and a time budget in minutes; budgets sum to <= 60. Include: starting and stopping the clock, logging tokens with `ve ledger`, the stop rules (refuse past a cap; at 80% stop and ask), when to dispatch a Codex card (new hero device only, with `--piece`), never reading big files, images or logs (use the QC JSON and one contact sheet), and the fix-loop limit of 2.
3. `docs/ve/HANDOFF-2026-10-27.md`: add a first line `> Superseded by docs/ve/STATUS.md and docs/ve/RUNBOOK.md; kept for history.` Change nothing else.
4. `.claude/skills/ve/SKILL.md`: update to the same facts, link `docs/ve/RUNBOOK.md`, keep the frontmatter valid and the file within 1 KB of its present size. Then copy it **byte for byte** to `.agents/skills/ve/SKILL.md`.

## Acceptance
python scripts/validate-skills.py
python scripts/ve.py -h
python -c "import pathlib;a=pathlib.Path('.claude/skills/ve/SKILL.md').read_bytes();b=pathlib.Path('.agents/skills/ve/SKILL.md').read_bytes();assert a==b"
python -c "import pathlib;assert pathlib.Path('docs/ve/ENGINE.md').stat().st_size<=8192 and pathlib.Path('docs/ve/RUNBOOK.md').stat().st_size<=5120"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-docs-1-engine", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
