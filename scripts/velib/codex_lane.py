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
        if ref.get('venture'):
            continue  # a venture card's queue is its own repository; its board item is only the mirror
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


SPEND_ID = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')


def require_booking(spend_id: str | None) -> str:
    """The Control Center reservation the queuing session made (reserve_credit_spend), so no credit file has to live
    on the computer that builds. A card is never queued without one: Control Center is the guard that refuses
    over_share, held or no_pool, and the session settles it (settle_credit_spend) once the result is back."""
    if not spend_id or not SPEND_ID.match(spend_id):
        raise SystemExit('ve lane: book the card first: reserve_credit_spend (Control Center connector, the venture\'s '
                         'engine, pool codex) and pass its spend_id with --spend-id')
    return spend_id


def queue_item(fields_rel: str, fields: dict, ref: str, piece: str | None, client: str, at: str | None = None,
               spend_id: str | None = None) -> dict:
    card_id = fields['card_id']
    stamp = at or now()
    close_ref = {'lane': 'codex', 'fields': fields_rel, 'ref': ref, 'state': 'queued', 'queued_at': stamp, 'by': client}
    if spend_id:
        close_ref['spend_id'] = spend_id
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


def queue(card: Path, piece: str | None, ref: str = 'main', client: str = 'claude_code', spend_id: str | None = None) -> dict:
    require_booking(spend_id)
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
    item = queue_item(rel, fields, ref, piece, client, spend_id=spend_id)
    _upsert(item, client)
    return item


# ---- build (the machine that has Codex) ---------------------------------------------------------------------------

