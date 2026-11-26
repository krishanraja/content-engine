"""Approval ledger and render-manifest I/O. Only explicit lock/unlock edits the ledger."""
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
from uuid import uuid4

from frame_capture import fingerprint
from render_inputs import file_hash


def read_json(path):
    return json.loads(path.read_text(encoding='utf8'))


def atomic_json(path, value):
    temp = path.with_name('.'+path.name+'-'+uuid4().hex)
    try:
        with temp.open('x', encoding='utf8', newline='\n') as stream:
            json.dump(value, stream, indent=2, ensure_ascii=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


@contextmanager
def guard(here):
    directory = here/'.scratch/library'
    directory.mkdir(parents=True, exist_ok=True)
    with (directory/'render.guard').open('a+b') as handle:
        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b'0')
            handle.flush()
        handle.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except (BlockingIOError,PermissionError) as exc:
            raise ValueError('Another render or approval update holds the worktree guard. Retry after it finishes.') from exc
        try:
            yield
        finally:
            if os.name == 'nt':
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


def ledger(here):
    value = read_json(here/'lock.json')
    if value.get('version') != 1 or any(not isinstance(value.get(k),list)
           for k in ('locked','pending_approval','history')):
        raise ValueError('Invalid lock.json')
    seen = set()
    for row in value['locked']:
        key = row['id']
        if key in seen or row['renderer'] not in ('resvg','browser'):
            raise ValueError(f'{key}: duplicate lock or unknown renderer')
        if not all(isinstance(row.get(k),str) and row[k].strip()
                   for k in ('id','approved_by','date','words')):
            raise ValueError(f'{key}: missing approval information')
        fp = row['fingerprint']
        required = ['first_rgb24_sha256','settled_rgb24_sha256']
        if 'fps' in fp:
            required.extend(('source_rgb24_sha256','decoded_yuv420p_sha256'))
        if any(not re.fullmatch('[0-9a-f]{64}',fp.get(k,'')) for k in required):
            raise ValueError(f'{key}: incomplete SHA-256 fingerprint')
        seen.add(key)
    for key in value['pending_approval']:
        if key in seen:
            raise ValueError(f'{key}: duplicate ID in lock.json')
        seen.add(key)
    return value


def verify(rows, items, capture, scratch):
    failed = []
    for row in rows:
        key = row['id']
        try:
            if key not in items:
                raise ValueError('missing or retired template')
            actual = fingerprint(items[key], capture(row['renderer']), scratch)
            expected = row['fingerprint']
            different = sorted(k for k in actual.keys()|expected.keys() if actual.get(k)!=expected.get(k))
            if different:
                raise ValueError('changed '+', '.join(different))
        except (Exception, SystemExit) as exc:
            print(f'LOCK FAILED {key}: {exc}',file=sys.stderr,flush=True)
            failed.append(key)
    if failed:
        raise ValueError('Lock check failed for '+', '.join(failed))
    print(f'Lock check passed ({len(rows)} locked template(s)).',flush=True)


def change_lock(args, here, items, book, capture):
    key = args.lock or args.unlock
    previous = next((row for row in book['locked'] if row['id']==key), None)
    date = datetime.now(timezone.utc).isoformat(timespec='seconds')
    if args.lock:
        if previous or key not in items:
            raise ValueError(f'{key}: already locked or unknown active template')
        row = dict(id=key, approved_by=args.approved_by, date=date, words=args.words,
                   renderer=args.rasterizer,
                   fingerprint=fingerprint(items[key],capture(args.rasterizer),here/'.scratch/library'))
        book['locked'].append(row)
        if key in book['pending_approval']:
            book['pending_approval'].remove(key)
        book['history'].append(dict(action='lock', **row))
    else:
        if previous is None:
            raise ValueError(f'{key}: no approval to unlock')
        event = dict(action='unlock', id=key, date=date, reason=args.reason, previous=previous)
        if args.reason.lower().endswith('.md'):
            brief = Path(args.reason)
            if not brief.is_file():
                brief = here/brief
            if not brief.is_file() or not re.search(r'(?<![\w-])'+re.escape(key)+r'(?![\w-])',
                                                   brief.read_text(encoding='utf8')):
                raise ValueError(f'{key}: the named brief must exist and explicitly name the template')
            event['brief_sha256'] = file_hash(brief)
        book['history'].append(event)
        book['locked'].remove(previous)
        book['pending_approval'].append(key)
    atomic_json(here/'lock.json',book)
    print(f'{"Locked" if args.lock else "Unlocked"} {key}.')
