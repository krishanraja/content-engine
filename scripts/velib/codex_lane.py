"""The Codex lane: any Claude session queues a card, Krish's home computer builds it, nobody carries it by hand.

Krish, 2026-11-01: "How do we stop having this same clumsy conversation every single time? You just do it first time
round when I ask you to produce a video seamlessly."

Codex runs only where its plugin companion and his ChatGPT login are: his home computer, inside WSL Ubuntu. A cloud
session, Claude Desktop chat or a Windows-side Claude Code cannot start it. So a session never asks him how to reach
Codex. It picks the route by itself (`route()`):

  local   the companion is on this machine: `ve dispatch` here, as before;
  queue   it is not: `ve lane queue` writes one board item (lane in_progress, id codex-<card>), and the home
          computer's windowless recordings pass runs `ve lane serve`, which claims it, builds it in WSL
          (`ve lane build`, the same dispatch and verify-card) and writes the result back onto the item.

The queue is the work board the engine already serves (/api/workbench): no new table, no Claude on a timer (Ruling,
Krish, 2026-10-29: "I want zero Claude routines"), no publish verb. The item's close_ref holds the lane's state:
{"lane": "codex", "fields": <card fields path>, "ref": <git ref>, "piece": <piece>, "state": queued|running|built|
failed, ...}. The session that queued it reads the result, re-runs the acceptance itself, looks at the golden stills,
and closes the item (closes_on session).
"""
from __future__ import annotations

import datetime as dt
import glob
import json
import os
import platform
import re
import subprocess
import sys
from pathlib import Path

from .common import ROOT

PREFIX = 'codex-'
AREA = 'Codex on your PC'
STATES = ('queued', 'running', 'built', 'failed')
# A WSL build is stopped after BUILD_HOURS; a running claim older than STALE_HOURS (longer) died with its machine and
# may be claimed again, at most MAX_ATTEMPTS times in all, so a card that keeps dying never spends allowance forever.
BUILD_HOURS = 4
STALE_HOURS = 5
MAX_ATTEMPTS = 2
LOCK = ROOT / '.cache' / 'lane' / 'serve.lock'
REF = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._/-]{0,100}$')
FIELDS = re.compile(r'^docs/ve/cards/[A-Za-z0-9_][A-Za-z0-9_./-]*\.fields\.json$')


def safe(fields_rel: str, ref: str) -> None:
    """A board field never reaches git as an option: the ref and the fields path are checked first."""
    if not REF.match(ref or '') or '..' in ref:
        raise SystemExit(f've lane: {ref!r} is not a git ref the lane takes')
    if not FIELDS.match(fields_rel or '') or '..' in fields_rel:
        raise SystemExit(f've lane: {fields_rel!r} is not a card fields file under docs/ve/cards/')


def item_id(card_id: str) -> str:
    slug = re.sub(r'[^a-z0-9_-]+', '-', card_id.lower()).strip('-_')
    return (PREFIX + slug)[:80]


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def has_companion(home: Path | None = None) -> bool:
    base = home or Path.home()
    return bool(glob.glob(str(base / '.claude' / 'plugins' / 'cache' / 'openai-codex' / 'codex' / '*' / 'scripts' / 'codex-companion.mjs')))


def route(home: Path | None = None) -> str:
    """'local' when Codex can be started from this machine, else 'queue'. Never a question to Krish."""
    return 'local' if has_companion(home) else 'queue'


# ---- the engine ---------------------------------------------------------------------------------------------------

def _engine():
    sys.path.insert(0, str(ROOT / 'scripts'))
    import engine  # scripts/engine.py: the one place the engine's address and key are read
    return engine


def _call(method: str, path: str, body=None) -> dict:
    engine = _engine()
    status, text = engine.call(method, path, body, token=engine.operator_key(), timeout=60)
    try:
        answer = json.loads(text)
    except ValueError:
        answer = {'ok': False, 'error': text[:300]}
    if status >= 400 or not answer.get('ok', False):
        raise SystemExit(f've lane: the engine refused {method} {path} ({status}): {answer.get("error")} {answer.get("detail", "")}'.strip())
    return answer