def publish_branch(worktree: Path, branch: str, message: str) -> tuple[str | None, str | None]:
    """Commit what Codex changed in the card's worktree and push its branch, so the session that queued it, anywhere,
    can read and check it. Returns (commit sha, None) or (None, why it could not be pushed)."""
    git = ['git', '-C', str(worktree)]
    # Never the node_modules link ensure_worktree made: on 2026-11-01 it was committed with Codex's work.
    subprocess.run(git + ['add', '-A', '--', '.', ':(exclude)node_modules'], check=True, capture_output=True)
    if subprocess.run(git + ['diff', '--cached', '--quiet'], capture_output=True).returncode != 0:
        subprocess.run(git + ['-c', 'user.name=Codex lane', '-c', 'user.email=codex-lane@users.noreply.github.com',
                              'commit', '-q', '-m', message], check=True, capture_output=True)
    pushed = subprocess.run(git + ['push', '-q', '-u', 'origin', '--end-of-options', f'HEAD:refs/heads/{branch}'],
                            capture_output=True, text=True)
    if pushed.returncode != 0:
        tail = ' '.join((pushed.stderr or '').strip().splitlines()[-2:])
        return None, (f'built, but the branch {branch} could not be pushed from this computer ({tail}); give WSL git '
                      'access to GitHub (docs/ve/RUNBOOK.md, Codex lane)')
    sha = subprocess.run(git + ['rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
    return sha, None


def changed_files(worktree: Path, base: str) -> list[str]:
    """What Codex changed in the card's worktree: committed since base, plus anything not yet committed."""
    git = ['git', '-C', str(worktree)]
    committed = subprocess.run(git + ['diff', '--name-only', f'{base}...HEAD'], capture_output=True, text=True).stdout.split()
    pending = [line[3:].strip() for line in subprocess.run(git + ['status', '--porcelain', '--untracked-files=all'],
                                                             capture_output=True, text=True).stdout.splitlines() if line.strip()]
    pending = [p for p in pending if p.rstrip('/') != 'node_modules']
    return sorted(set(committed + pending))


def dispatch_problems(done, changed: list[str]) -> list[str]:
    """Why Codex produced nothing, said first and in Codex's own words: on 2026-11-01 a card came back with only
    acceptance failures while Codex had changed nothing, so the real cause never reached the session."""
    tail = ' | '.join((done.stdout + done.stderr).strip().splitlines()[-6:])[:600]
    if done.returncode != 0:
        return [f'Codex exited {done.returncode} and its work was not checked: {tail or "no output"}']
    if not changed:
        return [f'Codex made no changes, so its work was not checked: {tail or "no output"}']
    return []


def build(fields_rel: str, ref: str = 'main', piece: str | None = None, spend_id: str | None = None) -> dict:
    """Write the card from its fields on this machine, dispatch it and wait, then verify-card. Returns a summary."""
    from .cards import dispatch, verify, write_card
    from .common import card_worktree, native_path
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
        # This machine's own form of the path: inside WSL a root given without placeholders gets the Windows-style
        # {repo}\\{branch} tail, and ensure_worktree refused the card (2026-11-01).
        fields['cwd'] = str(native_path(card_worktree(card_id)))
        write_card(out, **fields)
        done = dispatch(out, background=False, booked=require_booking(spend_id))
        result['dispatch_code'] = done.returncode
        result['dispatch_tail'] = '\n'.join((done.stdout + done.stderr).strip().splitlines()[-8:])
        result['changed_files'] = changed_files(Path(fields['cwd']), 'origin/main')
        result['problems'] = dispatch_problems(done, result['changed_files']) or verify(out, Path(fields['cwd']))
        result['worktree'] = fields['cwd']
        sha, why = publish_branch(Path(fields['cwd']), f've-card/{card_id}', f'codex: {card_id}')
        if why:
            result['problems'].append(why)
        result['sha'] = sha
        result['ok'] = done.returncode == 0 and not result['problems']
    except SystemExit as stop:
        result['problems'].append(str(stop.code))
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        result['problems'].append(f'{type(error).__name__}: {error}')
    return result


def report_item(item: dict, result: dict, at: str | None = None) -> dict:
    ref = dict(item.get('close_ref') or {})
    ref.update({'state': 'built' if result.get('ok') else 'failed', 'finished_at': at or now(), 'host': result.get('host', '')[:60]})
    if result.get('branch') or result.get('worktree'):
        ref['branch'] = result.get('branch') or f've-card/{result.get("card")}'
    if result.get('sha'):
        ref['sha'] = str(result['sha'])[:12]
    if len(json.dumps(ref)) > 1000:
        ref = {k: ref[k] for k in ('lane', 'venture', 'fields', 'path', 'ref', 'piece', 'spend_id', 'state', 'queued_at',
                                    'finished_at', 'branch', 'sha') if k in ref}
    if result.get('ok'):
        detail = (f'Codex built it on {result.get("host")} and verify-card passes (branch {ref.get("branch")}). '
                  'Claude now re-runs the acceptance and looks at the golden stills before it reaches you.')
    else:
        problems = '; '.join(result.get('problems') or []) or result.get('dispatch_tail', '')
        detail = f'Codex could not finish it on {result.get("host") or "your PC"}: {problems}'
    return {'id': item['id'], 'close_ref': ref, 'detail': detail[:2000]}


# ---- serve (the home computer's recordings pass) ------------------------------------------------------------------

def wsl_command(fields_rel: str, ref: str, piece: str | None, distro: str, repo: str, spend_id: str | None = None) -> list[str]:
    inner = ['lane', 'build', fields_rel, '--ref', ref, '--json'] + (['--piece', piece] if piece else []) \
        + (['--spend-id', spend_id] if spend_id else [])
    return wsl_ve(inner, distro, repo)


def wsl_ve(inner: list[str], distro: str, repo: str) -> list[str]:
    """python3 scripts/ve.py <inner> in the content-engine clone inside WSL, after bringing it up to date."""
    return ['wsl.exe', '-d', distro, '--cd', repo, '--exec', 'bash', '-lc',
            'git pull -q --ff-only && ' + ' '.join(_quote(a) for a in ['python3', 'scripts/ve.py'] + inner)]


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
    """Claim the next job, build it here or in WSL, write the result back. One job a run; a second run waits.
    content-engine's own cards come first (the board is their queue); then the ventures' cards (their repositories are
    their queue, config/codex-lanes.json), mirrored onto the board so Krish sees them."""
    if not _take_lock():
        return {'served': None, 'why': 'another lane run is building'}
    try:
        board = _call('GET', '/api/workbench')
        job = next_job(board)
        if job:
            ref = dict(job['close_ref'])
            attempts = int(ref.get('attempts') or 0) + 1
            if attempts > MAX_ATTEMPTS:
                _upsert(report_item(job, {'ok': False, 'host': platform.node(), 'problems': [
                    f'it died {MAX_ATTEMPTS} times without a result, so the lane stopped trying; fix the card and queue it again']}), client)
                return {'served': job['id'], 'ok': False, 'problems': ['gave up']}
            ref.update({'state': 'running', 'claimed_at': now(), 'host': platform.node()[:60], 'attempts': attempts})
            extra = {}
            run = lambda: _run(ref)  # noqa: E731
        else:
            card = next_venture_card()
            if not card:
                return {'served': None, 'why': 'nothing queued'}
            ref = {'lane': 'codex', 'venture': card['venture'], 'path': card['path'], 'ref': card['branch'],
                   'state': 'running', 'queued_at': now(), 'claimed_at': now(), 'host': platform.node()[:60]}
            job = {'id': item_id(f"{card['venture']}-{card['card']}"), 'close_ref': ref}
            extra = {'lane': 'in_progress', 'area': AREA, 'closes_on': 'session',
                     'title': f"Codex builds {card['card']} for {card['venture']}"[:200]}
            run = lambda: _run_venture(card)  # noqa: E731
        _upsert({'id': job['id'], 'close_ref': ref, **extra,
                 'detail': f'Codex is building it on {platform.node()} now. Claude checks the result when it lands.'}, client)
        job = {**job, 'close_ref': ref}
        try:
            result = run()
        except Exception as error:  # noqa: BLE001  every failure after the claim is written back, never left running
            result = {'ok': False, 'host': platform.node(), 'problems': [f'{type(error).__name__}: {error}'[:600]]}
        report = report_item(job, result)
        if ref.get('venture'):
            # The venture's session reads its result from the codex/<id> branch; the board item is only the mirror,
            # so the lane, which holds it, closes it with the outcome in its detail.
            report['lane'] = 'done'
        _upsert(report, client)
        return {'served': job['id'], 'ok': bool(result.get('ok')), 'problems': result.get('problems', [])}
    finally:
        try:
            LOCK.unlink()
        except OSError:
            pass


def _wsl_route() -> tuple[str, str] | None:
    distro = os.environ.get('MINDMAKE_CODEX_WSL_DISTRO', '').strip()
    repo = os.environ.get('MINDMAKE_CODEX_WSL_REPO', '').strip()
    return (distro, repo) if sys.platform == 'win32' and distro and repo else None


def _in_wsl(inner: list[str]) -> dict:
    distro, repo = _wsl_route()
    # The WSL build needs no engine key (only this side writes the board), so none is passed: Codex never sees it.
    env = {k: v for k, v in os.environ.items() if k != 'ENGINE_OPERATOR_TOKEN'}
    done = subprocess.run(wsl_ve(inner, distro, repo), capture_output=True, text=True, env=env, timeout=BUILD_HOURS * 3600,
                          creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    return last_json(done.stdout) or {'ok': False, 'host': distro, 'problems': [
        'the WSL run printed no result: ' + ' '.join((done.stdout + done.stderr).strip().splitlines()[-4:])]}


NO_ROUTE = 'Codex is not on this machine and no WSL route is set (MINDMAKE_CODEX_WSL_DISTRO and MINDMAKE_CODEX_WSL_REPO)'


def _run(ref: dict) -> dict:
    # An explicit WSL route wins over a companion found on this machine: on 2026-11-01 Lorimer's Windows side had a
    # companion that did nothing, while Codex works inside WSL. Inside WSL itself _wsl_route() is None.
    if has_companion() and not _wsl_route():
        return build(ref['fields'], ref.get('ref', 'main'), ref.get('piece'), ref.get('spend_id'))
    if _wsl_route():
        safe(ref['fields'], ref.get('ref', 'main'))
        inner = ['lane', 'build', ref['fields'], '--ref', ref.get('ref', 'main'), '--json'] \
            + (['--piece', ref['piece']] if ref.get('piece') else []) + (['--spend-id', ref['spend_id']] if ref.get('spend_id') else [])
        return _in_wsl(inner)
    return {'ok': False, 'host': platform.node(), 'problems': [NO_ROUTE]}


# ---- venture lanes: the venture's own repository is the queue -------------------------------------------------------

LANES = ROOT / 'config' / 'codex-lanes.json'
QUEUE_DIR = 'codex/queue'
RESULTS_DIR = 'codex/results'
CARD_ID = re.compile(r'^[a-z0-9][a-z0-9-]{1,60}$')
QUEUE_PATH = re.compile(r'^codex/queue/([a-z0-9][a-z0-9-]{1,60})\.md$')
ATTEMPTS = ROOT / '.cache' / 'lane' / 'venture-attempts.json'


def ventures() -> dict:
    return json.loads(LANES.read_text(encoding='utf-8'))['ventures']


def venture_dir(name: str) -> Path:
    """The venture's clone beside this one (in WSL: ~/dev/<name>), made on first use from its public https address."""
    return ROOT.parent / name


def _git(path: Path, *args, check=True) -> str:
    return subprocess.run(['git', '-C', str(path), *args], check=check, capture_output=True, text=True).stdout


def ensure_venture(name: str) -> Path:
    if name not in ventures():
        raise SystemExit(f've lane: {name!r} is not a venture in config/codex-lanes.json')
    path = venture_dir(name)
    if not (path / '.git').exists():
        subprocess.run(['git', 'clone', '-q', f"https://github.com/{ventures()[name]['repo']}", str(path)], check=True,
                       capture_output=True)
    _git(path, 'fetch', '-q', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*')
    return path


def queued_in(branches: list[str], files_on: dict[str, list[str]]) -> list[dict]:
    """The cards waiting: a codex/queue/<id>.md on main or a claude/ branch with no codex/<id> branch yet. Pure."""
    done = {b[len('codex/'):] for b in branches if b.startswith('codex/')}
    out, seen = [], set()
    for branch in [b for b in branches if b == 'main'] + sorted(b for b in branches if b.startswith('claude/')):
        for path in files_on.get(branch, []):
            match = QUEUE_PATH.match(path)
            if not match or match.group(1) in done or match.group(1) in seen:
                continue
            seen.add(match.group(1))
            out.append({'branch': branch, 'path': path, 'card': match.group(1)})
    return out


def pending(name: str) -> list[dict]:
    path = ensure_venture(name)
    branches = [b for b in _git(path, 'for-each-ref', '--format=%(refname:strip=3)', 'refs/remotes/origin').split() if b != 'HEAD']
    files_on = {}
    for branch in branches:
        if branch == 'main' or branch.startswith('claude/'):
            listed = _git(path, 'ls-tree', '--name-only', f'origin/{branch}', f'{QUEUE_DIR}/', check=False)
            files_on[branch] = [line for line in listed.splitlines() if line.endswith('.md')]
    return [{**c, 'venture': name} for c in queued_in(branches, files_on)]


def _attempts() -> dict:
    try:
        return json.loads(ATTEMPTS.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def all_pending() -> list[dict]:
    """Every venture's waiting cards that have not already failed MAX_ATTEMPTS times on this computer."""
    tried = _attempts()
    out = []
    for name in ventures():
        try:
            out += [c for c in pending(name) if tried.get(f"{name}/{c['card']}", 0) < MAX_ATTEMPTS]
        except (OSError, subprocess.CalledProcessError, SystemExit):
            continue
    return out


def next_venture_card() -> dict | None:
    if _wsl_route():
        cards = _in_wsl(['lane', 'pending', '--json']).get('cards') or []
    elif has_companion():
        cards = all_pending()
    else:
        return None
    return cards[0] if cards else None


def _set_front(text: str, key: str, value: str) -> str:
    head, _, body = text.partition('---')[2].partition('---')
    lines = [l for l in head.strip().splitlines() if l.partition(':')[0].strip() != key] + [f'{key}: {value}']
    return '---\n' + '\n'.join(lines) + '\n---' + body


def build_venture(name: str, branch: str, path: str) -> dict:
    """On the computer with Codex: cut a worktree for the card from the branch it was queued on, run it, check it,
    and push the codex/<id> branch with Codex's work and codex/results/<id>.json, which marks the card done."""
    from .cards import dispatch, parse_card, verify
    from .common import local_root, native_path
    result: dict = {'venture': name, 'path': path, 'ref': branch, 'host': platform.node(), 'ok': False, 'problems': []}
    tried = _attempts()
    try:
        match = QUEUE_PATH.match(path or '')
        if not match or not REF.match(branch or '') or '..' in branch:
            raise SystemExit(f've lane: {path!r} on {branch!r} is not a card the lane takes')
        card_id = match.group(1)
        result['card'], result['branch'] = card_id, f'codex/{card_id}'
        key = f'{name}/{card_id}'
        tried[key] = tried.get(key, 0) + 1
        ATTEMPTS.parent.mkdir(parents=True, exist_ok=True)
        ATTEMPTS.write_text(json.dumps(tried), encoding='utf-8')
        repo = ensure_venture(name)
        text = _git(repo, 'show', f'origin/{branch}:{path}')
        wt = native_path(local_root('worktrees', repo=name, branch=f'codex/{card_id}'))
        if not wt.exists():
            wt.parent.mkdir(parents=True, exist_ok=True)
            _git(repo, 'worktree', 'add', '-q', '-B', f'codex/{card_id}', str(wt), f'origin/{branch}')
        out = ROOT / '.cache' / 'lane' / f'{name}-{card_id}.md'
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(_set_front(_set_front(text, 'cwd', str(wt)), 'card', card_id), encoding='utf-8')
        meta = parse_card(out)
        if (wt / 'pnpm-lock.yaml').exists():
            subprocess.run(['corepack', 'pnpm', 'install', '--frozen-lockfile'], cwd=wt, check=True, capture_output=True)
        elif (wt / 'package-lock.json').exists():
            subprocess.run(['npm', 'ci', '--no-audit', '--no-fund'], cwd=wt, check=True, capture_output=True)
        done = dispatch(out, background=False, booked=require_booking(meta.get('spend_id')))
        result['dispatch_code'] = done.returncode
        result['dispatch_tail'] = '\n'.join((done.stdout + done.stderr).strip().splitlines()[-8:])
        result['changed_files'] = changed_files(wt, f'origin/{branch}')
        result['problems'] = dispatch_problems(done, result['changed_files']) or verify(out, wt)
        result['ok'] = done.returncode == 0 and not result['problems']
        record = wt / RESULTS_DIR / f'{card_id}.json'
        record.parent.mkdir(parents=True, exist_ok=True)
        record.write_text(json.dumps({k: result.get(k) for k in ('card', 'ok', 'problems', 'dispatch_code', 'host')}
                                     | {'finished_at': now(), 'queued_on': branch}, indent=2) + '\n', encoding='utf-8')
        sha, why = publish_branch(wt, f'codex/{card_id}', f'codex: {card_id} ({"built" if result["ok"] else "failed"})')
        if why:
            result['problems'].append(why)
            result['ok'] = False
        result['sha'] = sha
    except SystemExit as stop:
        result['problems'].append(str(stop.code))
    except (OSError, ValueError, KeyError, IndexError, subprocess.CalledProcessError) as error:
        result['problems'].append(f'{type(error).__name__}: {error}')
    return result


def _run_venture(card: dict) -> dict:
    if has_companion() and not _wsl_route():
        return build_venture(card['venture'], card['branch'], card['path'])
    if _wsl_route():
        return _in_wsl(['lane', 'build-venture', card['venture'], card['branch'], card['path'], '--json'])
    return {'ok': False, 'host': platform.node(), 'problems': [NO_ROUTE]}


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
