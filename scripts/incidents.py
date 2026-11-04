#!/usr/bin/env python3
"""The failure loop's capture, from Python (Krish, 2026-11-04: "how can your system autonomously understand the
difference between a repeated failure, why it happened, what was being done when the failure occurred and how it was
being done ... all of this stuff should feed an intelligent system that automatically gets more intelligent every
week").

One incident is one thing that went wrong in production, written the moment it happened: the Critic's block
(scripts/velib/verdict.py), a lint override (scripts/ve.py lint), a guard test that fails (check_failures.py --run).
Each goes to POST /api/learning/incidents (the engine_incidents table); when the engine cannot be reached, or the
writer is offline (Codex's sandbox, INCIDENTS_OFFLINE=1), it waits in .cache/incidents.jsonl and the next write, or
`flush`, sends it. A write never stops the work it rides on.

    python3 scripts/incidents.py show            # what waits offline
    python3 scripts/incidents.py flush           # send what waits
    python3 scripts/incidents.py --self-test

Standard library only.
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUEUE = ROOT / '.cache' / 'incidents.jsonl'
STAGES = ('brief', 'script', 'storyboard', 'style', 'proof', 'cut', 'package', 'post', 'board', 'session')
MAKERS = ('claude', 'codex', 've', 'krish', 'unknown')
KINDS = ('krish_reject', 'critic_block', 'override', 'guard_fired', 'second_round')
PATH = '/api/learning/incidents'


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def client_ref(*parts) -> str:
    """A stable key for the same event, so a lint run twice files once."""
    return 'py-' + hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:40]


def maker_here(environ=None) -> str:
    environ = os.environ if environ is None else environ
    return 'codex' if any(name.startswith('CODEX') for name in environ) else 'claude'


def problems(incident: dict) -> list[str]:
    out = []
    if incident.get('stage') not in STAGES:
        out.append(f'stage is one of {", ".join(STAGES)}')
    if incident.get('kind') not in KINDS:
        out.append(f'kind is one of {", ".join(KINDS)}')
    if incident.get('maker', 'unknown') not in MAKERS:
        out.append(f'maker is one of {", ".join(MAKERS)}')
    if incident.get('his_words') and incident.get('kind') != 'krish_reject':
        out.append('his_words is only on a krish_reject')
    return out


def _engine_call(method, path, body):
    sys.path.insert(0, str(ROOT / 'scripts'))
    import engine  # noqa: PLC0415
    return engine.call(method, path, body, engine.operator_key(), timeout=20)


def _queue(rows, queue=QUEUE):
    queue.parent.mkdir(parents=True, exist_ok=True)
    with queue.open('a', encoding='utf-8', newline='\n') as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + '\n')


def waiting(queue=QUEUE) -> list[dict]:
    if not queue.is_file():
        return []
    out = []
    for line in queue.read_text(encoding='utf-8').splitlines():
        try:
            out.append(json.loads(line))
        except ValueError:
            continue
    return out


def _send(rows, call):
    status, text = call('POST', PATH, {'incidents': rows})
    if status != 200:
        raise RuntimeError(f'HTTP {status}: {str(text)[:200]}')


def flush(call=None, queue=QUEUE) -> int:
    """Sends what waits offline; returns how many were sent. Leaves them waiting when the engine cannot take them."""
    rows = waiting(queue)
    if not rows:
        return 0
    try:
        for start in range(0, len(rows), 50):
            _send(rows[start:start + 50], call or _engine_call)
    except Exception:  # noqa: BLE001 - no key, no network: they keep waiting
        return 0
    queue.unlink(missing_ok=True)
    return len(rows)


def record(incident: dict, call=None, queue=QUEUE, environ=None) -> str:
    """Files one incident: 'filed', 'queued' (offline; .cache/incidents.jsonl) or 'refused: ...'. Never raises."""
    environ = os.environ if environ is None else environ
    try:
        row = {'at': now(), 'maker': maker_here(environ), **{k: v for k, v in incident.items() if v is not None}}
        wrong = problems(row)
        if wrong:
            return 'refused: ' + '; '.join(wrong)
        if environ.get('INCIDENTS_OFFLINE') == '1' or (call is None and environ.get('VE_GATES_OFFLINE') == '1'):
            _queue([row], queue)
            return 'queued'
        try:
            _send([row], call or _engine_call)
        except Exception:  # noqa: BLE001 - any failure to reach the engine queues it
            _queue([row], queue)
            return 'queued'
        flush(call, queue)
        return 'filed'
    except Exception as error:  # noqa: BLE001 - a write never stops the work it rides on
        return f'refused: {type(error).__name__}'


def self_test() -> int:
    import tempfile
    sent = []

    def ok(method, path, body):
        sent.append(body)
        return 200, '{"ok":true}'

    def down(method, path, body):
        raise OSError('no network')

    with tempfile.TemporaryDirectory() as tmp:
        queue = Path(tmp) / 'incidents.jsonl'
        base = {'stage': 'cut', 'kind': 'critic_block', 'client_ref': client_ref('x')}
        assert record(dict(base), call=down, queue=queue, environ={}) == 'queued'
        assert len(waiting(queue)) == 1
        assert record(dict(base, client_ref=client_ref('y')), call=ok, queue=queue, environ={}) == 'filed'
        assert not queue.exists() and len(sent) == 2, (queue.exists(), sent)
        assert record({'stage': 'nowhere', 'kind': 'critic_block'}, call=ok, queue=queue, environ={}).startswith('refused')
        assert record(dict(base, his_words='x'), call=ok, queue=queue, environ={}).startswith('refused')
        assert record(dict(base), queue=queue, environ={'INCIDENTS_OFFLINE': '1'}) == 'queued'
        assert maker_here({'CODEX_HOME': '1'}) == 'codex' and maker_here({}) == 'claude'
    print('incidents.py self-test: ok')
    return 0


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ['--self-test']:
        return self_test()
    if argv[:1] == ['show']:
        for row in waiting():
            print(json.dumps(row, ensure_ascii=False))
        return 0
    if argv[:1] == ['flush']:
        before = len(waiting())
        sent = flush()
        print(f'incidents: {sent} sent, {before - sent} still waiting')
        return 0 if sent == before else 1
    print(__doc__)
    return 2


if __name__ == '__main__':
    sys.exit(main())
