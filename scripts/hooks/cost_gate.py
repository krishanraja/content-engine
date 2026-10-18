#!/usr/bin/env python3
"""Claude Code hook (UserPromptSubmit and PreToolUse): the session-side cost guards of docs/COST_GUARDS.md.

Krish, 2026-10-18: "one for the upgrades to the engine that don't let me do things that are going to create huge
cost outlays." One six-day session read 1,086M tokens because every step re-read a context at a median of 459k
(docs/COST_AUDIT_2026-10-18.md). A rule in a document can be skipped; this hook cannot. Exit 2 blocks a tool call
and tells the session why. Wired in .claude/settings.json.

G1  context ceiling: past 200k tokens of context each prompt is told to write its handover and stop; past 300k every
    tool is refused except writing the handover (docs/handovers/, WORKBENCH.md) and committing it.
G5  no full board in the chat: an `Artifact read` of a week's board link (config/boards.json) is refused; the
    builder reads the saved copy (`week_board.py --previous`).
G6  agents and workflows only for work that needs a separate reader: an Agent prompt must say what the separate
    reader is for ("Separate reader: ..." in its description or prompt); a Workflow must carry Krish's words ("said: ...").

Over the ceiling, Krish can let one session run on by writing his words into .cache/context-ceiling-said.txt as
"<session id> <his words>".
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WARN = 200_000
STOP = 300_000
TAIL_BYTES = 4_000_000

# Tools that add nothing to the context worth stopping, or that a handover needs.
ALWAYS = {'ToolSearch', 'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TaskStop', 'ReadNotifications',
          'AskUserQuestion', 'ExitPlanMode', 'EnterPlanMode', 'mcp__claude-code-remote__send_later'}
HANDOVER_PATHS = ('docs/handovers/', 'WORKBENCH.md', 'docs/history/', '.claude/plans/')
HANDOVER_COMMANDS = re.compile(r'^\s*(cd [^;&|]+&&\s*)?(git (add|commit|push|status|diff|log|fetch|pull)\b'
                               r'|python3? scripts/(session_token_audit|check_workbench|check_failures)\.py)')


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


def ceiling_lifted(session_id):
    f = ROOT / '.cache' / 'context-ceiling-said.txt'
    try:
        return any(line.split(' ', 1)[0] == session_id and len(line.split(' ', 1)) == 2
                   for line in f.read_text(encoding='utf-8').splitlines())
    except OSError:
        return False


def handover_call(tool, ti):
    if tool in ALWAYS:
        return True
    if tool in ('Write', 'Edit', 'Read'):
        fp = str(ti.get('file_path') or '').replace('\\', '/')
        return any(h in fp for h in HANDOVER_PATHS)
    if tool == 'Bash':
        return bool(HANDOVER_COMMANDS.match(ti.get('command') or ''))
    return False


def board_links():
    try:
        weeks = json.loads((ROOT / 'config' / 'boards.json').read_text(encoding='utf-8')).get('weeks') or {}
    except (OSError, ValueError):
        return set()
    return {u.rstrip('/') for links in weeks.values() for u in links}


def tool_problem(tool, ti):
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
    sid = event.get('session_id') or ''
    if name == 'UserPromptSubmit':
        n = context_tokens(event.get('transcript_path'))
        if n >= WARN and not ceiling_lifted(sid):
            print(f'[cost guard G1] This session\'s context is {n // 1000}k tokens; every step re-reads all of it '
                  f'(the stop is {STOP // 1000}k). Finish the step in hand, write the handover to '
                  'docs/handovers/<date>-<job>.md, commit it, and tell Krish to start a fresh session from it.')
        return 0
    if name != 'PreToolUse':
        return 0
    tool = event.get('tool_name') or ''
    ti = event.get('tool_input') or {}
    why = tool_problem(tool, ti)
    if not why:
        n = context_tokens(event.get('transcript_path'))
        if n >= STOP and not handover_call(tool, ti) and not ceiling_lifted(sid):
            why = (f'G1: this session\'s context is {n // 1000}k tokens, over the {STOP // 1000}k ceiling. Only the '
                   'handover is allowed now: write docs/handovers/<date>-<job>.md (and WORKBENCH.md), commit and push '
                   'it, then stop. Krish can lift the ceiling for this session in .cache/context-ceiling-said.txt.')
    if why:
        sys.stderr.write(f'Blocked by the cost guard (scripts/hooks/cost_gate.py). {why}\n')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
