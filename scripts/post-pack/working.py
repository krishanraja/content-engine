#!/usr/bin/env python3
"""working: a post's working files, from Krish's Drive to any session.

A session's drawn work (screenshots, cards, panels, charts, story clips)
lives in its own container until it is saved. Friday 16 October's lived only
in the 17 October container, so the next session found none of it (18 Oct).
Krish saved it into the post's folders on Drive, in a folder named
"working <date>" under "2 Covers and images" and "3 Video". This lane carries
any such folder into the engine's library, so a cloud session fetches it the
way it fetches a take, without the Drive connector (10 MB a file, and every
byte through the chat).

    python working.py publish
        A home computer, every pass of recordings-upload.ps1: sends every file
        under <makeyourmindup>/3 Posts/<post>/<part>/working <...>/ to the
        library at the same path, with a working-files.json list beside them.
        Files the library already holds are skipped.
    python working.py fetch "<post folder>" [--out DIR]
        Any machine: gets them back, checked by sha256, into DIR/<part>/<working ...>/.
    python working.py --self-test
"""
import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
for p in (HERE, REPO / 'scripts'):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

LIST_NAME = 'working-files.json'  # not '.working.json': the library refuses a hidden name (path_hidden_part), so until 18 Oct no working folder ever reached it
PURPOSE = "a session's working files for this post (screenshots, cards, panels, charts, clips), saved by Krish"


class WorkingError(Exception):
    pass


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def posts_root():
    """<makeyourmindup>/3 Posts on this machine, or None.

    runtime.library_root in config/studio.json names makeyourmindup itself,
    so this no longer assumes where Video Engine sits (Krish moves folders:
    2026-10-24, "Folders get renamed all the time and moved all the time").
    MINDMAKE_POSTS_ROOT, when set, wins only while it names a folder that is
    there; a stale one is said on stderr and studio.json is used."""
    try:
        runtime = json.loads((REPO / 'config' / 'studio.json').read_text(encoding='utf-8')).get('runtime') or {}
    except (OSError, ValueError):
        runtime = {}
    library = runtime.get('library_root')
    configured = Path(library) / '3 Posts' if library else None
    env = os.environ.get('MINDMAKE_POSTS_ROOT')
    if env:
        if Path(env).is_dir() or configured is None or not configured.is_dir():
            return Path(env)
        print(f'MINDMAKE_POSTS_ROOT names {env}, which is not there; using {configured}. Delete the setting.', file=sys.stderr)
    return configured


def working_folders(root):
    """[(library prefix, folder)] for every '<post>/<part>/working ...' folder."""
    out = []
    for post in sorted(p for p in root.iterdir() if p.is_dir()):
        for part in sorted(p for p in post.iterdir() if p.is_dir()):
            for w in sorted(p for p in part.iterdir() if p.is_dir() and p.name.lower().startswith('working ')):
                out.append((f'3 Posts/{post.name}/{part.name}/{w.name}', w))
    return out


def files_of(folder):
    return sorted((p.relative_to(folder).as_posix(), p) for p in folder.rglob('*')
                  if p.is_file() and not any(s.startswith('.') for s in p.relative_to(folder).parts)
                  and p.relative_to(folder).as_posix() != LIST_NAME)


def plan_folder(prefix, folder):
    """[(library path, Path, purpose)] for one working folder, its list last."""
    import library
    planned, listing = [], []
    for rel, path in files_of(folder):
        target = f'{prefix}/{rel}'
        code = library.refusal(target)
        if code:
            # One name the library refuses never holds back the rest of the folder.
            print(f'working: left out {target}: {library.explain(code)}', file=sys.stderr)
            continue
        if path.stat().st_size > library.MAX_BYTES or path.stat().st_size == 0:
            continue
        planned.append((target, path, PURPOSE))
        listing.append({'path': rel, 'sha256': sha256_of(path), 'bytes': path.stat().st_size})
    return planned, listing


def cmd_publish(out=print):
    root = posts_root()
    if not root or not root.is_dir():
        raise WorkingError('the posts folder is not reachable here (runtime.library_root in config/studio.json, or MINDMAKE_POSTS_ROOT)')
    import send
    total = {'sent': 0, 'already': 0, 'confirmed_only': 0, 'folders': 0}
    api = None
    # A pass every five minutes: a folder unchanged since it went in is not asked about again.
    state_file = REPO / '.cache' / 'working-published.json'
    try:
        state = json.loads(state_file.read_text())
    except (OSError, ValueError):
        state = {}
    for prefix, folder in working_folders(root):
        planned, listing = plan_folder(prefix, folder)
        if not planned:
            continue
        digest = hashlib.sha256(json.dumps(listing, sort_keys=True).encode()).hexdigest()
        if state.get(prefix) == digest:
            continue
        with tempfile.TemporaryDirectory() as tmp:
            lst = Path(tmp) / LIST_NAME
            lst.write_text(json.dumps({'prefix': prefix, 'files': listing}, indent=1), encoding='utf-8')
            api = api or send.Engine('working-publish')
            try:
                done = send.send(planned + [(f'{prefix}/{LIST_NAME}', lst, 'the list of working files in this folder')], api, out=out)
            except send.SendError as error:
                raise WorkingError(str(error))
        total['folders'] += 1
        for k in ('sent', 'already', 'confirmed_only'):
            total[k] += done.get(k, 0)
        state[prefix] = digest
        state_file.parent.mkdir(parents=True, exist_ok=True)
        state_file.write_text(json.dumps(state, indent=1))
    return total


