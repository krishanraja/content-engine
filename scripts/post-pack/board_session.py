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
  python3 scripts/post-pack/board_session.py PIECE approve lock --week MONDAY --day mon --lock LOCK.md \
      --words "his exact words" --said-at ISO --where "where he typed them" --session-ref URL [--sign]
  python3 scripts/post-pack/board_session.py PIECE approve scripts --week MONDAY --day mon --long FILE [--short FILE] \
      --long-title T [--short-title T] --folder-title T --words "his exact words" --said-at ISO --where "..." --session-ref URL
      his typed approval of the narrative lock or of the scripts, carried to the board as his words (Ruling, Krish,
      2026-11-12: "Scripts and locks only. Typed approval counts for locking a story and approving a script; putting an
      idea on the publish board still needs your press, so that gate is unchanged."). Only words he typed to this
      session, verbatim; never a summary, never for an idea. The board shows it as "Approved in your words"; approved
      scripts go to his Teleprompter as the Approve scripts press sends them (held until the scripts' check and the two
      fresh readers have passed). --sign also writes his words as the lock's signature line, bound to its sha256.

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
import re
import string
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent))
import engine  # noqa: E402

KINDS = ('start', 'progress', 'heartbeat', 'blocked', 'done', 'end')
DAYS = ('mon', 'wed', 'fri')
CUTS = ('long', 'short', 'feature')
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


class Refused(ValueError):
    """A typed approval that cannot be carried, in plain words."""


def said(words, said_at, where, session_ref):
    """His words as the board keeps them: verbatim, when and where he typed them, and the session link."""
    if not isinstance(words, str) or not words.strip() or len(words) > 2000:
        raise Refused('--words: his exact typed words, 1 to 2000 characters, never a summary of them')
    try:
        datetime.fromisoformat(str(said_at).replace('Z', '+00:00'))
    except ValueError:
        raise Refused('--said-at: when he typed them, an ISO time') from None
    if not where or len(where) > 300 or any(ord(c) < 32 for c in where):
        raise Refused('--where: where he typed them, one line')
    if not re.fullmatch(r'https://\S{1,290}', session_ref or ''):
        raise Refused('--session-ref: the https link of the session he typed them in')
    return {'words': words, 'said_at': said_at, 'said_where': where, 'session_ref': session_ref}


def lock_words_body(piece, day, lock_path, text, words, said_at, where, session_ref, at=None):
    """picks/<day>-lock-words: his typed approval of the narrative lock, bound to the words above any signature
    (making.py lock_body_hash). A signature already on the lock must carry these same words."""
    import making  # noqa: PLC0415
    if day not in DAYS:
        raise Refused(f'{day}: a lock is for mon, wed or fri')
    if not re.fullmatch(r'docs/plans/\d{4}-\d{2}-\d{2}-week/narrative-lock-(mon|wed|fri)\.md', lock_path) or not lock_path.endswith(f'-{day}.md'):
        raise Refused(f'--lock is docs/plans/<Monday>-week/narrative-lock-{day}.md')
    signed = making.lock_signature(text)
    if signed and signed[0] != words.strip():
        raise Refused(f'the lock is already signed with other words ("{signed[0]}"); his typed approval must be the words he signed')
    return {'kind': 'sign_lock', 'day': day, 'via': 'words', 'approved': True, 'piece_id': piece, 'lock_path': lock_path,
            'lock_sha256': making.lock_body_hash(text), 'at': at or now_iso(), **said(words, said_at, where, session_ref)}


def scripts_words_body(piece, day, texts, titles, folder_title, words, said_at, where, session_ref, at=None):
    """picks/<day>-scripts-words: his typed approval of these exact words, cut by cut, as the Approve scripts press
    carries them (the server hashes each cut and sends them to Teleprompter as it does for the press)."""
    if day not in DAYS:
        raise Refused(f'{day}: scripts are approved for mon, wed or fri')
    if not texts or any(c not in CUTS for c in texts) or any(not str(t).strip() for t in texts.values()):
        raise Refused('the scripts: --long, and --short or --feature where there is one, each a file of his words')
    if set(titles) != set(texts) or any(not str(t).strip() or len(t) > 200 for t in titles.values()):
        raise Refused('a Teleprompter title for each cut given (--long-title, --short-title, --feature-title)')
    if not folder_title or len(folder_title) > 200:
        raise Refused('--folder-title: the Teleprompter folder they go in')
    return {'kind': 'approve_scripts', 'day': day, 'via': 'words', 'approved': True, 'piece_id': piece, 'texts': texts,
            'titles': titles, 'folder_title': folder_title, 'at': at or now_iso(), **said(words, said_at, where, session_ref)}


def now_iso():
    return datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')


