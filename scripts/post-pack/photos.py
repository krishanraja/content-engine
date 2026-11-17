#!/usr/bin/env python3
"""photos: Krish's own photos, published from Drive to the engine's library, so any session (a cloud one included)
can build a cover with his face.

    python photos.py publish     a home computer: send every photo in Video Engine > Krish Clone - Assets > Photos
    python photos.py fetch       any machine: get them back from the library (default .cache/photos)
    python photos.py --self-test

Ruling (Krish, 2026-11-17): face-led covers on his own accounts ("yes to the face plan"), drawn by Codex ("actually use
codex to draw"). His cutout headshots live only in that Drive folder; the recordings pass on each home computer
(scripts/recordings-upload.ps1, Publish-Photos) runs `publish` every five minutes, as it publishes the music, and the
library sync writes them into "1 Brand kit (permanent)/Photos/Headshots", where every brand photo belongs
(docs/DRIVE.md, "The brand kit"). Only the top of the folder is sent, never a subfolder ("All other photos" stays put).
"""
import argparse
import json
import os
import sys
import urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(REPO / 'scripts'))

LIBRARY_PHOTOS = '1 Brand kit (permanent)/Photos/Headshots'
FOLDER = ('Krish Clone - Assets', 'Photos')  # under the Video Engine root (config/studio.json drive_ids.drive_root)
EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp')
PURPOSE = "a photo of Krish for face-led covers on his own accounts (Ruling, Krish, 2026-11-17)"


def photos_folder(environ=os.environ):
    """The Photos folder on this computer, or None: MINDMAKE_PHOTOS, else under the Video Engine root found by its
    Drive ID (drive_paths.py), else under config/studio.json runtime.drive_root."""
    if environ.get('MINDMAKE_PHOTOS'):
        return Path(environ['MINDMAKE_PHOTOS'])
    import drive_paths
    root = drive_paths.found_path('drive_root', environ=environ)
    if not root:
        runtime = (json.loads((REPO / 'config' / 'studio.json').read_text(encoding='utf-8')).get('runtime') or {})
        root = Path(runtime['drive_root']) if runtime.get('drive_root') else None
    return root.joinpath(*FOLDER) if root else None


def planned(folder):
    """[(library path, file, purpose)] for each photo at the top of the folder."""
    return [(f'{LIBRARY_PHOTOS}/{p.name}', p, PURPOSE) for p in sorted(Path(folder).iterdir())
            if p.is_file() and p.suffix.lower() in EXTENSIONS and not p.name.startswith('.')]


def cmd_publish(out=print, environ=os.environ):
    folder = photos_folder(environ)
    if not folder or not folder.is_dir():
        return {'sent': 0, 'note': 'the Photos folder is not on this computer'}
    files = planned(folder)
    if not files:
        return {'sent': 0}
    import library
    import send
    refused = [(t, library.refusal(t)) for t, _, _ in files if library.refusal(t)]
    sendable = [f for f in files if not library.refusal(f[0])]
    done = send.send(sendable, send.Engine('photos-publish'), out=out) if sendable else {'sent': 0}
    if refused:
        raise SystemExit('photos: the library refuses ' + '; '.join(f'{t} ({why})' for t, why in refused))
    return done


def cmd_fetch(out_dir):
    import engine
    import urllib.request
    status, answer = engine.call('GET', '/api/library/find?library=makeyourmindup&prefix='
                                 + urllib.parse.quote(LIBRARY_PHOTOS + '/') + '&type=image')
    answer = answer if isinstance(answer, dict) else json.loads(answer)
    if status != 200 or not answer.get('ok'):
        raise SystemExit(f'photos: the library did not answer ({status})')
    out_dir.mkdir(parents=True, exist_ok=True)
    got = []
    for row in answer.get('files') or []:
        path = row.get('path') or ''
        status, one = engine.call('GET', '/api/library/file?path=' + urllib.parse.quote(path))
        one = one if isinstance(one, dict) else json.loads(one)
        url = (one.get('file') or {}).get('download_url') or one.get('download_url') or (one.get('download') or {}).get('url')
        if status != 200 or not url:
            continue
        target = out_dir / Path(path).name
        urllib.request.urlretrieve(url, target)
        got.append(str(target))
    return {'fetched': got}


def self_test():
    import tempfile
    checks = []
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp)
        (folder / 'Denim headshot.png').write_bytes(b'x')
        (folder / 'notes.txt').write_text('x')
        (folder / 'All other photos').mkdir()
        (folder / 'All other photos' / 'old.jpg').write_bytes(b'x')
        got = [t for t, _, _ in planned(folder)]
        checks.append(('only photos at the top of the folder are sent', got == [f'{LIBRARY_PHOTOS}/Denim headshot.png']))
        checks.append(('MINDMAKE_PHOTOS names the folder', photos_folder({'MINDMAKE_PHOTOS': tmp}) == folder))
    import library
    checks.append(('the library takes the headshot path', library.refusal(f'{LIBRARY_PHOTOS}/Natural headshot cutout.png') is None))
    failed = [name for name, ok in checks if not ok]
    return len(checks), failed


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('cmd', nargs='?', choices=('publish', 'fetch'))
    ap.add_argument('--out', default=str(REPO / '.cache' / 'photos'))
    ap.add_argument('--self-test', action='store_true')
    a = ap.parse_args()
    if a.self_test:
        count, failed = self_test()
        if failed:
            sys.exit('photos self-test failed: ' + '; '.join(failed))
        print(f'photos self-test passed: {count} checks')
        return
    if a.cmd == 'publish':
        print(json.dumps(cmd_publish(), indent=2))
    elif a.cmd == 'fetch':
        print(json.dumps(cmd_fetch(Path(a.out)), indent=2))
    else:
        ap.error('say publish or fetch')


if __name__ == '__main__':
    main()
