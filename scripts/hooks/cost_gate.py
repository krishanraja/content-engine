#!/usr/bin/env python3
"""Claude Code hook (UserPromptSubmit and PreToolUse): the session-side cost guards of docs/COST_GUARDS.md.

Krish, 2026-10-18: "one for the upgrades to the engine that don't let me do things that are going to create huge
cost outlays." One six-day session read 1,086M tokens because every step re-read a context at a median of 459k
(docs/COST_AUDIT_2026-10-18.md). A rule in a document can be skipped; this hook cannot. Exit 2 blocks a tool call
and tells the session why. Wired in .claude/settings.json.

G1  context nudge: past 200k tokens of context each prompt is told to write its handover and start a fresh session.
    It only advises; nothing is refused for the size of the context.
G5  no full board in the chat: an `Artifact read` of a week's board link (config/boards.json) is refused; the
    builder reads the saved copy (`week_board.py --previous`).
G6  agents and workflows only for work that needs a separate reader: an Agent prompt must say what the separate
    reader is for ("Separate reader: ..." in its description or prompt); a Workflow must carry Krish's words ("said: ...").

Ruling (Krish, 2026-10-18): "remove the 300k context ceiling permanently and stop the cost guard from blocking database
calls permanently". So there is no context ceiling, and no rule here refuses a database tool (NEVER_BLOCKED).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WARN = 200_000
TAIL_BYTES = 4_000_000

# Database tools are never refused, whatever any rule below says (Krish, 2026-10-18).
NEVER_BLOCKED = re.compile(r'^(mcp__[Ss]upabase__|ArtifactData$)')


def context_tokens(transcript_path):
    """The context the last model call read: its input, cache reads and cache writes."""
    try:
        p = Path(transcript_path)
        with p.open('rb') as f:
            size = p.stat().st_size
            f.seek(max(0, size - TAIL_BYTES))
            lines = f.read().decode('utf-8', 'ignore').splitlines()
    except (OSError, TypeError):
        return 0
    for line in reversed(lines):
        if '"usage"' not in line:
            continue
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get('type') != 'assistant' or e.get('isSidechain'):
            continue
        u = (e.get('message') or {}).get('usage') or {}
        n = sum(u.get(k) or 0 for k in ('input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'))
        if n:
            return n
    return 0


def board_links():
    try:
        weeks = json.loads((ROOT / 'config' / 'boards.json').read_text(encoding='utf-8')).get('weeks') or {}
    except (OSError, ValueError):
        return set()
    return {u.rstrip('/') for links in weeks.values() for u in links}


def tool_problem(tool, ti):
    if NEVER_BLOCKED.match(tool):
        return None
    if tool == 'Artifact' and ti.get('action') == 'read' and not ti.get('path') and not ti.get('paths'):
        if str(ti.get('url') or '').rstrip('/') in board_links():
            return ('G5: a week\'s publish board is never read into the chat (it is megabytes, re-read on every later '
                    'step). The builder reads the saved copy: `python3 scripts/post-pack/week_board.py --previous ...`; '
                    'read comments with ArtifactComments.')
    if tool == 'Agent':
        said = str(ti.get('description') or '') + '\n' + str(ti.get('prompt') or '')[:600]
        if not re.search(r'separate reader', said, re.I):
            return ('G6: an agent re-reads its own context and is only for work that needs a separate reader. Say what '
                    'the reader is for in its description ("Separate reader: read-back A") or the first lines of its '
                    'prompt, or do the work here.')
    if tool == 'Workflow':
        blob = json.dumps(ti)
        if not re.search(r'said:\s*\S', blob):
            return ('G6: a workflow starts many agents and needs Krish\'s words. Put them in its args as '
                    '"said: <his exact words>", or do the work here.')
    return None


def main():
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return 0
    name = event.get('hook_event_name')
    if name == 'UserPromptSubmit':
        n = context_tokens(event.get('transcript_path'))
        if n >= WARN:
            print(f'[cost guard G1] This session\'s context is {n // 1000}k tokens; every step re-reads all of it. '
                  'Finish the step in hand, write the handover to '
                  'docs/handovers/<date>-<job>.md, commit it, and tell Krish to start a fresh session from it.')
        return 0
    if name != 'PreToolUse':
        return 0
    tool = event.get('tool_name') or ''
    ti = event.get('tool_input') or {}
    why = tool_problem(tool, ti)
    if why:
        sys.stderr.write(f'Blocked by the cost guard (scripts/hooks/cost_gate.py). {why}\n')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
