#!/usr/bin/env python3
"""Report to the Publish Board and use a piece's materials from any session in a checkout of this repository.

Every prompt the board copies out says to report as the session goes (apps/control-plane/api/board/_writeBack.ts).
In a claude.ai chat, or any session with Control Centre's connector, the same is the connector's tools
(get_piece_board, report_board_session, add_piece_material, read_piece_material). Both land on the same engine routes
(/api/content-ideas/sessions and /api/content-ideas/store) and the same database rules: a report is appended and lands
once however often it is sent; nothing on file is deleted or overwritten. docs/PUBLISH_BOARDS.md, "Sessions and
materials".

Usage (PIECE is the piece id; for a day with no piece yet it is day:MONDAY/mon..sun, for example day:2026-11-16/tue):
  python3 scripts/post-pack/board_session.py PIECE show
      what is on file for the piece, its day and its week, and who else is working on it
  python3 scripts/post-pack/board_session.py PIECE start "Reading the lock" --step board
      prints the session id it chose; pass it as --session on every later call
  python3 scripts/post-pack/board_session.py PIECE progress "Script one drafted" --session ID --step board
  python3 scripts/post-pack/board_session.py PIECE done "Storyboard and both scripts filed" --session ID --step board
  python3 scripts/post-pack/board_session.py PIECE blocked "Need Krish to pick the opening" --session ID --step board
  python3 scripts/post-pack/board_session.py PIECE add FILE_OR_TEXT_OR_URL [--title T] [--role R] [--kind K] [--note N] [--session ID]
      a file (a screenshot, a PDF, a Markdown corpus), a link, or text; files are hashed, uploaded and read back
  python3 scripts/post-pack/board_session.py PIECE read MATERIAL_ID [--out DIR]
      a text is printed; a file is saved to DIR (default .scratch/materials/)
  python3 scripts/post-pack/board_session.py PIECE archive MATERIAL_ID --reason "why"
      hidden from the lists, never deleted

The engine key comes from scripts/engine.py (ENGINE_OPERATOR_TOKEN, the cloud session's network secret, or Windows
Credential Manager); it is never printed or written anywhere. Writes are recorded as --by (default "Claude Code", or
"Codex" inside Codex).
"""
import argparse
import hashlib
import json
import mimetypes
import os
import random
import string
import sys
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import engine  # noqa: E402

KINDS = ('start', 'progress', 'heartbeat', 'blocked', 'done', 'end')
TEXT_FILES = {'.md', '.txt', '.csv', '.json', '.html', '.htm', '.srt', '.vtt'}
TEXT_MAX = 2_000_000


def default_by(environ=None):
    environ = os.environ if environ is None else environ
    named = (environ.get('MAKING_BY') or '').strip()
    if named:
        return named
    if any(name.startswith('CODEX') for name in environ):
        return 'Codex'
    return 'Claude Code'


def new_session_id(step):
    letters = ''.join(random.choice(string.ascii_lowercase) for _ in range(4))
    return f"{(step or 'session')[:20]}-{letters}"


def scope(args):
    target = (args.piece or '').strip()
    if target.startswith('day:'):
        week, _, day = target[4:].partition('/')
        out = {'week': week}
        if day and day != 'week':
            out['day'] = day
        return out
    if target:
        return {'piece_id': target.lower()}
    raise SystemExit('Name the piece id, or day:MONDAY/DAY for a day with no piece yet.')


def query(args):
    return urllib.parse.urlencode({('piece' if k == 'piece_id' else k): v for k, v in scope(args).items()})


def report_body(args, kind):
    session = args.session or (new_session_id(args.step) if kind == 'start' else None)
    if not session:
        raise SystemExit('Pass --session with the id `start` printed (or start the session first).')
    body = {**scope(args), 'session_id': session, 'kind': kind, 'by': args.by, 'surface': 'claude-code' if args.by != 'Codex' else 'codex'}
    if args.step:
        body['step'] = args.step
    if args.line:
        body['summary'] = args.line
    if args.key:
        body['client_key'] = args.key
    return body


def material_body(args, target):
    """(op, body, file path or None) for one thing to file: a file on disk, a link, or text."""
    base = {**scope(args), 'by': args.by}
    for k in ('title', 'role', 'kind', 'note', 'session'):
        v = getattr(args, k, None)
        if v:
            base['session_id' if k == 'session' else k] = v
    path = Path(target)
    if len(target) < 1024 and path.is_file():
        if path.suffix.lower() in TEXT_FILES and path.stat().st_size <= TEXT_MAX:
            text = path.read_text(encoding='utf-8')
            return 'text', {**base, 'content': text, 'title': base.get('title') or path.name, 'kind': base.get('kind') or 'corpus',
                            'source_ref': f'file:{path.name}'}, None
        data = path.read_bytes()
        return 'file', {**base, 'name': path.name, 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
                        'title': base.get('title') or path.name}, path
    if target.startswith(('http://', 'https://')) and '\n' not in target:
        return 'link', {**base, 'url': target}, None
    return 'text', {**base, 'content': target}, None


def call(method, path, body=None):
    status, text = engine.call(method, path, body, token=engine.operator_key())
    try:
        answer = json.loads(text) if text else {}
    except ValueError:
        answer = {'ok': False, 'error': text[:300]}
    return status, answer


def put_bytes(upload, data):
    req = urllib.request.Request(upload['url'], data=data, method='PUT')
    for k, v in (upload.get('headers') or {}).items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=600) as r:
        return r.status