def _upsert(item: dict, client: str) -> None:
    _call('POST', '/api/workbench', {'action': 'upsert_items', 'client': client, 'items': [item]})


def lane_items(board: dict) -> list[dict]:
    """The lane's open items, oldest first."""
    items = [i for i in board.get('items', []) if str(i.get('id', '')).startswith(PREFIX)
             and (i.get('close_ref') or {}).get('lane') == 'codex']
    return sorted(items, key=lambda i: str((i.get('close_ref') or {}).get('queued_at', '')))


def next_job(board: dict, at: dt.datetime | None = None) -> dict | None:
    """The oldest open item that is queued, or running on a claim older than STALE_HOURS."""
    moment = at or dt.datetime.now(dt.timezone.utc)
    for item in lane_items(board):
        if item.get('lane') != 'in_progress':
            continue
        ref = item.get('close_ref') or {}
        if ref.get('state') == 'queued':
            return item
        if ref.get('state') == 'running':
            try:
                claimed = dt.datetime.fromisoformat(str(ref.get('claimed_at', '')).replace('Z', '+00:00'))
            except ValueError:
                return item
            if (moment - claimed).total_seconds() > STALE_HOURS * 3600:
                return item
    return None


# ---- queue (any session) ------------------------------------------------------------------------------------------

def fields_path_for(card: Path) -> Path:
    """A card's .fields.json: the card is written again from it where it runs, so cwd comes from that machine (W2.11)."""
    if card.name.endswith('.fields.json'):
        return card
    sibling = card.with_name(card.name[:-3] + '.fields.json') if card.suffix == '.md' else None
    if sibling and sibling.exists():
        return sibling
    raise SystemExit(f've lane: {card} has no .fields.json beside it; the lane sends fields, so the home computer writes '
                     'the card with its own worktree path (ve card)')


def queue_item(fields_rel: str, fields: dict, ref: str, piece: str | None, client: str, at: str | None = None) -> dict:
    card_id = fields['card_id']
    stamp = at or now()
    close_ref = {'lane': 'codex', 'fields': fields_rel, 'ref': ref, 'state': 'queued', 'queued_at': stamp, 'by': client}
    if piece:
        close_ref['piece'] = piece
    return {
        'id': item_id(card_id), 'lane': 'in_progress', 'area': AREA, 'closes_on': 'session', 'close_ref': close_ref,
        'title': f'Codex builds {fields.get("title") or card_id}'[:200],
        'detail': (f'Queued {stamp} for Codex on your home computer ({card_id}). Its recordings pass picks it up within '
                   'five minutes and builds it in WSL; Claude checks the result and the stills. Nothing for you to do.'),
    }


def on_ref(rel: str, ref: str) -> bool:
    safe(rel, ref)
    subprocess.run(['git', 'fetch', '-q', 'origin', '--end-of-options', ref], cwd=ROOT, capture_output=True)
    return subprocess.run(['git', 'cat-file', '-e', f'origin/{ref}:{rel}'], cwd=ROOT, capture_output=True).returncode == 0


def queue(card: Path, piece: str | None, ref: str = 'main', client: str = 'claude_code') -> dict:
    fields_file = fields_path_for(card.resolve())
    rel = fields_file.relative_to(ROOT).as_posix()
    if not on_ref(rel, ref):
        raise SystemExit(f've lane: {rel} is not on origin/{ref}; push it first (the home computer reads it from there). '
                         'Everything the card reads must be on main, where its worktree is cut.')
    fields = json.loads(fields_file.read_text(encoding='utf-8'))
    board = _call('GET', '/api/workbench')
    held = next((i for i in lane_items(board) if i['id'] == item_id(fields['card_id']) and i.get('lane') == 'in_progress'
                 and (i.get('close_ref') or {}).get('state') in ('queued', 'running')), None)
    if held:
        raise SystemExit(f've lane: {held["id"]} is already {held["close_ref"]["state"]}; wait for its result (ve lane status)')
    item = queue_item(rel, fields, ref, piece, client)
    _upsert(item, client)
    return item


