from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / ".agents" / "skills"
# Claude Code reads skills from .claude/skills; each entry there is a link to
# the one copy in .agents/skills, which Codex reads.
CLAUDE_SKILLS = ROOT / ".claude" / "skills"
VALIDATOR = Path.home() / ".codex" / "skills" / ".system" / "skill-creator" / "scripts" / "quick_validate.py"
MAX_DESCRIPTION = 1024
BLOCK_SCALAR = re.compile(r"[>|](?:[1-9][+-]?|[+-][1-9]?)?")  # description: > or | and its indicators


def description_of(source: str) -> str:
    """The frontmatter's description: one line, or a folded or literal block
    (description: > or |) of the indented lines under it."""
    if not source.startswith("---\n"):
        return ""
    lines = source[4:].split("\n---", 1)[0].splitlines()
    for at, line in enumerate(lines):
        if not line.startswith("description:"):
            continue
        value = line[len("description:"):].strip()
        if BLOCK_SCALAR.fullmatch(value):
            block = []
            for more in lines[at + 1:]:
                if more and not more[0].isspace():
                    break
                block.append(more.strip())
            return " ".join(part for part in block if part)
        return value
    return ""


def description_problems(skill: Path) -> list[str]:
    """The description rules every skill validator holds (the skill-creator's
    quick_validate.py among them): no angle brackets, and at most 1024
    characters. Checked here too, because CI has no Codex validator."""
    description = description_of((skill / "SKILL.md").read_text(encoding="utf-8"))
    problems: list[str] = []
    if "<" in description or ">" in description:
        problems.append("description has angle brackets (< or >), which the skill validators reject")
    if len(description) > MAX_DESCRIPTION:
        problems.append(f"description is {len(description)} characters, over {MAX_DESCRIPTION}")
    return problems


def local_validate(skill: Path) -> bool:
    source = (skill / "SKILL.md").read_text(encoding="utf-8")
    problems: list[str] = []
    if not source.startswith("---\n"):
        problems.append("missing YAML frontmatter")
    if f"name: {skill.name}\n" not in source:
        problems.append("frontmatter name does not match directory")
    if "description:" not in source:
        problems.append("missing description")
    if "[TODO" in source:
        problems.append("unfinished TODO")
    if not (skill / "agents" / "openai.yaml").exists():
        problems.append("missing agents/openai.yaml")
    if problems:
        print(f"{skill.name}: " + "; ".join(problems), file=sys.stderr)
        return False
    print(f"{skill.name}: local structural validation passed")
    return True


def claude_link_problems() -> list[str]:
    """Every .claude/skills entry must lead to the .agents skill of the same
    name. A checkout without symbolic links (git on Windows with
    core.symlinks off) holds the link as a small file naming its target:
    that passes, with a note, because Claude Code on that checkout will not
    load the skill until links are turned on."""
    if not CLAUDE_SKILLS.is_dir():
        return []
    problems: list[str] = []
    for entry in sorted(CLAUDE_SKILLS.iterdir(), key=lambda p: p.name):
        expected = SKILLS / entry.name
        where = f".claude/skills/{entry.name}"
        if not (expected / "SKILL.md").is_file():
            problems.append(f"{where}: no skill .agents/skills/{entry.name} to lead to")
            continue
        if entry.is_symlink() or entry.is_dir():
            if entry.resolve() != expected.resolve():
                problems.append(f"{where}: leads to {entry.resolve()}, not .agents/skills/{entry.name}")
            elif not (entry / "SKILL.md").is_file():
                problems.append(f"{where}: has no SKILL.md")
            else:
                print(f"{where}: leads to .agents/skills/{entry.name}")
        elif entry.is_file():
            target = entry.read_text(encoding="utf-8").strip().replace("\\", "/")
            if target != f"../../.agents/skills/{entry.name}":
                problems.append(f"{where}: is a file, not a link to ../../.agents/skills/{entry.name}")
            else:
                print(f"{where}: a link this checkout holds as a plain file; Claude Code here will not load it until "
                      "git checks out symbolic links (Windows: Developer Mode, then `git config core.symlinks true` "
                      "and check the file out again)")
        else:
            problems.append(f"{where}: neither a link nor a skill folder")
    return problems


def main() -> int:
    failed = False
    for skill in sorted(SKILLS.iterdir()):
        if not skill.is_dir():
            continue
        if VALIDATOR.exists():
            result = subprocess.run([sys.executable, str(VALIDATOR), str(skill)], check=False)
            failed = failed or result.returncode != 0
        else:
            failed = failed or not local_validate(skill)
        for problem in description_problems(skill):
            print(f"{skill.name}: {problem}", file=sys.stderr)
            failed = True
    for problem in claude_link_problems():
        print(problem, file=sys.stderr)
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
