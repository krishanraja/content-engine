from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / ".agents" / "skills"
# Claude Code reads skills from .claude/skills; Codex reads .agents/skills.
# Each .claude/skills entry is a real folder holding a copy of its .agents
# skill's SKILL.md, never a symbolic link: git on Windows checks a link out as
# a small text file unless symbolic links are turned on (Developer Mode and
# core.symlinks), and Claude Code then does not load the skill on Krish's home
# computers. The copy must match its source; `--sync-claude` writes it.
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


# The skills that write board items. Every item one of them writes says how
# it ends, and none closes one: Control Center's done-check sweep does (step
# 4; Krish, 2026-10-11: "I am happy to Clear(complete)/Bump/Purge things off
# my lists as I go but the rest should be automatically done").
BOARD_SKILLS = ("make-piece", "plan-week", "produce-video")
CLOSING_LANE = re.compile(r'"lane"\s*:\s*"(done|archived)"')


def board_items_in(text: str) -> list[str]:
    """Each JSON object in the text that opens with an "id" and holds a
    "lane": a board item the skill tells a session to write."""
    items = []
    for start in [m.start() for m in re.finditer(r'\{\s*"id"\s*:', text)]:
        depth, end = 0, None
        for at in range(start, min(len(text), start + 4000)):
            depth += {"{": 1, "}": -1}.get(text[at], 0)
            if depth == 0:
                end = at
                break
        body = text[start:end + 1] if end is not None else text[start:start + 4000]
        if '"lane"' in body:
            items.append(body)
    return items


def board_item_problems(skill: Path) -> list[str]:
    """A board skill names closes_on, every item it writes says how it ends,
    and it never moves an item to done or archived."""
    if skill.name not in BOARD_SKILLS:
        return []
    text = (skill / "SKILL.md").read_text(encoding="utf-8")
    problems: list[str] = []
    if "closes_on" not in text:
        problems.append("writes board items but never says closes_on (WORKBENCH.md, \"The board\")")
    for item in board_items_in(text):
        if '"closes_on"' not in item:
            problems.append(f"a board item it writes does not say how it ends (closes_on): {' '.join(item.split())[:120]}")
    for m in CLOSING_LANE.finditer(text):
        problems.append(f"tells a session to close a board item ({m.group(0)}); the done-check sweep closes items, "
                        "a session closes only its own work (closes_on session)")
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


def normal_text(raw: bytes) -> str:
    """A SKILL.md as compared: UTF-8, a byte order mark dropped, CRLF and CR
    turned to LF, so a Windows checkout (core.autocrlf) and a Linux one read
    the same words."""
    return raw.decode("utf-8").lstrip("\ufeff").replace("\r\n", "\n").replace("\r", "\n")


def claude_copy_problems() -> list[str]:
    """Every .claude/skills entry must be a real folder named after an
    .agents skill, holding a SKILL.md that matches the source once line
    endings are made the same. A link fails, whether the checkout made it a
    link or held it as a plain file naming its target: on Windows without
    symbolic links Claude Code reads it as a text file and loads no skill."""
    if not CLAUDE_SKILLS.is_dir():
        return []
    problems: list[str] = []
    for entry in sorted(CLAUDE_SKILLS.iterdir(), key=lambda p: p.name):
        source = SKILLS / entry.name / "SKILL.md"
        where = f".claude/skills/{entry.name}"
        fix = (f"run `python scripts/validate-skills.py --sync-claude`, which makes it a folder holding a copy of "
               f".agents/skills/{entry.name}/SKILL.md")
        if not source.is_file():
            problems.append(f"{where}: no skill .agents/skills/{entry.name} to copy")
            continue
        if entry.is_symlink():
            problems.append(f"{where}: is a symbolic link; git on Windows checks a link out as a text file, so Claude Code "
                            f"there loads no skill: {fix}")
            continue
        if entry.is_file():
            held = entry.read_bytes()[:200].decode("utf-8", "replace").strip().replace("\\", "/")
            kind = "a link held as a plain file" if held.endswith(f".agents/skills/{entry.name}") else "a plain file"
            problems.append(f"{where}: is {kind}, not a skill folder, so Claude Code loads no skill from it: {fix}")
            continue
        if not entry.is_dir():
            problems.append(f"{where}: neither a skill folder nor a file")
            continue
        copy = entry / "SKILL.md"
        if not copy.is_file():
            problems.append(f"{where}: has no SKILL.md: {fix}")
            continue
        if normal_text(copy.read_bytes()) != normal_text(source.read_bytes()):
            problems.append(f"{where}/SKILL.md differs from .agents/skills/{entry.name}/SKILL.md (line endings aside): {fix}")
            continue
        print(f"{where}: a copy of .agents/skills/{entry.name}/SKILL.md")
    return problems


def sync_claude() -> int:
    """Writes each .claude/skills entry's SKILL.md from its .agents source,
    byte for byte, turning a link or a plain file into a real folder. Only
    the entries that are already there; a new one is made by hand, once."""
    if not CLAUDE_SKILLS.is_dir():
        print("no .claude/skills folder: nothing to copy")
        return 0
    for entry in sorted(CLAUDE_SKILLS.iterdir(), key=lambda p: p.name):
        source = SKILLS / entry.name / "SKILL.md"
        if not source.is_file():
            print(f".claude/skills/{entry.name}: no .agents/skills/{entry.name}/SKILL.md to copy", file=sys.stderr)
            return 1
        if entry.is_symlink() or entry.is_file():
            entry.unlink()
        entry.mkdir(exist_ok=True)
        (entry / "SKILL.md").write_bytes(source.read_bytes())
        print(f".claude/skills/{entry.name}/SKILL.md: copied from .agents/skills/{entry.name}/SKILL.md")
    return 0


def main() -> int:
    if sys.argv[1:] == ["--sync-claude"]:
        return sync_claude()
    if sys.argv[1:]:
        print("usage: python scripts/validate-skills.py [--sync-claude]", file=sys.stderr)
        return 2
    failed = False
    for skill in sorted(SKILLS.iterdir()):
        if not skill.is_dir():
            continue
        if VALIDATOR.exists():
            result = subprocess.run([sys.executable, str(VALIDATOR), str(skill)], check=False)
            failed = failed or result.returncode != 0
        else:
            failed = failed or not local_validate(skill)
        for problem in description_problems(skill) + board_item_problems(skill):
            print(f"{skill.name}: {problem}", file=sys.stderr)
            failed = True
    for problem in claude_copy_problems():
        print(problem, file=sys.stderr)
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
