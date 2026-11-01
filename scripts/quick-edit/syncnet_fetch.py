#!/usr/bin/env python3
"""Install the lip-sync gate's SyncNet on this machine, from the pins in config/lipsync.json.

Krish, 2026-11-01, on where the model should live: "Yes, do it" (content engine only, fetched, never committed).
The checkout goes to `default_root` at `syncnet_revision`; the model and the face detector's weights come from the
first source in `sources` whose bytes match their pinned sha256. A file that does not match is deleted and never used.
Nothing is committed: `.cache/` is ignored, and model weights never go in git.

    python3 scripts/quick-edit/syncnet_fetch.py            fetch what is missing, then say where it is
    python3 scripts/quick-edit/syncnet_fetch.py --self-test

lipsync_gate.py calls ensure() itself the first time it finds the model missing, so no machine holds a cut only
because nobody installed SyncNet. Set MINDMAKE_SYNCNET_NO_FETCH=1 to stop that.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / 'config/lipsync.json'
REPO = 'https://github.com/joonson/syncnet_python.git'


class FetchError(Exception):
    pass


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def default_paths(cfg, root=ROOT):
    return root / cfg['default_root'], root / cfg['default_model']


def download(url, dest):
    req = urllib.request.Request(url, headers={'User-Agent': 'content-engine-syncnet-fetch'})
    with urllib.request.urlopen(req, timeout=600) as r, open(dest, 'wb') as out:
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)


def fetch_pinned(dest, urls, want, get=download):
    """Put the first source whose bytes hash to `want` at dest; refuse everything else."""
    if dest.is_file() and sha256(dest) == want:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    tried = []
    for url in urls:
        tmp = dest.with_name(dest.name + '.part')
        try:
            get(url, tmp)
            got = sha256(tmp)
            if got == want:
                os.replace(tmp, dest)
                return dest
            tried.append(f'{url}: wrong bytes')
        except Exception as error:  # a source that is down is only one source
            tried.append(f'{url}: {str(error)[:120]}')
        finally:
            if tmp.exists():
                tmp.unlink()
    raise FetchError(f'no source gave {dest.name} with its pinned sha256 ({"; ".join(tried)})')


def checkout(root, revision, run=subprocess.run):
    if not (root / '.git').is_dir():
        root.parent.mkdir(parents=True, exist_ok=True)
        run(['git', 'clone', '-q', REPO, str(root)], check=True)
    head = run(['git', '-C', str(root), 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
    if head != revision:
        run(['git', '-C', str(root), 'fetch', '-q', 'origin'], check=True)
        run(['git', '-C', str(root), 'checkout', '-q', revision], check=True)


def ensure(cfg=None, root=ROOT):
    """Install what is missing and return (checkout, model). Raises FetchError when no pinned source answers."""
    cfg = cfg or json.loads(CONFIG.read_text(encoding='utf-8'))
    src, model = default_paths(cfg, root)
    try:
        checkout(src, cfg['syncnet_revision'])
    except (OSError, subprocess.CalledProcessError) as error:
        raise FetchError(f'the SyncNet checkout could not be fetched: {error}') from None
    fetch_pinned(model, cfg['sources']['model'], cfg['model_sha256'])
    fetch_pinned(src / 'detectors/s3fd/weights/sfd_face.pth', cfg['sources']['detector'], cfg['detector_sha256'])
    return src, model


def self_test():
    ok = True
    def check(name, cond):
        nonlocal ok
        ok &= bool(cond)
        print(('ok   ' if cond else 'FAIL ') + name)
    good = b'pinned bytes'
    want = hashlib.sha256(good).hexdigest()
    with tempfile.TemporaryDirectory() as d:
        d = Path(d)
        def fake(url, dest):
            if 'down' in url:
                raise OSError('connection reset')
            Path(dest).write_bytes(good if 'good' in url else b'tampered')
        dest = d / 'm.model'
        fetch_pinned(dest, ['https://down/x', 'https://bad/x', 'https://good/x'], want, get=fake)
        check('skips a source that is down and one with wrong bytes, takes the pinned one', dest.read_bytes() == good)
        check('leaves no partial file behind', not any(p.name.endswith('.part') for p in d.iterdir()))
        dest2 = d / 'n.model'
        try:
            fetch_pinned(dest2, ['https://bad/x'], want, get=fake)
            check('refuses when no source matches', False)
        except FetchError:
            check('refuses when no source matches', not dest2.exists())
        calls = []
        fetch_pinned(dest, ['https://good/x'], want, get=lambda u, p: calls.append(u))
        check('a file already matching its pin is not fetched again', calls == [])
    cfg = json.loads(CONFIG.read_text(encoding='utf-8'))
    check('config names a model source and a detector source', cfg['sources']['model'] and cfg['sources']['detector'])
    check('config pins the detector', len(cfg.get('detector_sha256', '')) == 64)
    return 0 if ok else 1


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        raise SystemExit(self_test())
    try:
        src, model = ensure()
    except FetchError as error:
        print(f'syncnet_fetch: {error}', file=sys.stderr)
        raise SystemExit(2)
    print(json.dumps({'syncnet_root': str(src), 'model_path': str(model)}))
