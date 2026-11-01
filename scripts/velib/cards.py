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

from .common import ROOT, card_worktree, load_json, native_path, write_json

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
    meta['acceptance'] = re.findall(r'^\s*`?(npx [^`\n]+|npm run [^`\n]+|pnpm [^`\n]+|python3? [^`\n]+|node [^`\n]+)`?\s*$', text.split('## Acceptance', 1)[1].split('## Return', 1)[0], re.M)
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


# A card's own limits (W2.12): max_minutes and max_calls are enforced, not advice. A foreground dispatch is stopped at
# max_minutes; verify-card reads the card's Codex session log and refuses a run that went past either limit.
def card_limits(meta: dict) -> tuple[int, int]:
    try:
        minutes, calls = int(meta.get('max_minutes', 40)), int(meta.get('max_calls', 40))
    except (TypeError, ValueError):
        sys.exit(f've card {meta.get("card")}: max_minutes and max_calls are whole numbers')
    if not (1 <= minutes <= 240 and 1 <= calls <= 400):
        sys.exit(f've card {meta.get("card")}: max_minutes is 1 to 240 and max_calls 1 to 400')
    return minutes, calls


def card_usage(card_id: str, cwd: str, logs: list[str] | None = None) -> dict | None:
    """{minutes, calls, log} for the newest Codex session that ran this card (its cwd is the card's worktree, or its
    prompt names the card), from the session's own timestamps and tool calls; None when no log is found."""
    from datetime import datetime
    if logs is None:
        logs = sorted(glob.glob(str(Path.home() / '.codex' / 'sessions' / '*' / '*' / '*' / '*.jsonl')), key=os.path.getmtime)
    want_cwd = str(Path(cwd)).replace('\\', '/').rstrip('/').lower() if cwd else None
    for log in reversed(logs[-40:]):
        lines = Path(log).read_text(encoding='utf-8', errors='replace').splitlines()
        events = []
        for line in lines:
            try:
                events.append(json.loads(line))
            except ValueError:
                continue
        meta_cwd = next((str((e.get('payload') or {}).get('cwd') or '') for e in events if e.get('type') == 'session_meta'), '')
        mine = (want_cwd and meta_cwd.replace('\\', '/').rstrip('/').lower() == want_cwd) or f'card: {card_id}' in '\n'.join(lines)
        if not mine:
            continue
        stamps = []
        for e in events:
            try:
                stamps.append(datetime.fromisoformat(str(e.get('timestamp')).replace('Z', '+00:00')))
            except ValueError:
                continue
        calls = sum(1 for e in events if (e.get('payload') or {}).get('type') in ('function_call', 'custom_tool_call', 'local_shell_call'))
        minutes = (max(stamps) - min(stamps)).total_seconds() / 60 if len(stamps) > 1 else 0.0
        return {'minutes': round(minutes, 1), 'calls': calls, 'log': log}
    return None


def limit_problems(meta: dict, usage: dict | None) -> list[str]:
    """Why a card's run went past its own limits, or []. A run with no session log found is said, never passed."""
    minutes, calls = card_limits(meta)
    if usage is None:
        return [f'no Codex session log found for card {meta.get("card")}: its minutes and calls cannot be checked against '
                f'max_minutes {minutes} and max_calls {calls}']
    out = []
    if usage['minutes'] > minutes:
        out.append(f'the run took {usage["minutes"]} minutes, past the card\'s max_minutes {minutes}')
    if usage['calls'] > calls:
        out.append(f'the run made {usage["calls"]} tool calls, past the card\'s max_calls {calls}')
    return out


def ensure_worktree(cwd: Path, card_id: str) -> None:
    """A card runs in its own worktree cut from origin/main, with node_modules junctioned from the main checkout.
    A new worktree is made only where the local layout puts it (velib.common.card_worktree: config/studio.json
    local_roots.worktrees, W2.11): a card still naming a typed path is refused and rewritten with ve card. One that
    already exists is used where it is."""
    if cwd.exists():
        return
    try:
        expected = native_path(card_worktree(card_id))
    except ValueError as error:
        sys.exit(f've dispatch: {error}')
    if os.path.normcase(os.path.abspath(cwd)) != os.path.normcase(os.path.abspath(expected)):
        sys.exit(f've dispatch: card {card_id} names cwd {cwd}, but config/studio.json local_roots.worktrees puts its '
                 f'worktree at {expected}; write the card again with ve card (it fills cwd from the config)')
    cwd.parent.mkdir(parents=True, exist_ok=True)
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


def codex_env() -> dict:
    """The environment Codex runs cards in: CODEX_HOME set to the Studio's own Codex home once it is built
    (scripts/overnight/codex_home.py: no MCP server, no plugin, Krish's everyday ~/.codex untouched; Krish, 30 Oct,
    "do the separate settings folder fix"), and never a shared Codex runtime another session started under ~/.codex.
    A built home that fails its check stops the dispatch rather than falling back to ~/.codex."""
    sys.path.insert(0, str(ROOT / 'scripts' / 'overnight'))
    import codex_home
    env = {k: v for k, v in os.environ.items() if k != 'CODEX_COMPANION_APP_SERVER_ENDPOINT'}
    home = codex_home.active()
    if home:
        problems = codex_home.check(home)
        if problems:
            sys.exit("ve dispatch: the Studio's Codex home fails its check: " + '; '.join(problems))
        env['CODEX_HOME'] = str(home)
    return env


def dispatch(card_path: Path, background: bool = True, booked: str | None = None) -> subprocess.CompletedProcess:
    """booked: the id of a Control Center reservation (reserve_credit_spend) the queuing session already made for this
    card. Control Center is then the guard that refused anything over the share, so the local cap file is not read;
    the session settles the booking with settle_credit_spend once it has the result."""
    meta = parse_card(card_path)
    _require_design_lock(meta)
    _admit(card_path, meta)
    if not booked:
        _reserve(card_path, meta)
    cwd = meta.get('cwd') or str(ROOT)
    minutes, _ = card_limits(meta)
    ensure_worktree(Path(cwd), meta.get('card', 'card'))
    env = codex_env()
    cmd = ['node', companion(), 'task', '--fresh', '--write', '--model', meta.get('model', MODEL), '--effort', meta.get('effort', EFFORT),
           '--cwd', cwd, '--prompt-file', str(card_path.resolve())]
    if background:
        # The companion runs on in the background; verify-card holds it to max_minutes and max_calls from its log.
        cmd.insert(3, '--background')
        return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, env=env)
    try:
        return subprocess.run(cmd, capture_output=True, text=True, cwd=cwd, env=env, timeout=minutes * 60)
    except subprocess.TimeoutExpired:
        sys.exit(f've dispatch: card {meta.get("card")} ran past its max_minutes ({minutes}) and was stopped')


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
    problems += limit_problems(meta, card_usage(meta.get('card', ''), meta.get('cwd') or str(cwd)))
    return problems