# ---- build (the machine that has Codex) ---------------------------------------------------------------------------

def build(fields_rel: str, ref: str = 'main', piece: str | None = None) -> dict:
    """Write the card from its fields on this machine, dispatch it and wait, then verify-card. Returns a summary."""
    from .cards import dispatch, verify, write_card
    from .common import card_worktree
    result: dict = {'fields': fields_rel, 'ref': ref, 'host': platform.node(), 'ok': False, 'problems': []}
    try:
        safe(fields_rel, ref)
        if piece:
            from .ledger import require_within
            require_within(piece)  # the cap is checked again where it runs: other spend may have landed since it was queued
        subprocess.run(['git', 'fetch', '-q', 'origin', '--end-of-options', 'main'] + ([ref] if ref != 'main' else []), cwd=ROOT, check=True)
        shown = subprocess.run(['git', 'show', f'origin/{ref}:{fields_rel}'], cwd=ROOT, check=True, capture_output=True, text=True)
        fields = json.loads(shown.stdout)
        card_id = fields['card_id']
        result['card'] = card_id
        out = ROOT / '.cache' / 'lane' / f'{card_id}.md'
        out.parent.mkdir(parents=True, exist_ok=True)
        fields.pop('path', None)
        fields['cwd'] = card_worktree(card_id)
        write_card(out, **fields)
        done = dispatch(out, background=False)
        result['dispatch_code'] = done.returncode
        result['dispatch_tail'] = '\n'.join((done.stdout + done.stderr).strip().splitlines()[-8:])
        result['problems'] = verify(out, Path(fields['cwd']))
        result['worktree'] = fields['cwd']
        result['ok'] = done.returncode == 0 and not result['problems']
    except SystemExit as stop:
        result['problems'].append(str(stop.code))
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        result['problems'].append(f'{type(error).__name__}: {error}')
    return result


def report_item(item: dict, result: dict, at: str | None = None) -> dict:
    ref = dict(item.get('close_ref') or {})
    ref.update({'state': 'built' if result.get('ok') else 'failed', 'finished_at': at or now(), 'host': result.get('host', '')[:60]})
    if result.get('worktree'):
        ref['branch'] = f've-card/{result.get("card")}'
    if len(json.dumps(ref)) > 1000:
        ref = {k: ref[k] for k in ('lane', 'fields', 'ref', 'piece', 'state', 'queued_at', 'finished_at') if k in ref}
    if result.get('ok'):
        detail = (f'Codex built it on {result.get("host")} and verify-card passes (branch {ref.get("branch")}). '
                  'Claude now re-runs the acceptance and looks at the golden stills before it reaches you.')
    else:
        problems = '; '.join(result.get('problems') or []) or result.get('dispatch_tail', '')
        detail = f'Codex could not finish it on {result.get("host") or "your PC"}: {problems}'
    return {'id': item['id'], 'close_ref': ref, 'detail': detail[:2000]}


# ---- serve (the home computer's recordings pass) ------------------------------------------------------------------

def wsl_command(fields_rel: str, ref: str, piece: str | None, distro: str, repo: str) -> list[str]:
    inner = ['python3', 'scripts/ve.py', 'lane', 'build', fields_rel, '--ref', ref, '--json'] + (['--piece', piece] if piece else [])
    return ['wsl.exe', '-d', distro, '--cd', repo, '--exec', 'bash', '-lc',
            'git pull -q --ff-only && ' + ' '.join(_quote(a) for a in inner)]


def _quote(arg: str) -> str:
    return arg if re.fullmatch(r'[A-Za-z0-9_./:=-]+', arg) else "'" + arg.replace("'", "'\\''") + "'"


