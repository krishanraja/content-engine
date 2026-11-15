"""Read and stage the approved drawn library; never draw or modify its source.

index() returns {library, poses: {id: {family, side, use_when, states,
opaque_box, mouth_box, eye_box}}}. Each state's record holds path, sha256,
size (width, height), and opaque_box. Boxes are [left, top, right, bottom],
with exclusive right/bottom coordinates, or None for no matching pixels.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / 'config/ve/character.json'
POSES = ROOT / 'config/ve/character-poses.json'
STUDIO = ROOT / 'config/studio.json'
STATES = ('closed', 'open', 'blink')


def _load(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def _approved():
    manifest = _load(MANIFEST)
    if manifest.get('approved') is not True:
        raise ValueError('character library requires character.json approved=true')
    return manifest


def _pose_id(pose):
    if not isinstance(pose, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', pose):
        raise ValueError(f'invalid pose id: {pose!r}')
    return pose


def library_dir() -> Path:
    """The manifest home below the runtime root; an environment override wins."""
    manifest = _approved()
    root = os.environ.get('MINDMAKE_LIBRARY_ROOT') or _load(STUDIO)['runtime']['library_root']
    if os.name != 'nt' and re.match(r'^[A-Za-z]:', root):
        raise ValueError('set MINDMAKE_LIBRARY_ROOT on this machine (configured root is a Windows path)')
    return Path(root) / manifest['home']['folder']


def _hash(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _box(mask):
    y, x = np.nonzero(mask)
    return [int(x.min()), int(y.min()), int(x.max()) + 1, int(y.max()) + 1] if len(x) else None


def _read(path):
    with Image.open(path) as image:
        if image.size != (1024, 1036):
            raise ValueError(f'{path.name}: expected 1024x1036, got {image.size}')
        if 'A' not in image.getbands() and 'transparency' not in image.info:
            raise ValueError(f'{path.name}: expected alpha')
        return np.array(image.convert('RGBA'))


def _changed(a, b):
    return np.any(np.abs(a.astype(np.int16) - b.astype(np.int16)) > 8, axis=2)


def poses() -> list[dict]:
    """All choices for a session to read; no automatic choice of pose."""
    manifest = _approved()
    built = set(manifest['library']['poses']) if manifest['library'].get('built') else set()
    return [{key: pose.get(key) for key in ('id', 'family', 'side', 'use_when')} | {'built': pose['id'] in built}
            for pose in _load(POSES)['poses']]


def index(directory=None) -> dict:
    """Measure every built pose from its actual files without saving an index."""
    manifest = _approved()
    directory = Path(directory) if directory is not None else library_dir()
    book = {p['id']: p for p in poses()}
    result = {'library': str(directory.resolve()), 'poses': {}}
    for pose in manifest['library']['poses']:
        _pose_id(pose)
        row = {key: book[pose][key] for key in ('family', 'side', 'use_when')}
        arrays, states = {}, {}
        for state in STATES:
            path = directory / 'poses' / f'{pose}-{state}.png'
            pixels = _read(path)
            arrays[state] = pixels
            states[state] = {'path': str(path.resolve()), 'sha256': _hash(path),
                             'size': [pixels.shape[1], pixels.shape[0]],
                             'opaque_box': _box(pixels[:, :, 3] > 128)}
        row.update(states=states, opaque_box=states['closed']['opaque_box'],
                   mouth_box=_box(_changed(arrays['closed'], arrays['open'])),
                   eye_box=_box(_changed(arrays['closed'], arrays['blink'])))
        result['poses'][pose] = row
    return result


def check(directory=None, *, allow_empty=False) -> dict:
    """Return a measured report; the CLI alone may save it to an explicit --out."""
    manifest = _approved()
    directory = Path(directory) if directory is not None else library_dir()
    errors = []
    if not directory.exists() and allow_empty:
        return {'ok': True, 'skipped': True, 'errors': []}
    if not directory.is_dir():
        errors.append(f'{directory}: missing library directory')
    for pose in manifest['library']['poses']:
        _pose_id(pose)
        arrays = {}
        for state in STATES:
            path = directory / 'poses' / f'{pose}-{state}.png'
            try:
                pixels = _read(path)
            except (OSError, ValueError) as exc:
                errors.append(str(exc))
                continue
            arrays[state] = pixels
            alpha = pixels[:, :, 3] > 128
            if alpha[:, 0].any() or alpha[:, -1].any() or alpha[0, :].any():
                errors.append(f'{path.name}: opaque pixels on left, right or top edge')
        for state, limit in (('open', (320, 220)), ('blink', (420, 200))):
            if 'closed' not in arrays or state not in arrays:
                continue
            box = _box(_changed(arrays['closed'], arrays[state]))
            if box is None:
                errors.append(f'{pose}-{state}: identical to closed (threshold 8)')
            elif box[2] - box[0] > limit[0] or box[3] - box[1] > limit[1]:
                errors.append(f'{pose}-{state}: changed pixels exceed {limit[0]}x{limit[1]} box')
    return {'ok': not errors, 'skipped': False, 'errors': errors}


def _outside(path, library):
    if path.resolve().is_relative_to(Path(library).resolve()):
        raise ValueError('output must be outside the source library')


def stage(index, poses, assets) -> dict:
    """Copy exactly the requested states, verifying against the measured hashes.

    Returns a pose/state map of staged paths. Reject all unknown poses before
    making directories or copying anything.
    """
    _approved()
    names = list(dict.fromkeys(poses))
    destination = Path(assets) / 'character'
    _outside(destination, index['library'])
    for pose in names:
        _pose_id(pose)
        if pose not in index['poses']:
            raise ValueError(f'pose not in index: {pose}')
        for state in STATES:
            item = index['poses'][pose]['states'][state]
            if _hash(item['path']) != item['sha256']:
                raise ValueError(f'{pose}-{state}: source sha256 changed since index')
            _outside(destination / f'{pose}-{state}.png', index['library'])
    result = {}
    for pose in names:
        result[pose] = {}
        for state in STATES:
            item = index['poses'][pose]['states'][state]
            target = destination / f'{pose}-{state}.png'
            destination.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(item['path'], target)
            if _hash(target) != item['sha256']:
                raise ValueError(f'{target}: staged sha256 mismatch')
            result[pose][state] = str(target)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    subs = parser.add_subparsers(dest='command', required=True)
    for verb in ('index', 'check', 'poses'):
        sub = subs.add_parser(verb)
        if verb != 'poses':
            sub.add_argument('--library', type=Path)
        if verb == 'check':
            sub.add_argument('--allow-empty', action='store_true')
            sub.add_argument('--out', type=Path)
    args = parser.parse_args(argv)
    try:
        _approved()
        if args.command == 'poses':
            print('9:16 only; never in the hook. Match the beat point to use_when.')
            for pose in poses():
                print(f"{pose['id']} | {pose['family']} | {pose['side']} | built={pose['built']} | {pose['use_when']}")
            return 0
        directory = args.library if args.library is not None else library_dir()
        if args.command == 'index':
            result = index(directory)
        else:
            if args.out:
                _outside(args.out, directory)
            result = check(directory, allow_empty=args.allow_empty)
            if args.out:
                args.out.parent.mkdir(parents=True, exist_ok=True)
                args.out.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(result, indent=2))
        return 0 if result.get('ok', True) else 1
    except (OSError, ValueError, KeyError) as exc:
        print(f'character library: {exc}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
