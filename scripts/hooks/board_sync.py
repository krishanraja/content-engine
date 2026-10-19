#!/usr/bin/env python3
"""Claude Code PostToolUse hook on the Artifact tool: after a week's board is
published to one of its links (config/boards.json), name every other link of
that week that does not yet hold this exact build, so the session publishes
the same file there too. Krish, 2026-10-14: "I work from two different Claude
accounts, so make sure this board and that board are always synchronized."
Which build each link holds is kept in .cache/board-sync.json (per machine:
a fresh session starts by publishing to every link)."""
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STATE = ROOT / '.cache' / 'board-sync.json'


def main():
    try:
        event = json.load(sys.stdin)
    except ValueError:
        return 0
    if event.get('tool_name') != 'Artifact':
        return 0
    ti = event.get('tool_input') or {}
    if ti.get('action') not in (None, 'publish') or ti.get('asset') or not ti.get('file_path'):
        return 0
    path = Path(ti['file_path'])
    if not path.exists() or path.suffix != '.html':
        return 0
    text = path.read_text(encoding='utf-8', errors='replace')
    if 'content="week_board ' not in text[:400]:
        return 0
    result = json.dumps(event.get('tool_response') or '')
    urls = set(re.findall(r'https://claude\.ai/artifact/[A-Za-z0-9]+', (ti.get('url') or '') + ' ' + result))
    config = json.loads((ROOT / 'config' / 'boards.json').read_text(encoding='utf-8'))
    weeks = config['weeks']
    week = next((links for links in weeks.values() if urls & set(links)), None)
    if not week:
        return 0
    if config.get('web_cutover', {}).get('state') == 'active':
        sys.stderr.write('Publish boards now live at https://content.krishraja.com. '
                         'Do not synchronize the preserved Claude copies. Follow docs/PUBLISH_BOARDS.md.\n')
        return 0
    sha = hashlib.sha256(text.encode('utf-8')).hexdigest()
    state = json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else {}
    for u in urls & set(week):
        state[u] = sha
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(state, indent=1), encoding='utf-8')
    behind = [u for u in week if state.get(u) != sha]
    if behind:
        sys.stderr.write('This week\'s board has more than one link (config/boards.json, Krish\'s two accounts). '
                         f'Publish this same file ({path}) to: ' + ', '.join(behind)
                         + ' (Artifact publish with that url). If this account cannot write one, say so to Krish; the other account\'s session publishes it.\n')
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main())
