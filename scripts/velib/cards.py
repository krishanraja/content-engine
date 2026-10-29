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


def _require_design_lock(meta: dict) -> None:
    fmt = meta.get('format')
    if fmt and meta.get('kind') in ('device', 'format_config'):
        from . import designlock
        try:
            lock = designlock.load()
            ok = not designlock.validate(lock) and designlock.frozen(lock, fmt)[0]
        except (OSError, ValueError, KeyError, TypeError):
            ok = False
        if not ok:
            sys.exit(f'no frozen design lock for {fmt}: run ve lock freeze')


def write_card(path: Path, **fields) -> Path:
    _require_design_lock(fields)
    fields.setdefault('model', MODEL)
    fields.setdefault('effort', EFFORT)
    fields.setdefault('max_minutes', 40)
    fields.setdefault('max_calls', 40)
    text = CARD_TEMPLATE.format(**fields)
    if fields.get('format'):
        text = text.replace('\nkind:', f'\nformat: {fields["format"]}\nkind:', 1)
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


def allowance() -> dict | None:
    """The latest Codex rate_limits record: weekly used_percent (0 once its window has reset), resets_at, credits."""
    import time
    logs = sorted(glob.glob(str(Path.home() / '.codex' / 'sessions' / '*' / '*' / '*' / '*.jsonl')), key=os.path.getmtime)
    for log in reversed(logs[-5:]):
        lines = Path(log).read_text(encoding='utf-8', errors='replace').splitlines()
        for line in reversed(lines):
            if '"rate_limits"' not in line:
                continue
            try:
                payload = json.loads(line).get('payload', {})
                limits = payload.get('rate_limits') or {}
                primary = limits.get('primary') or {}
                if 'used_percent' not in primary:
                    continue
                resets = primary.get('resets_at')
                used = 0.0 if resets and time.time() > resets else float(primary['used_percent'])
                credits = (limits.get('credits') or {}).get('balance')
                return {'used_percent': used, 'resets_at': resets, 'credits': float(credits) if credits else None}
            except (ValueError, AttributeError, TypeError):
                continue
    return None


def weekly_used_percent() -> float | None:
    info = allowance()
    return info['used_percent'] if info else None


def ensure_worktree(cwd: Path, card_id: str) -> None:
    """A card runs in its own worktree cut from origin/main, with node_modules junctioned from the main checkout."""
    if cwd.exists():
        return
    subprocess.run(['git', 'fetch', '-q', 'origin', 'main'], cwd=ROOT, check=True)
    subprocess.run(['git', 'worktree', 'add', '-q', '-b', f've-card/{card_id}', str(cwd), 'origin/main'], cwd=ROOT, check=True)
    modules = ROOT / 'node_modules'
    if modules.exists() and not (cwd / 'node_modules').exists():
        if sys.platform == 'win32':
            subprocess.run(['cmd', '/c', 'mklink', '/J', str(cwd / 'node_modules'), str(modules.resolve())], check=True, capture_output=True)
        else:
            os.symlink(modules.resolve(), cwd / 'node_modules')


def _is_link(path: Path) -> bool:
    return path.is_symlink() or (hasattr(path, 'is_junction') and path.is_junction())


def unlink_links(folder: Path) -> list[Path]:
    """Remove every symlink or junction inside a card worktree WITHOUT following it, and return what was removed.
    27 Oct 2026: `rm -rf` on a card folder followed its node_modules junction and emptied the main checkout's
    node_modules. A link is removed as a link (os.unlink for a symlink, os.rmdir for a junction), never recursed."""
    removed: list[Path] = []
    for root, dirs, files in os.walk(folder, topdown=True, followlinks=False):
        for name in list(dirs) + files:
            path = Path(root) / name
            if _is_link(path):
                if path.is_symlink() and not (hasattr(path, 'is_junction') and path.is_junction()):
                    path.unlink()
                else:
                    os.rmdir(path)  # removes the junction itself; the target is untouched
                removed.append(path)
                if name in dirs:
                    dirs.remove(name)
    return removed


def remove_worktree(cwd: Path) -> None:
    """The only way ve removes a card worktree: links first (never followed), then git, and refuse if a link survives."""
    if not cwd.exists():
        return
    unlink_links(cwd)
    survivors = [p for p in cwd.rglob('*') if _is_link(p)] if cwd.exists() else []
    if survivors:
        sys.exit(f've: refusing to remove {cwd}: links remain ({survivors[:3]})')
    subprocess.run(['git', 'worktree', 'remove', '--force', str(cwd)], cwd=ROOT, check=True)


DEFAULT_TOOLS = 'shell, apply_patch'
DEFAULT_ALLOWANCE_RESERVE = 1.0   # percent points of the weekly Codex window a card reserves unless it says (allowance_points:)
DEFAULT_PAID_RESERVE = 40.0       # Codex credits a card reserves past the ceiling unless it says (paid_credits:)


def _hold(card_path: Path, reasons: list[str]) -> None:
    """A card that may not be sent is held: recorded beside it with the reason, and never sent."""
    from datetime import datetime, timezone
    write_json(card_path.with_suffix('.held.json'), {'card': card_path.name, 'held': True, 'reasons': reasons,
                                                     'at': datetime.now(timezone.utc).isoformat(timespec='seconds')})
    sys.exit('ve dispatch: held, not sent: ' + '; '.join(reasons))


def _admit(card_path: Path, meta: dict) -> None:
    """Codex runs only under its one tool profile (config/codex-profile.json, failure production-asked-to-publish):
    the profile must pass its audit and every tool the card names must be one it allows, or the card is held."""
    sys.path.insert(0, str(ROOT / 'scripts' / 'overnight'))
    try:
        import codex_profile
        profile = codex_profile.load()
    except (ImportError, OSError, ValueError) as error:
        _hold(card_path, [f'no Codex tool profile to send it under ({error})'])
    tools = [t.strip() for t in (meta.get('tools') or DEFAULT_TOOLS).strip('[]').split(',') if t.strip()]
    reasons = codex_profile.admit(tools, profile)
    if reasons:
        _hold(card_path, reasons)


def _reserve(card_path: Path, meta: dict) -> str:
    """Reserve the card's credits against Control Center's credit read, before anything is sent; refuse over it.
    Past the weekly allowance ceiling Codex draws paid credits, which reserve against their own cap."""
    from . import ledger
    used = weekly_used_percent()
    if used is not None and used > ALLOWANCE_CEILING:
        return ledger.reserve('codex_paid_credits', float(meta.get('paid_credits') or DEFAULT_PAID_RESERVE),
                              note=f'card {meta.get("card", card_path.stem)}: allowance at {used:.0f}%')
    return ledger.reserve('codex_allowance_points', float(meta.get('allowance_points') or DEFAULT_ALLOWANCE_RESERVE),
                          note=f'card {meta.get("card", card_path.stem)}')


def dispatch(card_path: Path, background: bool = True) -> subprocess.CompletedProcess:
    meta = parse_card(card_path)
    _require_design_lock(meta)
    _admit(card_path, meta)
    _reserve(card_path, meta)
    cwd = meta.get('cwd') or str(ROOT)
    ensure_worktree(Path(cwd), meta.get('card', 'card'))
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