def sign_lock(path, words, on):
    """His words as the lock's signature line, bound to its sha256 (making.py's own format), when it has none."""
    import making  # noqa: PLC0415
    text = Path(path).read_text(encoding='utf-8')
    if making.lock_signature(text):
        return text
    line = f'Signed by Krish: "{words.strip()}", {on}, lock sha256 {making.lock_body_hash(text)}'
    signed = text.rstrip('\n') + '\n\n' + line + '\n'
    Path(path).write_text(signed, encoding='utf-8')
    return signed


def approve(args):
    """Carry his typed approval of the lock or the scripts to the week's board; return (status, answer, doc id)."""
    if args.what not in ('lock', 'scripts'):
        raise Refused('approve lock, or approve scripts: typed approval counts for nothing else (Ruling, Krish, 2026-11-12)')
    piece = (args.piece or '').lower()
    if not re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', piece):
        raise Refused('the piece id is the content_ideas uuid')
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', args.week or ''):
        raise Refused('--week: the Monday of the board week')
    if args.what == 'lock':
        if not args.lock:
            raise Refused('--lock: the narrative lock file he approved')
        text = Path(args.lock).read_text(encoding='utf-8')
        if args.sign:
            text = sign_lock(args.lock, args.words or '', str(args.said_at or '')[:10])
        rel = Path(args.lock).resolve().relative_to(ROOT).as_posix() if Path(args.lock).resolve().is_relative_to(ROOT) else args.lock
        body = lock_words_body(piece, args.day, rel, text, args.words, args.said_at, args.where, args.session_ref)
    else:
        texts = {c: Path(f).read_text(encoding='utf-8') for c, f in (('long', args.long), ('short', args.short), ('feature', args.feature)) if f}
        titles = {c: t for c, t in (('long', args.long_title), ('short', args.short_title), ('feature', args.feature_title)) if t}
        body = scripts_words_body(piece, args.day, texts, titles, args.folder_title, args.words, args.said_at, args.where, args.session_ref)
    doc = f'{args.day}-{args.what}-words'
    status, listing = call('GET', f'/api/board/{args.week}/picks')
    revisions = {d.get('id'): d.get('revision', 0) for d in (listing.get('documents') or [])} if status == 200 else {}
    status, answer = call('PUT', f'/api/board/{args.week}/picks/{doc}', {'body': body, 'revision': revisions.get(doc, 0)})
    return status, answer, doc


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


def library_line(library):
    """What the store said about the research library copy (docs/DRIVE.md, "The research library")."""
    if not isinstance(library, dict):
        return ''
    state = library.get('state')
    if state in ('copied', 'already') and library.get('link'):
        return f"In the research library: {library['link']}"
    if state == 'later':
        return 'The research library copy follows within the hour (the store holds it already).'
    return ''


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('piece', help='the piece id, or day:MONDAY/DAY for a day with no piece yet')
    p.add_argument('command', choices=('show',) + KINDS + ('add', 'read', 'archive', 'approve'))
    p.add_argument('line', nargs='?', help='the one plain line (a report), or what to add, or a material id')
    p.add_argument('--session'); p.add_argument('--step'); p.add_argument('--key', help='this report\'s own retry key')
    p.add_argument('--title'); p.add_argument('--role'); p.add_argument('--kind'); p.add_argument('--note')
    p.add_argument('--reason'); p.add_argument('--out', default='.scratch/materials')
    p.add_argument('--by', default=default_by())
    p.add_argument('--json', action='store_true', help='print the engine\'s answer whole')
    # approve: his typed approval of the narrative lock or the scripts (Ruling, Krish, 2026-11-12).
    p.add_argument('--week'); p.add_argument('--day', choices=DAYS); p.add_argument('--lock'); p.add_argument('--sign', action='store_true')
    p.add_argument('--long'); p.add_argument('--short'); p.add_argument('--feature')
    p.add_argument('--long-title'); p.add_argument('--short-title'); p.add_argument('--feature-title'); p.add_argument('--folder-title')
    p.add_argument('--words'); p.add_argument('--said-at'); p.add_argument('--where'); p.add_argument('--session-ref')
    args = p.parse_args(argv)
    try:
        if args.command == 'approve':
            args.what = args.line
            try:
                status, answer, doc = approve(args)
            except (Refused, OSError) as e:
                print(f'Not carried: {e}'); return 1
            if status in (200, 201) and answer.get('ok') is not False:
                send = (answer.get('send') or {})
                print(f'Carried his words to the board as picks/{doc}: it shows "Approved in your words".'
                      + (f' Teleprompter: {send.get("status")}{" (" + send.get("error") + ")" if send.get("error") else ""}.' if send else ''))
                return 0
            print(json.dumps(answer)); return 1
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
            library = library_line(answer.get('library'))
            if library and not args.json and status in (200, 201):
                print(library)
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
