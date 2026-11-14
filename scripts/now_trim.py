#!/usr/bin/env python3
"""Keep NOW.md under its size limit on main, so no session ever trims it by hand.

Sessions close out through now-notes/ and never edit NOW.md on a branch (AGENTS.md, Commit and
closeout); the fold writes the notes into NOW.md on main. When the folded page passes the limit
check_workbench.py enforces, this moves its oldest lines out verbatim, under a "> **Historical.**"
banner, into a new docs/history/<date>-NOW-moved-<n>.md, and points NOW.md's "Older lines:" line at
it. Oldest first: the bottom of "What changed recently", then the bottom of "Where it is right now",
never a bold standing line. Hand-trimmed NOW.md on two branches at once was what left pull requests
conflicted and unmerged (2026-11-10).

    python3 scripts/now_trim.py            # trim NOW.md in place if over the limit
    python3 scripts/now_trim.py --check    # exit 1 if it would trim
"""
from __future__ import annotations

import datetime as dt
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NOW = ROOT / "NOW.md"
HISTORY = ROOT / "docs" / "history"
sys.path.insert(0, str(ROOT / "scripts"))
from check_workbench import NOW_LIMIT  # noqa: E402

TARGET = NOW_LIMIT - 600  # room for the next few notes, so main is not trimmed on every merge
SECTIONS = ("## What changed recently", "## Where it is right now")  # trimmed in this order
OLDER = re.compile(r"^Older lines: ")
POINTER = re.compile(r"`docs/history/[^`]+\.md`")


def _section_span(lines: list[str], heading: str) -> tuple[int, int] | None:
    start = next((i for i, l in enumerate(lines) if l.startswith(heading)), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("## ")), len(lines))
    return start, end


def _oldest_bullet(lines: list[str]) -> tuple[str, int] | None:
    for heading in SECTIONS:
        span = _section_span(lines, heading)
        if not span:
            continue
        bullets = [i for i in range(span[0] + 1, span[1]) if lines[i].startswith("- ")]
        # Never the newest line of a section, and never a bold standing line.
        for i in reversed(bullets[1:]):
            if not lines[i].startswith("- **"):
                return heading, i
    return None


def trim(text: str, today: str, existing: set[str]) -> tuple[str, str | None, str]:
    """Returns (new NOW.md text, history file name or None, history text)."""
    eol = "\r\n" if "\r\n" in text else "\n"
    lines = text.split(eol)
    moved: dict[str, list[str]] = {}
    size = lambda: len(eol.join(lines).encode("utf-8"))  # noqa: E731
    if size() <= NOW_LIMIT:
        return text, None, ""
    while size() > TARGET:
        found = _oldest_bullet(lines)
        if not found:
            break
        heading, i = found
        moved.setdefault(heading, []).insert(0, lines.pop(i))
    older = next((i for i, l in enumerate(lines) if OLDER.match(l)), None)
    earlier = POINTER.findall(lines[older]) if older is not None else []
    # Nothing left to move, but the "Older lines:" pointer list itself has grown: fold it into a history file too
    # (2026-11-13: it named twelve files and held the page over its limit with no bullet left to move).
    if not moved and len(earlier) <= 1:
        return text, None, ""
    n = 1
    while f"{today}-NOW-moved-{n}.md" in existing:
        n += 1
    name = f"{today}-NOW-moved-{n}.md"
    pointer = f"`docs/history/{name}`"
    # The page names only the newest history file; each history file names every move before it, so nothing is lost.
    line = f"Older lines: {pointer} (it names every earlier move) and `LOG.md`."
    if older is not None:
        lines[older] = line
    else:
        span = _section_span(lines, "## What changed recently")
        at = span[1] if span else len(lines)
        lines[at:at] = [line, ""]
    where = " and ".join(f'"{h[3:]}"' for h in moved)
    what = f"Lines moved verbatim from `NOW.md`'s {where}" if moved else "The list of earlier moves, folded out of `NOW.md`'s \"Older lines:\" line,"
    out = [f"> **Historical.** {what} on {today} by `scripts/now_trim.py` to keep it under {NOW_LIMIT:,} bytes (W2.12).", ""]
    for heading in SECTIONS:
        if heading in moved:
            out += [f"From {heading[3:]}:", ""] + moved[heading] + [""]
    if earlier:
        out += ["Earlier moves, newest first:", ""] + [f"- {p}" for p in earlier] + [""]
    return eol.join(lines), name, eol.join(out)


def main(argv: list[str]) -> int:
    text = NOW.read_text(encoding="utf-8")
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    existing = {p.name for p in HISTORY.glob("*.md")}
    new, name, history = trim(text, today, existing)
    if name is None:
        print(f"NOW.md is {len(text.encode('utf-8')):,} bytes; nothing to trim.")
        return 0
    if "--check" in argv:
        print(f"NOW.md is over {NOW_LIMIT:,} bytes; scripts/now_trim.py would move lines to {name}.")
        return 1
    (HISTORY / name).write_text(history, encoding="utf-8")
    NOW.write_text(new, encoding="utf-8")
    print(f"Moved NOW.md's oldest lines to docs/history/{name}; NOW.md is now {len(new.encode('utf-8')):,} bytes.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
