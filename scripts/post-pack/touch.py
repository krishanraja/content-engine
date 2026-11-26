#!/usr/bin/env python3
"""touch: the production cycle's one touchpoint runner, over config/cycle.json (the single registry).

Krish, 2026-11-26: make sure file archives, divergence engine, strategist, Higgsfield generator, growth-makeyourmindup,
makeyourmindup, krish-clone, taste engine, internal auditor, Control Center and humour engine are always involved at the
right moments of the production cycle, reading from them or informing them, in the most streamlined way.

    python3 scripts/post-pack/touch.py run STAGE --week MONDAY [--piece ID] [--set key=value ...] [--dry] [--only ROW]
        every touch of that stage, through the clients that already exist (divergent.py, humour_check.py, story_floor.py,
        voice_gate.py, board_session.py, ve.py, gh api reads of strategist, growth-makeyourmindup and makeyourmindup,
        the krish-clone registry). Values a row needs (topic, angle, problem, hook, landing, long, short, edits, title,
        refused, defect, failures, corrections, pool, amount, asset, spend_id, settled, instruction_id) come by --set.
    python3 scripts/post-pack/touch.py check STAGE --week MONDAY [--piece ID]   exit 1 when a required touch is missing
    python3 scripts/post-pack/touch.py drain [--week MONDAY]                    send what was queued for Control Center
    python3 scripts/post-pack/touch.py list [STAGE]                             the registry, stage by stage

Connector touches (report_to_taste_engine, record_harness_observation, find_research, get_engine_instruction and its
ack, get_engine_brief, reserve and settle_credit_spend) go through one JSON-RPC client to Control Center's
/api/harness/mcp on CC_HARNESS_KEY. Without the key they are queued in .cache/touch/outbox.jsonl and on the week's log
line, and `drain` sends them later. Every touch writes one line to docs/plans/<Monday>-week/touches.jsonl:
{id, stage, system, direction, status done|queued|skipped|failed, reason, ref, at}. Exit 2 or not served is skipped,
never done. A paid touch reserves through the chain cap and the story-score ledger first, and is skipped over either.
--dry prints what would run and writes nothing.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))

CONFIG = ROOT / 'config' / 'cycle.json'
OK = ('done', 'queued')
STATUSES = ('done', 'queued', 'skipped', 'failed')
DIRECTIONS = ('read', 'inform')
KINDS = ('script', 'gh', 'builtin', 'mcp', 'exists', 'manual')
PLACEHOLDER = re.compile(r'\{([a-z_]+)\}')


def cycle(path=CONFIG):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def monday(text):
    d = date.fromisoformat(str(text)[:10])
    return (d - timedelta(days=d.weekday())).isoformat()


def story_from():
    """The date the touch findings start: the story score's from (config/story-score.json)."""
    try:
        return json.loads((ROOT / 'config' / 'story-score.json').read_text(encoding='utf-8'))['from']
    except (OSError, ValueError, KeyError):
        return '9999-12-31'


def rows_of(stage, cfg=None):
    cfg = cfg or cycle()
    return [r for r in cfg['rows'] if int(r['stage']) == int(stage)]


def week_dir(week, plans=None):
    base = Path(plans) if plans else Path('docs') / 'plans'
    return base / f'{week}-week'


def log_path(week, plans=None):
    folder = week_dir(week, plans)
    return folder if folder.is_absolute() else ROOT / folder


def _log_file(week, plans=None):
    return log_path(week, plans) / 'touches.jsonl'


def outbox_path(cfg=None):
    cfg = cfg or cycle()
    return ROOT / cfg['files']['outbox']


def read_jsonl(path):
    try:
        lines = Path(path).read_text(encoding='utf-8').splitlines()
    except OSError:
        return []
    out = []
    for line in lines:
        try:
            out.append(json.loads(line))
        except ValueError:
            continue
    return out


def append_jsonl(path, row):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as f:
        f.write(json.dumps(row, ensure_ascii=False) + '\n')


# ---------------------------------------------------------------------------------------------------------------------
# Templates: a row's call and arguments carry {name}; a value nobody gave means the row is skipped with that reason.