def show(answer):
    lines = []
    piece = answer.get('piece') or {}
    lines.append(f"{piece.get('idea') or answer.get('scope')} ({piece.get('scheduled_for') or answer.get('week')}, {piece.get('series') or answer.get('day') or ''})")
    sessions = answer.get('sessions') or []
    working = [s for s in sessions if s.get('state') in ('working', 'blocked')]
    lines.append(f"Sessions: {len(working)} working now, {len(sessions)} in all")
    for s in sessions[:12]:
        lines.append(f"  {s.get('state'):8} {s.get('session_id')} ({s.get('by')}) {s.get('step') or ''}: {s.get('doing') or ''}")
    mats = answer.get('materials') or []
    lines.append(f"Materials: {len(mats)}")
    for m in mats:
        lines.append(f"  {m.get('id')}  {m.get('where'):5} {m.get('kind'):10} v{m.get('version')}  {m.get('title')}  ({m.get('bytes')} bytes, {m.get('added_by')})")
    fields = answer.get('fields') or {}
    if fields:
        lines.append('Fields: ' + ', '.join(f"{k} (revision {v.get('revision')})" for k, v in fields.items()))
    return '\n'.join(lines)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('piece', help='the piece id, or day:MONDAY/DAY for a day with no piece yet')
    p.add_argument('command', choices=('show',) + KINDS + ('add', 'read', 'archive'))
    p.add_argument('line', nargs='?', help='the one plain line (a report), or what to add, or a material id')
    p.add_argument('--session'); p.add_argument('--step'); p.add_argument('--key', help='this report\'s own retry key')
    p.add_argument('--title'); p.add_argument('--role'); p.add_argument('--kind'); p.add_argument('--note')
    p.add_argument('--reason'); p.add_argument('--out', default='.scratch/materials')
    p.add_argument('--by', default=default_by())
    p.add_argument('--json', action='store_true', help='print the engine\'s answer whole')
    args = p.parse_args(argv)
    try:
        if args.command == 'show':
            status, answer = call('GET', f'/api/content-ideas/store?{query(args)}')
            print(json.dumps(answer, indent=1) if args.json or status != 200 else show(answer))
            return 0 if status == 200 else 1
        if args.command in KINDS:
            body = report_body(args, args.command)
            status, answer = call('POST', '/api/content-ideas/sessions', body)
            if status in (200, 201):
                others = [o for o in answer.get('others') or [] if o.get('state') in ('working', 'blocked')]
                print(f"Reported {args.command} as session {body['session_id']}{' (already recorded)' if answer.get('duplicate') else ''}."
                      + (f" {len(others)} other session(s) working on this piece: " + '; '.join(f"{o.get('session_id')} {o.get('step') or ''} {o.get('doing') or ''}".strip() for o in others) if others else ''))
                for f in answer.get('fields') or []:
                    if not f.get('ok'):
                        print(f"Field {f.get('name')} not set: another session set it first (revision {f.get('revision')}, now {json.dumps(f.get('value'))}). Read it, merge, and set it again at that revision.")
            else:
                print(json.dumps(answer))
            return 0 if status in (200, 201) else 1
        if args.command == 'add':
            if not args.line:
                raise SystemExit('Name a file, a link or the text to add.')
            op, body, path = material_body(args, args.line)
            if op != 'file':
                status, answer = call('POST', f'/api/content-ideas/store?op={op}', body)
            else:
                status, answer = call('POST', '/api/content-ideas/store?op=upload-url', body)
                if status == 200 and answer.get('upload'):
                    put_bytes(answer['upload'], path.read_bytes())
                if status == 200:
                    status, answer = call('POST', '/api/content-ideas/store?op=confirm', body)
            m = answer.get('material') or {}
            print(json.dumps(answer, indent=1) if args.json or status not in (200, 201) else
                  f"Filed {m.get('kind')} \"{m.get('title')}\" as {m.get('id')} (version {m.get('version')}{', already on file' if answer.get('duplicate') else ''}).")
            return 0 if status in (200, 201) else 1
        if args.command == 'read':
            mid = args.line or ''
            status, answer = call('GET', f'/api/content-ideas/store?op=read&id={urllib.parse.quote(mid)}&link=1')
            if status != 200:
                print(json.dumps(answer)); return 1
            if 'content' in answer:
                print(answer['content']); return 0
            m = answer.get('material') or {}
            if m.get('kind') == 'link' or not answer.get('expires_in'):
                print(answer.get('url')); return 0
            out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
            ext = mimetypes.guess_extension(m.get('content_type') or '') or ''
            target = out / f"{m.get('id')}{ext}"
            with urllib.request.urlopen(answer['url'], timeout=600) as r:
                data = r.read()
            if hashlib.sha256(data).hexdigest() != m.get('sha256'):
                print('The bytes read back do not match the material\'s sha256; nothing saved.'); return 1
            target.write_bytes(data)
            print(f"Saved {m.get('title')} to {target}"); return 0
        if args.command == 'archive':
            status, answer = call('POST', '/api/content-ideas/store?op=archive', {'id': args.line, 'reason': args.reason or '', 'by': args.by})
            print('Archived (kept, hidden from the lists).' if status == 200 else json.dumps(answer))
            return 0 if status == 200 else 1
    except engine.NoKey as e:
        print(str(e)); return 2
    except engine.Unreachable as e:
        print(str(e)); return 2
    return 1


if __name__ == '__main__':
    sys.exit(main())
