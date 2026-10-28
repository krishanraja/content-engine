---
card: ve-fix-6-budgets
kind: pipeline_fix
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-fix-6-budgets
write_allow: [scripts/velib/ledger.py, scripts/ve.py, config/ve/budget.json, tests/ve_ledger_test.py]
read: scripts/ve.py, scripts/velib/common.py, scripts/velib/cards.py, config/ve/invariants.json, packages/contracts/src/production-spec.ts, tests/ve_cards_test.py
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow, changing compile.py or render.py (another card edits compile.py)
---

# `ve time` and `ve ledger` refuse to proceed past their caps

Krish's standard: a piece costs under 1 hour of engine time after recording, with very low Claude token use. Today `ledger` is a placeholder that returns exit 2.

## Data
1. New `config/ve/budget.json`:
   `{"engine_minutes_cap": 60, "claude_tokens_cap": 3300000, "codex_tokens_cap": 2100000, "total_tokens_cap": 12600000, "allowance_points_cap": 1.2, "warn_fraction": 0.8}`
2. A piece's ledger is the append-only file `<piece_dir>/ve/ledger.jsonl` (`piece_dir` from `velib.common`). One JSON object per line: `{"ts": "<UTC ISO-8601>", "kind": ..., "amount": <number>, "note": "<text>"}`. `kind` is one of `claude_tokens`, `codex_tokens`, `allowance_points`, `credits`, `engine_seconds`, `krish_wait_seconds`. Never rewrite or delete lines.

## New module `scripts/velib/ledger.py`
- `add(piece, kind, amount, note="")`: validates kind and a finite non-negative amount; appends.
- `totals(piece) -> dict`: the sum per kind, plus `total_tokens` (claude + codex).
- `check(piece) -> (ok: bool, lines: list[str])`: compares totals with budget.json. A cap is **over** when strictly exceeded; at or above `warn_fraction` of a cap the line starts `WARN`; over starts `OVER`. Engine time compares `engine_seconds / 60` with `engine_minutes_cap`.
- `require_within(piece)`: raises `SystemExit` with the OVER lines when `check` is not ok. A piece with no ledger file is within budget (all zeros).
- Timer helpers: `start_clock(piece, phase)` writes `{"kind": "clock_start", ...}`-style lines **only through a separate file** `<piece_dir>/ve/clock.json` (`{"phase": ..., "started": "<UTC ISO>"}`) so ledger.jsonl keeps the kinds above; `stop_clock(piece)` reads it, appends one `engine_seconds` line (rounded to whole seconds, note = phase), and deletes clock.json. Starting while a clock runs, or stopping with none, is an error that names the running phase.

## CLI (scripts/ve.py)
Replace the `ledger` placeholder; keep `ingest`, `stills` and `file` as placeholders.
- `ve ledger <piece>`: prints one line per measure ("claude tokens 1.2M / 3.3M (36%)", engine time in minutes, Codex tokens, allowance points, credits, Krish-wait minutes) and the OK/WARN/OVER lines. Exit 1 when over.
- `ve ledger <piece> add <kind> <amount> [--note TEXT]`: appends, then prints the same report.
- `ve time <piece> start <phase>`, `ve time <piece> stop`, `ve time <piece> status`: status prints the running phase and minutes used against the cap. `start` is refused (exit 1) when engine time is already over the cap. `stop` appends the elapsed seconds.
- `dispatch` gains optional `--piece <piece>`; with it, `require_within(piece)` runs before dispatching. Without it behaviour is unchanged.
- `render` and `compile` stay untouched in this card (a later card wires them).
- All commands accept `-h` and print real help text.

## Tests (tests/ve_ledger_test.py, unittest, uses a temp dir for the piece)
Empty ledger is within budget; totals sum per kind; WARN at 80%; OVER above the cap and exit 1 from the CLI function; invalid kind and negative or NaN amounts are refused; start/stop clock appends engine_seconds and removes clock.json; double start is refused; `start` refused when over the cap; ledger lines are never rewritten (file only grows).

## Acceptance (every command exits 0)
python tests/ve_ledger_test.py
python tests/ve_cards_test.py
python scripts/ve.py ledger --help
python scripts/ve.py time --help

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-fix-6-budgets", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
