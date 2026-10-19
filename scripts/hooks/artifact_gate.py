#!/usr/bin/env python3
"""Claude Code PreToolUse hook on the Artifact tool: no week's publish board or
publish page is published unless the engine built it, nothing changed it since,
and (for a board) every made day carries its Copy buttons and every finished
video its Drive link and its thumbnail's.

Krish, 2026-10-14: "how are you going to ensure all this stuff and all the
other issues we've had today can never be had again in a 100% guaranteed
durable way?" A rule in a document can be skipped; this hook cannot. Exit 2
blocks the call and tells the session why (docs/FAILURES.md lists what each
guard stops). Wired in .claude/settings.json.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1] / 'post-pack'
sys.path.insert(0, str(HERE))


def kind_of(path, text):
    head = text[:400]
    if 'content="week_board ' in head or "<title>This Week's Publish Board" in text[:2000] or 'week-board' in path.name:
        return 'week_board'
    if 'content="publish_page ' in head or path.name.startswith('publish-manager'):
        return 'publish_page'
    return None


def problems(tool_input):
    if tool_input.get('action') not in (None, 'publish') or tool_input.get('asset'):
        return []
    fp = tool_input.get('file_path')
    if not fp:
        return []
    path = Path(fp)
    if path.suffix.lower() not in ('.html', '.htm') or not path.exists():
        return []
    text = path.read_text(encoding='utf-8', errors='replace')
    kind = kind_of(path, text)
    if kind == 'week_board':
        import week_board
        return week_board.verify(text)
    if kind == 'publish_page':
        import engine_stamp
        why = engine_stamp.stamp_problem(text, 'publish_page')
        return [why] if why else []
    return []


RETIRED = ('Claude artifacts are retired (Krish, 2026-10-19: "we are now retiring the Claude artefact permanently '
           'and we are working in content.krishraja.com for all published board updates"). Build the board with '
           '`week_board.py --target web` and publish it with `board_web.py publish-web` (docs/PUBLISH_BOARDS.md). '
           'Reading an old artifact is still allowed.\n')


def retired_write(name, ti):
    """Every Artifact publish, and every write to an artifact's store, is refused; reads and listings pass."""
    if name == 'Artifact' and ti.get('action') in (None, 'publish', 'pin'):
        return RETIRED
    if name == 'ArtifactData' and ti.get('action') not in ('get', 'list', 'query'):
        return RETIRED
    return None


def main():
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return 0
    name, ti = event.get('tool_name'), event.get('tool_input') or {}
    retired = retired_write(name, ti)
    if retired:
        sys.stderr.write(retired)
        return 2
    if name != 'Artifact':
        return 0
    why = problems(ti)
    if why:
        sys.stderr.write('Blocked by the publish gate (scripts/hooks/artifact_gate.py): this page may not be published.\n  '
                         + '\n  '.join(why) + '\nFix it through the engine and rebuild; never edit the page by hand.\n')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