def _take_lock() -> bool:
    """An atomic lock, stale by its age (past the build timeout), never by a process id."""
    LOCK.parent.mkdir(parents=True, exist_ok=True)
    try:
        import time
        if LOCK.exists() and time.time() - LOCK.stat().st_mtime > (BUILD_HOURS + 0.5) * 3600:
            LOCK.unlink()
    except OSError:
        pass
    try:
        fd = os.open(str(LOCK), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        return False
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        handle.write(str(os.getpid()))
    return True


def serve(client: str = 'codex') -> dict:
    """Claim the next job, build it here or in WSL, write the result back. One job a run; a second run waits."""
    if not _take_lock():
        return {'served': None, 'why': 'another lane run is building'}
    try:
        board = _call('GET', '/api/workbench')
        job = next_job(board)
        if not job:
            return {'served': None, 'why': 'nothing queued'}
        ref = dict(job['close_ref'])
        attempts = int(ref.get('attempts') or 0) + 1
        if attempts > MAX_ATTEMPTS:
            _upsert(report_item(job, {'ok': False, 'host': platform.node(), 'problems': [
                f'it died {MAX_ATTEMPTS} times without a result, so the lane stopped trying; fix the card and queue it again']}), client)
            return {'served': job['id'], 'ok': False, 'problems': ['gave up']}
        ref.update({'state': 'running', 'claimed_at': now(), 'host': platform.node()[:60], 'attempts': attempts})
        _upsert({'id': job['id'], 'close_ref': ref,
                 'detail': f'Codex is building it on {platform.node()} now. Claude checks the result when it lands.'}, client)
        job = {**job, 'close_ref': ref}
        try:
            result = _run(ref)
        except Exception as error:  # noqa: BLE001  every failure after the claim is written back, never left running
            result = {'ok': False, 'host': platform.node(), 'problems': [f'{type(error).__name__}: {error}'[:600]]}
        _upsert(report_item(job, result), client)
        return {'served': job['id'], 'ok': bool(result.get('ok')), 'problems': result.get('problems', [])}
    finally:
        try:
            LOCK.unlink()
        except OSError:
            pass


def _run(ref: dict) -> dict:
    distro = os.environ.get('MINDMAKE_CODEX_WSL_DISTRO', '').strip()
    repo = os.environ.get('MINDMAKE_CODEX_WSL_REPO', '').strip()
    if has_companion():
        result = build(ref['fields'], ref.get('ref', 'main'), ref.get('piece'))
    elif sys.platform == 'win32' and distro and repo:
        # The WSL build needs no engine key (only this side writes the board), so none is passed: Codex never sees it.
        env = {k: v for k, v in os.environ.items() if k != 'ENGINE_OPERATOR_TOKEN'}
        safe(ref['fields'], ref.get('ref', 'main'))
        done = subprocess.run(wsl_command(ref['fields'], ref.get('ref', 'main'), ref.get('piece'), distro, repo),
                              capture_output=True, text=True, env=env, timeout=BUILD_HOURS * 3600,
                              creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        result = last_json(done.stdout) or {'ok': False, 'host': distro, 'problems': [
            'the WSL build printed no result: ' + ' '.join((done.stdout + done.stderr).strip().splitlines()[-4:])]}
    else:
        result = {'ok': False, 'host': platform.node(), 'problems': [
            'Codex is not on this machine and no WSL route is set (MINDMAKE_CODEX_WSL_DISTRO and MINDMAKE_CODEX_WSL_REPO)']}
    return result


def last_json(text: str) -> dict | None:
    for line in reversed((text or '').strip().splitlines()):
        line = line.strip()
        if line.startswith('{'):
            try:
                return json.loads(line)
            except ValueError:
                return None
    return None


def status() -> list[dict]:
    board = _call('GET', '/api/workbench')
    return [{'id': i['id'], 'lane': i.get('lane'), **{k: (i.get('close_ref') or {}).get(k) for k in ('state', 'fields', 'piece', 'queued_at', 'finished_at', 'host', 'branch')},
             'detail': i.get('detail', '')} for i in lane_items(board)]
