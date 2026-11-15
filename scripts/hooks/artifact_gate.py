#!/usr/bin/env python3
"""Claude Code PreToolUse hook on the Artifact and ArtifactData tools: no Claude artifact is ever published or written
again. Reads and listings pass.

Krish, 2026-10-19: "we are now retiring the Claude artefact permanently". A rule in a document can be skipped; this hook
cannot. Exit 2 blocks the call and tells the session why. Wired in .claude/settings.json.

One exception (Ruling, Krish, 2026-11-15: the weekly standards check-in is one pinned claude.ai artifact refreshed
weekly, an exception to "No Claude artifact, ever"): a publish or pin of that one artifact, by its own address, passes.
A new artifact, any other address, and every ArtifactData write are still refused (docs/AGENTS-REFERENCE.md, rule 3).
"""
import json
import re
import sys

# The one standards check-in artifact (docs/STANDARDS-CHECKIN.md). Its id, never any other.
STANDARDS_CHECKIN_ID = 'AmaXBSHYfZMF9RUEmgcSqH'
CHECKIN_URL = re.compile(r'^https://claude\.ai/(?:code/)?artifact/' + STANDARDS_CHECKIN_ID + r'/?$')


RETIRED = ('Claude artifacts are retired (Krish, 2026-10-19: "we are now retiring the Claude artefact permanently"). '
           'The one live board is Control Centre\'s Content tab (python3 scripts/post-pack/live_board.py <Monday> [day]); '
           'the old board pages were retired for good on 13 Nov 2026 and their addresses redirect to it (Ruling, Krish, '
           '2026-11-13). Feed it by writing what its view reads, and report and file on the piece with '
           'scripts/post-pack/board_session.py or the Control Center connector (docs/PUBLISH_BOARDS.md). '
           'Reading an old artifact is still allowed.\n')


def retired_write(name, ti):
    """Every Artifact publish, and every write to an artifact's store, is refused; reads and listings pass."""
    if name == 'Artifact' and ti.get('action') in (None, 'publish', 'pin'):
        if CHECKIN_URL.match(str(ti.get('url') or '')) and not ti.get('from_url'):
            return None
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
