from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = Path.home() / ".codex" / "skills" / ".system" / "skill-creator" / "scripts" / "quick_validate.py"


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


def main() -> int:
    failed = False
    for skill in sorted((ROOT / ".agents" / "skills").iterdir()):
        if not skill.is_dir():
            continue
        if VALIDATOR.exists():
            result = subprocess.run([sys.executable, str(VALIDATOR), str(skill)], check=False)
            failed = failed or result.returncode != 0
        else:
            failed = failed or not local_validate(skill)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
