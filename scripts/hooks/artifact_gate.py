#!/usr/bin/env python3
"""Claude Code PreToolUse hook on the Artifact and ArtifactData tools: no Claude artifact is ever published or written
again. Reads and listings pass.

Krish, 2026-10-19: "we are now retiring the Claude artefact permanently". A rule in a document can be skipped; this hook
cannot. Exit 2 blocks the call and tells the session why. Wired in .claude/settings.json.
"""
import json
import sys


RETIRED = ('Claude artifacts are retired (Krish, 2026-10-19: "we are now retiring the Claude artefact permanently"). '
           'The one live board is Control Centre\'s Content tab (python3 scripts/post-pack/live_board.py <Monday> [day]); '
           'the old board pages were retired for good on 13 Nov 2026 and their addresses redirect to it (Ruling, Krish, '
           '2026-11-13). Feed it by writing what its view reads, and report and file on the piece with '
           'scripts/post-pack/board_session.py or the Control Center connector (docs/PUBLISH_BOARDS.md). '
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
    retired = retired_write(event.get('tool_name'), event.get('tool_input') or {})
    if retired:
        sys.stderr.write(retired)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
