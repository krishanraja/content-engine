"""ve card, dispatch and verify-card: exact Codex task cards, sent straight to the Codex plugin companion
(never the codex-rescue subagent), checked by Claude outside the sandbox. Codex's own report is never evidence."""
from __future__ import annotations

import fnmatch
import glob
import json
import os
import re
import subprocess
import sys
from pathlib import Path

from .common import ROOT, load_json, write_json

MODEL = 'gpt-6.1-sol'   # measured cheapest per allowance point (27.0M tokens per 1%); pin, never inherit astra/high
EFFORT = 'medium'
ALLOWANCE_CEILING = 80  # percent of the weekly Codex window; dispatch refuses above this

CARD_TEMPLATE = """---
card: {card_id}
kind: {kind}
model: {model}
effort: {effort}
max_minutes: {max_minutes}
max_calls: {max_calls}
cwd: {cwd}
write_allow: {write_allow}
read: {read}
never: NOW.md, WORKBENCH.md, docs/plans/**, git commands, network, MCP tools, publishing, new dependencies, raw hex colours, useCurrentFrame outside apps/renderer/src/engine/clock.ts, edits outside write_allow
---

# {title}

## Goal
{goal}

## Contract
{contract}

## Acceptance (every command must exit 0 inside your sandbox)
{acceptance}

## Return
Your final message is only JSON matching config/ve/task-result.schema.json:
{{"card": "{card_id}", "files_changed": [...], "commands": [{{"cmd": "...", "exit_code": 0}}], "open_questions": [...]}}
Stop after two failed attempts at the same acceptance command and report the failure in open_questions.
"""


def write_card(path: Path, **fields) -> Path:
    fields.setdefault('model', MODEL)
    fields.setdefault('effort', EFFORT)
    fields.setdefault('max_minutes', 40)
    fields.setdefault('max_calls', 40)
    text = CARD_TEMPLATE.format(**fields)
    if len(text.encode('utf-8')) > 6144:
        sys.exit(f've card: {path.name} is {len(text.encode())} bytes; a card is 6 KB or less')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')
    return path


def parse_card(path: Path) -> dict:
    text = path.read_text(encoding='utf-8')
    head = text.split('---', 2)[1]
    meta = {}
    for line in head.strip().splitlines():
        key, _, value = line.partition(':')
        meta[key.strip()] = value.strip()
    meta['acceptance'] = re.findall(r'^\s*`?(npx [^`\n]+|npm run [^`\n]+|python [^`\n]+)`?\s*$', text.split('## Acceptance', 1)[1].split('## Return', 1)[0], re.M)
    return meta


def companion() -> str:
    pattern = str(Path.home() / '.claude' / 'plugins' / 'cache' / 'openai-codex' / 'codex' / '*' / 'scripts' / 'codex-companion.mjs')
    found = sorted(glob.glob(pattern))
    if not found:
        sys.exit('ve dispatch: the Codex plugin companion is not installed (ve doctor explains)')
    return found[-1]


def weekly_used_percent() -> float | None:
    """The latest rate_limits.used_percent from the newest Codex session log, or None if unknown."""
    logs = sorted(glob.glob(str(Path.home() / '.codex' / 'sessions' / '*' / '*' / '*' / '*.jsonl')), key=os.path.getmtime)
    for log in reversed(logs[-5:]):
        lines = Path(log).read_text(encoding='utf-8', errors='replace').splitlines()
        for line in reversed(lines):
            if '"rate_limits"' not in line:
                continue
            try:
                payload = json.loads(line).get('payload', {})
                primary = (payload.get('rate_limits') or {}).get('primary') or {}
                if 'used_percent' in primary:
                    return float(primary['used_percent'])
            except (ValueError, AttributeError):
                continue
    return None


def dispatch(card_path: Path, background: bool = True) -> subprocess.CompletedProcess:
    meta = parse_card(card_path)
    used = weekly_used_percent()
    if used is not None and used > ALLOWANCE_CEILING:
        sys.exit(f've dispatch: the weekly Codex allowance is at {used:.0f}% (ceiling {ALLOWANCE_CEILING}%); hold the card or ask Krish')
    cwd = meta.get('cwd') or str(ROOT)
    cmd = ['node', companion(), 'task', '--fresh', '--write', '--model', meta.get('model', MODEL), '--effort', meta.get('effort', EFFORT),
           '--cwd', cwd, '--prompt-file', str(card_path.resolve())]
    if background:
        cmd.insert(3, '--background')
    return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd)


def verify(card_path: Path, cwd: Path) -> list[str]:
    """Re-run the card's acceptance outside the sandbox and check the diff stayed inside write_allow."""
    meta = parse_card(card_path)
    allowed = [p.strip() for p in meta.get('write_allow', '').strip('[]').split(',') if p.strip()]
    problems: list[str] = []
    changed = subprocess.run(['git', 'status', '--porcelain', '--untracked-files=all'], capture_output=True, text=True, cwd=cwd).stdout.splitlines()
    for line in changed:
        path = line[3:].strip().strip('"').replace('\\', '/')
        if not any(fnmatch.fnmatch(path, pattern) for pattern in allowed):
            problems.append(f'outside write_allow: {path}')
    for cmd in meta['acceptance']:
        shell_cmd = cmd if sys.platform != 'win32' else cmd
        result = subprocess.run(shell_cmd, shell=True, capture_output=True, text=True, cwd=cwd)
        if result.returncode != 0:
            tail = (result.stdout + result.stderr).strip().splitlines()[-6:]
            problems.append(f'acceptance failed ({result.returncode}): {cmd}\n    ' + '\n    '.join(tail))
    return problems