def missing_vars(node, ctx):
    found = set()
    if isinstance(node, str):
        found |= {m for m in PLACEHOLDER.findall(node) if ctx.get(m) in (None, '')}
    elif isinstance(node, list):
        for x in node:
            found |= missing_vars(x, ctx)
    elif isinstance(node, dict):
        for x in node.values():
            found |= missing_vars(x, ctx)
    return found


def fill(node, ctx):
    """The node with every {name} filled from ctx. A string that is only one placeholder whose value is a number keeps
    the number (an amount)."""
    if isinstance(node, str):
        whole = re.fullmatch(r'\{([a-z_]+)\}', node)
        if whole:
            v = ctx.get(whole.group(1))
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                return v
            if isinstance(v, str) and re.fullmatch(r'-?\d+(\.\d+)?', v) and whole.group(1) in ('amount', 'settled'):
                return float(v) if '.' in v else int(v)
        return PLACEHOLDER.sub(lambda m: str(ctx.get(m.group(1), m.group(0))), node)
    if isinstance(node, list):
        return [fill(x, ctx) for x in node]
    if isinstance(node, dict):
        return {k: fill(v, ctx) for k, v in node.items()}
    return node


def unmet(row, ctx):
    """Why the row does not apply now, or None: a value it needs that was not given, or a file that is not there."""
    when = row.get('when') or {}
    gone = [v for v in when.get('vars') or [] if ctx.get(v) in (None, '')]
    if gone:
        return 'not given: ' + ', '.join(gone)
    for f in when.get('files') or []:
        p = Path(fill(f, ctx))
        if not (p if p.is_absolute() else ROOT / p).exists():
            return f'no {fill(f, ctx)} yet'
    need = missing_vars(row['how'].get('call'), ctx)
    if need:
        return 'not given: ' + ', '.join(sorted(need))
    return None


# ---------------------------------------------------------------------------------------------------------------------
# Transports. Each is a plain function the Runner holds, so a test hands in fakes and nothing is ever spent.


def run_cmd(argv, timeout=600):
    """(exit code, output) of one existing CLI, run from the repository root. python3 is this interpreter."""
    argv = [sys.executable if a == 'python3' and i == 0 else a for i, a in enumerate(argv)]
    try:
        p = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
    except FileNotFoundError:
        return 127, f'{argv[0]} is not installed here'
    except subprocess.TimeoutExpired:
        return 124, f'timed out after {timeout}s'
    return p.returncode, (p.stdout or '') + (p.stderr or '')


def gh_api(path):
    """(exit code, output) of `gh api <path>` (the repository reads: strategist, growth-makeyourmindup, makeyourmindup)."""
    return run_cmd(['gh', 'api', path], timeout=60)


def http_get(url, timeout=30):
    """(status, bytes), status None when unreachable."""
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'content-engine-touch'}), timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, b''
    except (urllib.error.URLError, OSError, ValueError):
        return None, b''


