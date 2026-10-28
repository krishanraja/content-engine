---
card: ve-docs-3-other
kind: docs
model: gpt-6.1-sol
effort: medium
max_minutes: 40
max_calls: 40
cwd: C:/Users/krish/dev/mindmake/ce-cards/ve-docs-3-other
write_allow: [docs/CONTENT_ENGINE.md, docs/STUDIO.md, docs/MEDIA_STANDARD.md, docs/OPERATIONS.md, docs/DRIVE.md, docs/GLOSSARY.md, docs/CADENCE.md, docs/ENGINE_100X.md, docs/CREATIVE_DIRECTION.md, docs/STYLE_REFERENCES.md, docs/ART_DIRECTOR_REPERTOIRE.md, .claude/skills/make-piece/SKILL.md, .agents/skills/make-piece/SKILL.md, .claude/skills/produce-video/SKILL.md, .agents/skills/produce-video/SKILL.md, .agents/skills/mindmake-video/SKILL.md]
read: the write_allow files, docs/ve/ENGINE.md, scripts/ve.py, scripts/velib/*.py, config/ve/**, docs/REPO_MAP.md
never: NOW.md, WORKBENCH.md, docs/plans/**, docs/history/**, docs/handovers/**, .agents/skills/video-engine/**, git commands, network, MCP tools, publishing, new dependencies, edits outside write_allow
---

# Other repo docs that describe video production: make them current

## Rule
Additive and surgical. For each file that describes how video is produced: (a) fix any sentence that is now false (commands, flags, layouts, devices, QC, gates, dispatch flow); (b) add one short pointer where the file introduces video production: "Video is made with the ve engine (`docs/ve/ENGINE.md`, `docs/ve/RUNBOOK.md`); the quick-edit path stays the fallback until ve passes Phase 3." Do not rewrite, reorder or delete content. Do not touch files that do not describe video production (leave them out of files_changed and name them in open_questions). Never change a rule, number or gate unless the code proves it false.

## How
1. Run `python scripts/ve.py -h` and each subcommand's `-h`; read `config/ve/budget.json` for the caps (60 min engine time, 3.3M Claude tokens, 2.1M Codex tokens, 1.2 allowance points).
2. For each file, grep for video, render, caption, QC, quick-edit, kit.py, make.py, Remotion, cut, export; read around the hits; check each ve claim against `scripts/velib/*.py` and `apps/renderer/src/engine/`.
3. The pairs under `.claude/skills/` and `.agents/skills/` (make-piece, produce-video) must stay byte-identical: edit one, copy to the other. `.agents/skills/mindmake-video` has no Claude twin.

## Acceptance
python scripts/validate-skills.py
python scripts/ve.py -h
python -c "import pathlib;[(pathlib.Path('.claude/skills/%s/SKILL.md'%n).read_bytes()==pathlib.Path('.agents/skills/%s/SKILL.md'%n).read_bytes()) or (_ for _ in ()).throw(SystemExit(n)) for n in ('make-piece','produce-video')]"

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{"card": "ve-docs-3-other", "files_changed": [...], "commands": [{"cmd": "...", "exit_code": 0}], "open_questions": []}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
