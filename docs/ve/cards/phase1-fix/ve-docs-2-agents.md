---
card: ve-docs-2-agents
kind: docs
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-docs-2-agents
write_allow: [AGENTS.md, CLAUDE.md, NOW.md, docs/AGENTS-REFERENCE.md]
read: AGENTS.md, CLAUDE.md, NOW.md (its first 80 lines and any ve mention), docs/ve/ENGINE.md, scripts/ve.py
never: WORKBENCH.md, docs/plans/**, docs/history/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow
---

# Trim AGENTS.md to <= 12 KB without losing a rule, and bring the ve facts current

## Why
AGENTS.md is 38 KB and loads into every Codex and Claude session, so it is a recurring token cost. Krish's standard: AGENTS.md <= 12 KB, nothing lost.

## Tasks
1. Move **verbatim** every section of AGENTS.md that is reference rather than a rule every session needs (long tables, histories, per-station detail, examples, step lists) into the new `docs/AGENTS-REFERENCE.md`, under the same headings. AGENTS.md keeps: the canonical-harness block, hard rules and non-negotiables, file routing, the video-production route, the verify and commit rules (a `Closeout:` line, exactly one `- North Star check (...)` line, never `--auto`), and a short index linking each moved section by heading. Moved text must be byte-identical.
2. The AGENTS.md video section says: video is made with `python scripts/ve.py` (read `docs/ve/ENGINE.md`, follow `docs/ve/RUNBOOK.md`); one signed spec; no per-piece compositions or render scripts; ve has no publish verb; Codex builds devices from cards; the quick-edit path stays the fallback until ve passes Phase 3; local runs use `. scripts/ve-env.sh`. Verify each claim in code.
3. CLAUDE.md: the same facts, within 0.5 KB of its present size; point to AGENTS.md instead of duplicating it.
4. NOW.md: add one dated line (28 Oct 2026) to the existing ve entry (or the status area if none): Phase 1 engine merged with cards 1-7, status in `docs/ve/STATUS.md`. Do not reformat or trim NOW.md.

## Second attempt: how to reach 12 KB (the first try stopped at 14.3 KB)
- AGENTS.md is mostly untitled bold-lead paragraphs under a few headings, so split by **paragraph**, not by heading. The "North Star" heading alone holds 18 KB of rules prose.
- Keep in AGENTS.md only: the North Star block up to `<!-- north-star:end -->`, the ownership ruling, the start route, one-line forms (bold lead sentence only) of each rule that every session needs, the video route, verify and commit rules. Move **every other paragraph whole** (domain detail: posts, Drive, music, workbench, Codex-on-Windows, canon, Studio) to `docs/AGENTS-REFERENCE.md`, replacing it in AGENTS.md by its bold lead sentence plus ` (detail: docs/AGENTS-REFERENCE.md#<anchor>)`. Target 10-11 KB.
- Before moving anything, `grep -rn "AGENTS.md" tests scripts .github packages --include=*.ts --include=*.py --include=*.yml` and keep in AGENTS.md every string a check asserts. Run `npm run`-free checks only; Claude runs the repo checks.
- Write the files even if you are unsure; Claude measures and fixes the last bytes. Do not stop without writing.

## Acceptance
python -c "import pathlib;assert pathlib.Path('AGENTS.md').stat().st_size<=12288"
python scripts/validate-skills.py
Claude runs the lossless check (every old non-blank AGENTS.md line appears in AGENTS.md or docs/AGENTS-REFERENCE.md, at most 12 exceptions, each reported by you in open_questions with the reason).

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-docs-2-agents", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