def http_post(url, body, key, timeout=60):
    """(status, json) from Control Center's harness MCP route. Never raises; never prints the key."""
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method='POST', headers={
        'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, parse_rpc(r.read().decode('utf-8', 'replace'))
    except urllib.error.HTTPError as e:
        try:
            return e.code, parse_rpc(e.read().decode('utf-8', 'replace'))
        except Exception:  # noqa: BLE001
            return e.code, {}
    except (urllib.error.URLError, OSError, ValueError) as e:
        return None, {'error': {'message': type(e).__name__}}


def parse_rpc(text):
    """A JSON-RPC answer, plain JSON or one server-sent event."""
    text = (text or '').strip()
    if not text:
        return {}
    if text.startswith('{'):
        return json.loads(text)
    data = [line[5:].strip() for line in text.splitlines() if line.startswith('data:')]
    return json.loads(data[-1]) if data else {}


def mcp_call(tool, arguments, *, key, url, post=http_post):
    """(sent, line, answer): one tools/call. sent False keeps the touch queued, with why."""
    body = {'jsonrpc': '2.0', 'id': str(uuid.uuid4()), 'method': 'tools/call', 'params': {'name': tool, 'arguments': arguments}}
    status, data = post(url, body, key)
    if status != 200:
        return False, f'Control Center answered {status}' + (f": {(data.get('error') or {}).get('message')}" if isinstance(data, dict) and data.get('error') else ''), None
    if data.get('error'):
        return False, f"Control Center refused: {(data['error'] or {}).get('message', 'error')}", None
    result = data.get('result') or {}
    text = ' '.join(c.get('text', '') for c in result.get('content') or [] if isinstance(c, dict)).strip()
    if result.get('isError'):
        return False, f'{tool} refused: {text[:200]}', result
    return True, text[:200] or f'{tool} answered', result


# ---------------------------------------------------------------------------------------------------------------------
# Builtins: reads touch.py does itself, from the source another script already names.


def killlist_drift(call, gh=gh_api):
    """(status, reason, ref): makeyourmindup's kill list upstream against the sha256 vendor/.../SOURCE.md records."""
    source = (ROOT / call['source']).read_text(encoding='utf-8')
    m = re.search(r'`' + re.escape(call['path']) + r'`\s*\|\s*`([0-9a-f]{64})`', source)
    if not m:
        return 'failed', f"{call['source']} names no upstream sha256 for {call['path']}", None
    code, out = gh(f"repos/{call['repo']}/contents/{call['path']}")
    if code != 0:
        return 'skipped', f"not served: gh api could not read {call['repo']} ({_tail(out)})", None
    try:
        doc = json.loads(out)
        now = hashlib.sha256(base64.b64decode(doc['content'])).hexdigest()
    except (ValueError, KeyError, TypeError):
        return 'skipped', 'not served: the upstream file did not come back readable', None
    if now == m.group(1):
        return 'done', 'no drift: the vendored kill list matches upstream', now[:12]
    return 'done', (f'drift: upstream {call["path"]} is now {now[:12]}, vendored from {m.group(1)[:12]}; vendor it again '
                    '(SOURCE.md, "Updating it")'), now[:12]


def clone_registry(call, get=http_get):
    """(status, reason, ref): krish-clone's registry, at the raw URL scripts/velib/lint.py reads it from."""
    text = (ROOT / call['source']).read_text(encoding='utf-8')
    m = re.search(rf"^{re.escape(call['constant'])}\s*=\s*'([^']+)'", text, re.M)
    if not m:
        return 'failed', f"{call['source']} has no {call['constant']}", None
    status, data = get(m.group(1))
    if status != 200:
        return 'skipped', f'not served: the clone registry answered {status}', None
    try:
        doc = json.loads(data)
    except ValueError:
        return 'skipped', 'not served: the clone registry is not JSON', None
    entries = doc if isinstance(doc, list) else doc.get('approvals') or doc.get('entries') or []
    return 'done', f'{len(entries)} approved clone entries', hashlib.sha256(data).hexdigest()[:12]


BUILTINS = {'killlist_drift': killlist_drift, 'clone_registry': clone_registry}


def _tail(text, n=160):
    lines = [x for x in str(text or '').strip().splitlines() if x.strip()]
    return (lines[-1] if lines else '')[:n]


# ---------------------------------------------------------------------------------------------------------------------
# The runner


class Runner:
    def __init__(self, cfg=None, *, plans=None, cmd=run_cmd, gh=gh_api, get=http_get, post=http_post, env=None,
                 cap=None, ledger=None, dry=False, out=print):
        self.cfg = cfg or cycle()
        self.plans = plans
        self.cmd, self.gh, self.get, self.post = cmd, gh, get, post
        self.env = os.environ if env is None else env
        self.cap = cap  # the chain cap read (divergent.chain_week), injected in tests
        self.ledger = ledger  # a story_score.Ledger, injected in tests
        self.dry = dry
        self.out = out

    # -- context
    def context(self, week, piece=None, sets=None):
        cc = self.cfg['control_center']
        ctx = {'week': week, 'week_dir': week_dir(week, self.plans).as_posix(), 'piece': piece,
               'repository': self.cfg['repository'], 'now': now_iso()}
        for k, v in (sets or {}).items():
            ctx[k] = v
        if ctx.get('refused') and not ctx.get('refused_ref'):
            ctx['refused_ref'] = hashlib.sha256(str(ctx['refused']).encode()).hexdigest()[:12]
        ctx['_url'] = self.env.get(cc['url_env']) or cc['url']
        return ctx

    def key(self):
        return self.env.get(self.cfg['control_center']['key_env']) or ''

    # -- the log
    def log(self, row, ctx, status, reason, ref=None, extra=None):
        line = {'id': row['id'], 'stage': int(row['stage']), 'system': row['system'], 'direction': row['direction'],
                'status': status, 'reason': reason, 'ref': ref, 'at': now_iso(), 'week': ctx['week']}
        if ctx.get('piece'):
            line['piece'] = ctx['piece']
        line.update(extra or {})
        if not self.dry:
            append_jsonl(_log_file(ctx['week'], self.plans), line)
        self.out(f"{status:7} {row['id']} ({row['system']}, {row['direction']}): {reason}" + (f' [{ref}]' if ref else ''))
        return line

    # -- caps for a paid touch
    def reserve(self, row, ctx):
        """(entry or None, why). The chain cap first, then the story-score ledger; unknown chain stops nothing."""
        paid = row.get('paid')
        if not paid:
            return None, None
        import divergent
        cap = self.cap or divergent.chain_week
        runs, why = divergent.chain_verdict(cap())
        if not runs:
            return None, why
        ledger = self.ledger
        if ledger is None:
            import story_score
            ledger = story_score.Ledger(story_score.ledger_of(ctx['week']))
        entry, why = ledger.reserve(paid['op'], paid['usd'], divergent=bool(paid.get('divergent')), note=f"touch {row['id']}")
        return ((entry, ledger), 'reserved') if entry else (None, why)

    # -- one row
    def touch(self, row, ctx):
        how = row['how']
        kind = how['kind']
        why = unmet(row, ctx) if kind not in ('manual',) else None
        if why:
            return self.log(row, ctx, 'skipped', why)
        call = fill(how.get('call'), ctx)
        if kind == 'manual':
            return self.log(row, ctx, 'skipped', call['reason'])
        if kind == 'exists':
            ev = call.get('evidence')
            if ev:
                p = Path(ev)
                if (p if p.is_absolute() else ROOT / p).exists():
                    return self.log(row, ctx, 'done', f'done by {row["cites"]}', ev)
            return self.log(row, ctx, 'skipped', f'done elsewhere: {row["cites"]}' + (f' (no {ev} this week)' if ev else ''))
        if self.dry:
            return self.log(row, ctx, 'skipped', f'dry run: would {kind} ' + (' '.join(call) if isinstance(call, list) else json.dumps(call)[:160]))
        if kind == 'mcp':
            return self.connector(row, ctx, call)
        if kind == 'gh':
            return self.gh_read(row, ctx, call)
        if kind == 'builtin':
            fn = BUILTINS[call['name']]
            status, reason, ref = fn(call, self.gh) if call['name'] == 'killlist_drift' else fn(call, self.get)
            return self.log(row, ctx, status, reason, ref)
        reserved, why = self.reserve(row, ctx)
        if row.get('paid') and not reserved:
            return self.log(row, ctx, 'skipped', f'refused by the cap: {why}')
        code, text = self.cmd(call)
        if code == 0:
            return self.log(row, ctx, 'done', _tail(text) or 'ran', ' '.join(call[:3]))
        if code == 1:
            return self.log(row, ctx, 'done', 'flagged: ' + (_tail(text) or 'see the script'), ' '.join(call[:3]))
        if reserved:
            entry, ledger = reserved
            ledger.settle(entry, 0)
        if code == 2:
            return self.log(row, ctx, 'skipped', 'not served: ' + (_tail(text) or 'exit 2'))
        return self.log(row, ctx, 'failed', f'exit {code}: ' + _tail(text))

    def gh_read(self, row, ctx, call):
        code, text = self.gh(f"repos/{call['repo']}/contents/{call['path']}")
        if code != 0:
            return self.log(row, ctx, 'skipped', f"not served: gh api could not read {call['repo']}/{call['path']} ({_tail(text)})")
        try:
            doc = json.loads(text)
        except ValueError:
            return self.log(row, ctx, 'skipped', 'not served: gh api answered no JSON')
        if call.get('latest') and isinstance(doc, list):
            files = sorted((d for d in doc if isinstance(d, dict) and d.get('type') == 'file'), key=lambda d: d.get('name', ''))
            if not files:
                return self.log(row, ctx, 'skipped', f"{call['repo']}/{call['path']} holds no file yet")
            doc = files[-1]
        if not isinstance(doc, dict):
            return self.log(row, ctx, 'skipped', 'not served: an unexpected answer')
        return self.log(row, ctx, 'done', f"read {doc.get('path', call['path'])}", f"{doc.get('path', call['path'])}@{str(doc.get('sha', ''))[:12]}")

    def connector(self, row, ctx, call):
        tool, args = call['tool'], call.get('arguments') or {}
        key = self.key()
        if key:
            sent, line, _ = mcp_call(tool, args, key=key, url=ctx['_url'], post=self.post)
            if sent:
                return self.log(row, ctx, 'done', line, tool)
            reason = f'queued for drain: {line}'
        else:
            reason = f"queued for drain: no {self.cfg['control_center']['key_env']} here"
        entry = {'key': f"{row['id']}|{ctx['week']}|{ctx.get('piece') or ''}", 'id': row['id'], 'stage': int(row['stage']),
                 'week': ctx['week'], 'piece': ctx.get('piece'), 'tool': tool, 'arguments': args, 'queued_at': now_iso()}
        if not self.dry:
            append_jsonl(outbox_path(self.cfg), entry)
        return self.log(row, ctx, 'queued', reason, tool, {'queued': {'tool': tool, 'arguments': args}})

    # -- a stage
    def run(self, stage, week, piece=None, sets=None, only=None):
        ctx = self.context(monday(week), piece, sets)
        return [self.touch(r, ctx) for r in rows_of(stage, self.cfg) if not only or r['id'] in only]

    # -- drain
    def drain(self, week=None):
        """Send every queued connector touch: the outbox, and (with week) the week's queued log lines with nothing sent
        after them. Each one sent is logged done on its week and leaves the outbox; the rest stay."""
        key = self.key()
        box = outbox_path(self.cfg)
        waiting = read_jsonl(box)
        if week:
            seen = {e['key'] for e in waiting}
            for e in pending_in_log(monday(week), self.plans):
                if e['key'] not in seen:
                    waiting.append(e)
                    seen.add(e['key'])
        if not waiting:
            self.out('nothing queued')
            return 0, []
        if not key:
            self.out(f"{len(waiting)} queued; no {self.cfg['control_center']['key_env']} here, so nothing was sent")
            return 2, waiting
        url = self.env.get(self.cfg['control_center']['url_env']) or self.cfg['control_center']['url']
        left, sent = [], []
        rows = {r['id']: r for r in self.cfg['rows']}
        for e in waiting:
            ok, line, _ = mcp_call(e['tool'], e['arguments'], key=key, url=url, post=self.post)
            if ok and e['id'] in rows:
                self.log(rows[e['id']], {'week': e['week'], 'piece': e.get('piece')}, 'done', f'drained: {line}', e['tool'])
                sent.append(e)
            else:
                self.out(f"kept    {e['id']} ({e['week']}): {line}")
                left.append(e)
        if not self.dry:
            box.parent.mkdir(parents=True, exist_ok=True)
            box.write_text(''.join(json.dumps(e, ensure_ascii=False) + '\n' for e in left), encoding='utf-8')
        return (0 if not left else 1), left


def pending_in_log(week, plans=None):
    """Queued lines of a week's touch log with no later done line for the same touch and piece, as outbox entries."""
    lines = read_jsonl(_log_file(week, plans))
    latest = {}
    for line in lines:
        latest[(line.get('id'), line.get('piece'))] = line
    out = []
    for (rid, piece), line in latest.items():
        q = line.get('queued')
        if line.get('status') == 'queued' and isinstance(q, dict):
            out.append({'key': f"{rid}|{week}|{piece or ''}", 'id': rid, 'stage': line.get('stage'), 'week': week,
                        'piece': piece, 'tool': q.get('tool'), 'arguments': q.get('arguments') or {}, 'queued_at': line.get('at')})
    return out


# ---------------------------------------------------------------------------------------------------------------------
# The check


def satisfied(line):
    """A touch line that completes its row: done or queued, or skipped with a reason."""
    if not isinstance(line, dict):
        return False
    if line.get('status') in OK:
        return True
    return line.get('status') == 'skipped' and bool(str(line.get('reason') or '').strip())


def check(stage, week, piece=None, plans=None, cfg=None):
    """Findings [{code: touch, ref, line}] for every required row of the stage with no line that completes it. A row
    that needs a piece is checked only when a piece is named."""
    cfg = cfg or cycle()
    week = monday(week)
    lines = read_jsonl(_log_file(week, plans))
    found = []
    for row in rows_of(stage, cfg):
        if not row.get('required'):
            continue
        piece_row = 'piece' in ((row.get('when') or {}).get('vars') or []) or 'piece' in json.dumps(row['how'].get('call'))
        if piece_row and not piece:
            continue
        mine = [x for x in lines if x.get('id') == row['id'] and (not piece_row or x.get('piece') == piece)]
        last = mine[-1] if mine else None
        cmd = f'python3 scripts/post-pack/touch.py run {stage} --week {week}' + (f' --piece {piece}' if piece_row else '')
        if last is None:
            found.append({'code': 'touch', 'ref': row['id'], 'line': f"touch {row['id']}: stage {stage} {row['system']} ({row['direction']}) "
                          f"has no line in touches.jsonl; run {cmd}"})
        elif not satisfied(last):
            found.append({'code': 'touch', 'ref': row['id'], 'line': f"touch {row['id']}: stage {stage} {row['system']} "
                          f"({row['direction']}) is {last.get('status')}" + (f": {last.get('reason')}" if last.get('reason') else '')
                          + f'; run {cmd} again'})
    return found


def findings(stage, week, piece=None, plans=None, cfg=None):
    """check(), only for weeks on or after the story score's from date (config/story-score.json): the gates' entry."""
    if monday(week) < story_from():
        return []
    return check(stage, week, piece, plans, cfg)


# ---------------------------------------------------------------------------------------------------------------------
# CLI


def _sets(pairs):
    out = {}
    for p in pairs or []:
        k, sep, v = p.partition('=')
        if not sep or not re.fullmatch(r'[a-z_]+', k):
            raise SystemExit(f'--set takes key=value, not {p!r}')
        out[k] = v
    return out


def list_lines(cfg, stage=None):
    out = []
    for s in cfg['stages']:
        if stage is not None and int(stage) != s['id']:
            continue
        out.append(f"{s['id']} {s['name']} ({s['when']})")
        for r in rows_of(s['id'], cfg):
            out.append(f"  {'*' if r.get('required') else ' '} {r['id']:26} {r['direction']:6} {r['system']:22} {r['how']['kind']:7} {r['what']}")
    return out


def main(argv=None, **inject):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    for name in ('run', 'check'):
        p = sub.add_parser(name)
        p.add_argument('stage', type=int)
        p.add_argument('--week', required=True)
        p.add_argument('--piece')
        p.add_argument('--plans', help='the plans folder (default docs/plans)')
        if name == 'run':
            p.add_argument('--set', action='append', default=[], metavar='KEY=VALUE')
            p.add_argument('--only', action='append', metavar='ROW')
            p.add_argument('--dry', action='store_true')
    d = sub.add_parser('drain')
    d.add_argument('--week')
    d.add_argument('--plans')
    li = sub.add_parser('list')
    li.add_argument('stage', nargs='?', type=int)
    a = ap.parse_args(argv)
    cfg = inject.pop('cfg', None) or cycle()
    out = inject.pop('out', print)
    if a.cmd == 'list':
        out('\n'.join(list_lines(cfg, a.stage)))
        return 0
    if a.cmd == 'check':
        found = check(a.stage, a.week, a.piece, a.plans, cfg)
        out('\n'.join(f['line'] for f in found) if found else f'stage {a.stage}: every required touch is on the log')
        return 1 if found else 0
    runner = Runner(cfg, plans=getattr(a, 'plans', None), dry=getattr(a, 'dry', False), out=out, **inject)
    if a.cmd == 'drain':
        code, _ = runner.drain(a.week)
        return code
    if not any(s['id'] == a.stage for s in cfg['stages']):
        out(f'no stage {a.stage}')
        return 2
    lines = runner.run(a.stage, a.week, a.piece, _sets(a.set), set(a.only) if a.only else None)
    return 1 if any(x['status'] == 'failed' for x in lines) else 0


if __name__ == '__main__':
    sys.exit(main())