def _get(engine, token, library_path):
    # A fetch probes every dated folder name in every part (about 80 small requests); one dropped connection
    # must not end it, so each request gets three tries.
    for attempt in range(3):
        try:
            status, text = engine.call('GET', '/api/library/file?path=' + urllib.parse.quote(library_path), None, token, timeout=60)
            break
        except engine.Unreachable:
            if attempt == 2:
                raise
            import time
            time.sleep(2 * (attempt + 1))
    answer = json.loads(text) if text and text.strip().startswith('{') else {}
    url = (answer.get('download') or {}).get('url') if isinstance(answer, dict) else None
    return status, url


def cmd_fetch(post, out_dir=None, out=print):
    import engine
    token = engine.operator_key()
    base = Path(out_dir or REPO / '.cache' / 'working' / post)
    got = 0
    # Every dated working folder in every part: a post can have several (Friday 16 Oct had 17 and 18 Oct), and
    # stopping at the first one found left the 17 Oct cards behind.
    found = []
    for part in ('1 Article', '2 Covers and images', '3 Video', '4 Social'):
        for name in [f'working {d}' for d in _recent_dates()]:
            status, url = _get(engine, token, f'3 Posts/{post}/{part}/{name}/{LIST_NAME}')
            if status == 200 and url:
                found.append(url)
    for url in found:
        with urllib.request.urlopen(url, timeout=120) as r:
            listing = json.loads(r.read().decode())
        prefix = listing['prefix']
        folder = base / prefix.split('/', 2)[2]
        for f in listing['files']:
            target = folder / f['path']
            if target.is_file() and sha256_of(target) == f['sha256']:
                continue
            status, url = _get(engine, token, f'{prefix}/{f["path"]}')
            if status != 200 or not url or not url.startswith('https://'):
                raise WorkingError(f'{prefix}/{f["path"]}: the library answered {status} (a home computer sends it on its next pass)')
            target.parent.mkdir(parents=True, exist_ok=True)
            part_file = target.with_name(target.name + '.part')
            with urllib.request.urlopen(url, timeout=600) as r, open(part_file, 'wb') as h:
                shutil.copyfileobj(r, h)
            if sha256_of(part_file) != f['sha256']:
                part_file.unlink()
                raise WorkingError(f'{f["path"]}: the download does not match its sha256')
            part_file.replace(target)
            got += 1
        out(f'{prefix}: {len(listing["files"])} files in {folder}')
    return got


def _recent_dates(days=21):
    import datetime
    today = datetime.date.today()
    seen = []
    for n in range(days):
        d = today - datetime.timedelta(days=n)
        seen.append(f'{d.day} {d.strftime("%b")}')
    return seen


def self_test():
    checks = []
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / '3 Posts'
        w = root / '2026-10-16 Fri mind.the.gap - X' / '3 Video' / 'working 17 Oct'
        (w / 'panels').mkdir(parents=True)
        (w / 'panels' / 'a.png').write_bytes(b'png')
        (w / '.hidden').write_bytes(b'x')
        (root / '2026-10-16 Fri mind.the.gap - X' / '3 Video' / 'final').mkdir()
        found = working_folders(root)
        checks.append(('finds only working folders', [p for p, _ in found] == ['3 Posts/2026-10-16 Fri mind.the.gap - X/3 Video/working 17 Oct']))
        planned, listing = plan_folder(*found[0])
        checks.append(('plans each file under its library path', [t for t, _, _ in planned] == ['3 Posts/2026-10-16 Fri mind.the.gap - X/3 Video/working 17 Oct/panels/a.png']))
        checks.append(('hidden files stay home', len(listing) == 1 and listing[0]['path'] == 'panels/a.png'))
    checks.append(('dates read as the folders are named', '17 Oct' in _recent_dates(400)))
    bad = [n for n, ok in checks if not ok]
    print(f'working self-test {"passed" if not bad else "FAILED"}: {len(checks)} checks' + (f' ({", ".join(bad)})' if bad else ''))
    return 0 if not bad else 1


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('cmd', nargs='?', choices=['publish', 'fetch'])
    ap.add_argument('post', nargs='?')
    ap.add_argument('--out')
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        return self_test()
    try:
        if a.cmd == 'publish':
            print(json.dumps(cmd_publish()))
        elif a.cmd == 'fetch' and a.post:
            print(f'fetched {cmd_fetch(a.post, a.out)} files')
        else:
            ap.print_help()
            return 2
    except WorkingError as error:
        print(f'working: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[1]))
    import quiet_errors  # G7: one line on failure, the traceback to .cache/logs
    sys.exit(quiet_errors.run(main, 'working'))
